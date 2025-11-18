const YTDlpWrap = require("yt-dlp-wrap").default;
const ffmpegStatic = require("ffmpeg-static");
const path = require("path");
const fs = require("fs");
const { app } = require("electron");

// -----------------------------------------------------------
// Chemin YT-DLP local
// -----------------------------------------------------------
const ytDlpExecutable = path.join(
    process.env.LOCALAPPDATA,
    "AlephConverter",
    "bin",
    "yt-dlp.exe"
);

// -----------------------------------------------------------
// Chemin FFmpeg DEV / PROD (important !)
// -----------------------------------------------------------
let ffmpegBinary;

if (app.isPackaged) {
    // PROD → ffmpeg packagé
    ffmpegBinary = path.join(process.resourcesPath, "bin", "ffmpeg.exe");
} else {
    // DEV → ffmpeg-static
    ffmpegBinary = ffmpegStatic;
}

// IMPORTANT : remplacer les backslashes par des slashes
// yt-dlp a des soucis avec \ dans --ffmpeg-location
ffmpegBinary = ffmpegBinary.replace(/\\/g, "/");

console.log("FFmpeg utilisé =", ffmpegBinary);
console.log("yt-dlp utilisé =", ytDlpExecutable);

// -----------------------------------------------------------
// Initialisation yt-dlp
// -----------------------------------------------------------
const ytdlp = new YTDlpWrap(ytDlpExecutable);

// -----------------------------------------------------------
// Nettoyeur de titre
// -----------------------------------------------------------
function makeSafeTitle(title) {
    if (!title) return "Titre_inconnu";
    return title.replace(/[\/\\:*?"<>|]/g, "_").trim();
}

// -----------------------------------------------------------
// Vérifie si yt-dlp a vraiment généré le fichier final
// -----------------------------------------------------------
function findDownloadedFile(folder, expectedExt) {
    const files = fs.readdirSync(folder);
    const match = files.find(f => f.toLowerCase().endsWith(expectedExt));

    if (!match) return null;

    return path.join(folder, match);
}

const { spawn } = require("child_process");

async function downloadMP3(url, folder) {
    console.log("Téléchargement MP3…");

    const outputTemplate = path.join(folder, "%(title)s.%(ext)s");

    return new Promise((resolve, reject) => {
        const args = [
            url,
            "--no-simulate",
            "--extract-audio",
            "--audio-format", "mp3",
            "--print", "after_move:filepath",
            "-o", outputTemplate,
            "--ffmpeg-location", ffmpegBinary,
            "--no-update"
        ];

        console.log("[YTDLP CMD]", ytDlpExecutable, args);

        const proc = spawn(ytDlpExecutable, args);

        let output = "";

        proc.stdout.on("data", data => {
            const text = data.toString();
            console.log("[YTDLP OUT]", text);
            output += text;
        });

        proc.stderr.on("data", data => {
            console.log("[YTDLP ERR]", data.toString());
        });

        proc.on("close", code => {
            console.log("[YTDLP EXIT]", code);

            if (code !== 0) {
                return reject(new Error("Échec yt-dlp (exit " + code + ")"));
            }

            const lines = output.trim().split(/\r?\n/);
            const finalFile = lines[lines.length - 1].trim();

            console.log("Fichier final retourné par yt-dlp :", finalFile);

            if (!fs.existsSync(finalFile)) {
                //debug si ça foire encore
                try {
                    console.log("Contenu du dossier :", fs.readdirSync(folder));
                } catch {}
                return reject(new Error("Téléchargement échoué, fichier introuvable !"));
            }

            resolve(finalFile);
        });
    });
}





// -----------------------------------------------------------
// DOWNLOAD MP4
// -----------------------------------------------------------
async function downloadMP4(url, folder) {
    console.log("Téléchargement MP4…");

    const outputTemplate = path.join(folder, "%(title)s.%(ext)s");
    console.log("Template MP4 :", outputTemplate);

    return new Promise((resolve, reject) => {
        const args = [
            url,
            "-f", "bestvideo+bestaudio/best",
            "--merge-output-format", "mp4",
            "--no-simulate",
            "--print", "after_move:filepath",  //chemin du fichier FINAL
            "-o", outputTemplate,
            "--ffmpeg-location", ffmpegBinary,
            "--no-update"
        ];

        console.log("[YTDLP CMD MP4]", ytDlpExecutable, args);

        const proc = spawn(ytDlpExecutable, args);
        let output = "";

        proc.stdout.on("data", data => {
            const text = data.toString();
            console.log("[YTDLP OUT MP4]", text);
            output += text;
        });

        proc.stderr.on("data", data => {
            console.log("[YTDLP ERR MP4]", data.toString());
        });

        proc.on("close", code => {
            console.log("[YTDLP EXIT MP4]", code);

            if (code !== 0) {
                return reject(new Error("Échec yt-dlp MP4 (exit " + code + ")"));
            }

            const lines = output.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
            const finalFile = lines[lines.length - 1]?.trim();

            console.log("Fichier MP4 final retourné par yt-dlp :", finalFile);

            if (!finalFile || !fs.existsSync(finalFile)) {
                try {
                    console.log("Contenu du dossier MP4 :", fs.readdirSync(folder));
                } catch (e) {
                    console.log("Impossible de lister le dossier MP4 :", e);
                }
                return reject(new Error("Téléchargement échoué (pas de mp4 généré)"));
            }

            resolve(finalFile);
        });
    });
}



module.exports = { downloadMP3, downloadMP4 };
