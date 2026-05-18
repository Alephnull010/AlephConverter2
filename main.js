// =======================================================
//  IMPORTS
// =======================================================
const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");

const { initYtDlp, needsUpdate } = require("./backend/ytDlpManager");
const { downloadAudio, downloadVideo } = require("./backend/downloader");
const { applySlowReverb } = require("./backend/audioProcessor");

const { Worker } = require("worker_threads");


// =======================================================
//  VARIABLES GLOBALES FENETRES
// =======================================================
let mainWin = null;
let updateWin = null;
let cancelCurrentDownload = null;

const fs = require("fs");

const LOG_PATH = path.join(process.env.LOCALAPPDATA, "AlephConverter", "app.log");

// on s’assure que le dossier existe
fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });

// redirection console vers fichier
const logStream = fs.createWriteStream(LOG_PATH, { flags: "a" });

const originalLog = console.log;
console.log = (...args) => {
    const msg = args.map(a => (typeof a === "object" ? JSON.stringify(a) : a)).join(" ");
    logStream.write(`[${new Date().toISOString()}] ${msg}\n`);
    originalLog(...args);
};



// =======================================================
//  FENÊTRES
// =======================================================
function createMainWindow() {
    mainWin = new BrowserWindow({
        width: 500,
        height: 435,
        resizable: false,
        frame: false,
        webPreferences: {
            preload: path.join(__dirname, "preload.js")
        }
    });

    mainWin.loadFile("./renderer/index.html");

    mainWin.on("closed", () => {
        mainWin = null;
    });
}

function safeCreateMainWindow() {
    // On évite plusieurs fenêtres, mais on autorise la recréation si fermée
    if (mainWin && !mainWin.isDestroyed()) return;
    createMainWindow();
}

function createUpdateWindow() {
    if (updateWin && !updateWin.isDestroyed()) return;

    updateWin = new BrowserWindow({
        width: 300,
        height: 200,
        frame: false,
        resizable: false,
        webPreferences: {
            preload: path.join(__dirname, "preload_splash.js")
        }
    });

    updateWin.loadFile("./renderer/update.html");

    updateWin.on("closed", () => {
        updateWin = null;
    });
}

function sendUpdateText(msg) {
    if (updateWin && !updateWin.isDestroyed()) {
        updateWin.webContents.send("update-text", msg);
    }
}


// =======================================================
//  IPC HANDLERS
// =======================================================
ipcMain.handle("choose-folder", async () => {
    const result = await dialog.showOpenDialog({
        properties: ["openDirectory"]
    });
    return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("download", async (event, data) => {
    const { url, folder, type, audioFormat, slowReverb } = data;

    console.log("[DOWNLOAD] url =", url);
    console.log("[DOWNLOAD] folder =", folder);
    console.log("[DOWNLOAD] type =", type);
    console.log("[DOWNLOAD] audioFormat =", audioFormat);
    console.log("[DOWNLOAD] slowReverb =", slowReverb);

    cancelCurrentDownload = null;

    const setCancelFn = (fn) => { cancelCurrentDownload = fn; };

    // 1) Télécharger le fichier avec yt-dlp
    let downloadedPath;
    try {
        if (type === "video") {
            downloadedPath = await downloadVideo(url, folder, { setCancelFn });
        } else {
            downloadedPath = await downloadAudio(url, folder, audioFormat, { setCancelFn });
        }
    } catch (err) {
        cancelCurrentDownload = null;
        if (err.cancelled) return { success: false, cancelled: true };
        return { success: false, error: err.message };
    }

    console.log("[DOWNLOAD] Fichier téléchargé :", downloadedPath);

    // 2) Si slow+reverb demandé → on traite dans un Worker Thread
    if (slowReverb) {
        console.log("[AUDIO] slow+reverb via worker…");
        try {
            const output = await runSlowReverbWorker(downloadedPath, slowReverb, { setCancelFn });
            cancelCurrentDownload = null;
            return { success: true, original: downloadedPath, final: output, slowReverb: true };
        } catch (err) {
            cancelCurrentDownload = null;
            console.log("[AUDIO] Erreur slow+reverb :", err);
            if (err.cancelled) return { success: false, cancelled: true };
            return { success: false, original: downloadedPath, final: null, error: err.message };
        }
    }

    // 3) Sinon on renvoie juste le chemin téléchargé
    cancelCurrentDownload = null;
    return { success: true, original: downloadedPath, final: downloadedPath, slowReverb: false };
});

ipcMain.on("window-control", (event, action) => {
    if (!mainWin) return;
    if (action === "minimize") mainWin.minimize();
    if (action === "close") mainWin.close();
});

ipcMain.handle("open-file", (_, filePath) => shell.showItemInFolder(filePath));

ipcMain.on("splash-close", () => {
    if (updateWin && !updateWin.isDestroyed()) updateWin.close();
});

ipcMain.on("cancel-download", () => {
    if (cancelCurrentDownload) {
        cancelCurrentDownload();
        cancelCurrentDownload = null;
    }
});


// =======================================================
//  WORKER SLOW+REVERB
// =======================================================
function runSlowReverbWorker(inputPath, presetName, { setCancelFn }) {
    const ffmpegBin = app.isPackaged
        ? path.join(process.resourcesPath, "bin", "ffmpeg.exe")
        : require("ffmpeg-static");

    return new Promise((resolve, reject) => {
        const worker = new Worker(path.join(__dirname, "backend", "audioWorker.js"), {
            workerData: { inputPath, presetName, ffmpegBin }
        });

        setCancelFn(() => worker.postMessage("cancel"));

        worker.on("message", (msg) => {
            if (msg.type === "done")  resolve(msg.output);
            else if (msg.type === "error") reject(Object.assign(new Error(msg.message), { cancelled: msg.cancelled }));
        });

        worker.on("error", reject);
    });
}


// =======================================================
//  SPLASH POUR MAJ YT-DLP
// =======================================================
function hasInternet() {
    return new Promise(resolve => {
        require("dns").lookup("github.com", err => {
            resolve(!err);
        });
    });
}

async function updateYtDlpWithSplash() {

    console.log("[YT-DLP] Vérification…");

    const hasLocal = fs.existsSync(path.join(process.env.LOCALAPPDATA, "AlephConverter", "bin", "yt-dlp.exe"));
    const online = await hasInternet();

    // Cas critique : PAS internet + PAS de yt-dlp → on affiche une erreur visible
    if (!online && !hasLocal) {
        console.log("[YT-DLP] Pas d'internet et aucun yt-dlp → impossible de continuer.");

        if (mainWin) {
            mainWin.close();
            mainWin = null;
        }
        if (updateWin) {
            updateWin.close();
            updateWin = null;
        }

        createUpdateWindow();
        sendUpdateText("No internet connection.\nUnable to install yt-dlp.");
        return;
    }

    // Cas : pas internet mais yt-dlp présent → tout va bien, on skip
    if (!online && hasLocal) {
        console.log("[YT-DLP] Pas d'internet, mais version locale présente → skip update.");
        return;
    }

    // Cas normal : internet disponible → on continue
    const need = await needsUpdate();
    if (!need) {
        console.log("[YT-DLP] Pas de mise à jour nécessaire.");
        return;
    }

    console.log("[YT-DLP] Mise à jour requise → splash");

    if (mainWin) {
        mainWin.close();
        mainWin = null;
    }
    if (updateWin) {
        updateWin.close();
        updateWin = null;
    }

    createUpdateWindow();
    sendUpdateText("Updating yt-dlp…");

    try {
        await initYtDlp(sendUpdateText);
        sendUpdateText("yt-dlp updated ✓");
    } catch (err) {
        console.log("[YT-DLP] Erreur :", err);
        sendUpdateText("YT-DLP Error: " + err.message);
        await new Promise(r => setTimeout(r, 3000));
    }

    if (updateWin) {
        updateWin.close();
        updateWin = null;
    }

    safeCreateMainWindow();
}



// =======================================================
//  LOGIQUE DE LANCEMENT (start-first + splash si update)
// =======================================================
async function launchSequence() {

    // 1) DÉMARRAGE IMMÉDIAT DE L'UI
    safeCreateMainWindow();

    // 2) MODE DEV → pas de MAJ auto de l'app
    if (!app.isPackaged) {
        console.log("[DEV MODE] Pas de mise à jour de l'application. YT-DLP peut être géré à part si besoin.");
        return;
    }

    // 3) CONFIG AUTO-UPDATER
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = false;

    autoUpdater.on("update-available", async (info) => {

        const remoteVersion = info?.version?.replace(/^v/, "");
        const localVersion = app.getVersion().replace(/^v/, "");

        console.log("[AUTOUPDATE] Remote =", remoteVersion, "| Local =", localVersion);

        if (!remoteVersion || remoteVersion === localVersion) {
            console.log("[AUTOUPDATE] Version identique ou invalide → skip");
            await updateYtDlpWithSplash();
            return;
        }

        // Mise à jour
        if (mainWin) {
            mainWin.close();
            mainWin = null;
        }

        createUpdateWindow();
        sendUpdateText("Updating…");
    });


    autoUpdater.on("download-progress", (progress) => {
        const percent = Math.round(progress.percent);
        console.log("[AUTOUPDATE] Progress :", percent + "%");
        sendUpdateText(`Downloading : ${percent}%`);
    });

    autoUpdater.on("update-downloaded", () => {
        console.log("[AUTOUPDATE] Update téléchargée, installation…");
        sendUpdateText("Installing update…");
        setTimeout(() => {
            autoUpdater.quitAndInstall();
        }, 1500);
    });

    // Si PAS de MAJ APP → on passe à la logique YT-DLP
    autoUpdater.on("update-not-available", async () => {
        console.log("[AUTOUPDATE] Aucune mise à jour app.");
        try {
            await updateYtDlpWithSplash();
        } catch (e) {
            console.log("[AUTOUPDATE] Erreur lors de updateYtDlpWithSplash (update-not-available):", e.message);
        }
    });

    autoUpdater.on("error", async (err) => {
        console.log("[AUTOUPDATE] Erreur updater :", err.message);

        // Nettoyer le splash app si ouvert
        if (updateWin) {
            updateWin.close();
            updateWin = null;
        }

        // On ne bloque pas l'utilisateur : on tente YT-DLP, sinon on laisse la main
        try {
            await updateYtDlpWithSplash();
        } catch (e) {
            console.log("[AUTOUPDATE] Erreur lors de updateYtDlpWithSplash après erreur updater:", e.message);
        }
    });

    try {
        console.log("[AUTOUPDATE] checkForUpdates…");
        await autoUpdater.checkForUpdates();
    } catch (e) {
        console.log("[AUTOUPDATE] Erreur checkForUpdates:", e.message);
        try {
            await updateYtDlpWithSplash();
        } catch (err) {
            console.log("[AUTOUPDATE] Erreur lors de updateYtDlpWithSplash après exception checkForUpdates:", err.message);
        }
    }
}


// =======================================================
//  READY
// =======================================================
app.whenReady().then(launchSequence);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    safeCreateMainWindow();
});
