const { app } = require("electron");
const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const ffmpeg = require("ffmpeg-static");

// -----------------------------------------------------------
// Fonction debug existence + timings
// -----------------------------------------------------------
function checkExists(pathStr, label = "") {
    const exists = fs.existsSync(pathStr);
    console.log(`[EXISTS] ${label} → ${exists} — "${pathStr}"`);
    return exists;
}

function delayedExists(pathStr) {
    console.log("Vérifications différées…");

    setTimeout(() => checkExists(pathStr, "Existe à +50ms"), 50);
    setTimeout(() => checkExists(pathStr, "Existe à +150ms"), 150);
    setTimeout(() => checkExists(pathStr, "Existe à +300ms"), 300);
    setTimeout(() => checkExists(pathStr, "Existe à +800ms"), 800);
}

// -----------------------------------------------------------
// Dump dossier
// -----------------------------------------------------------
function dumpFolder(folder, msg = "DUMP DOSSIER") {
    try {
        const list = fs.readdirSync(folder);
        console.log(`[${msg}]`, list);
    } catch (err) {
        console.log("Impossible de lire le dossier :", err);
    }
}

// -----------------------------------------------------------
// Execute FFmpeg avec logs
// -----------------------------------------------------------
function runFFmpeg(args) {
    console.log("FFmpeg args =", args);

    return new Promise((resolve, reject) => {
        execFile(ffmpeg, args, (err, stdout, stderr) => {
            if (stdout) console.log("FFmpeg STDOUT:", stdout.toString());
            if (stderr) console.log("FFmpeg STDERR:", stderr.toString());

            if (err) {
                console.error("FFmpeg ERROR:", err);
                return reject(err);
            }

            resolve();
        });
    });
}

// -----------------------------------------------------------
// APPLY SLOW + REVERB — Avec logs BOOSTÉS
// -----------------------------------------------------------
async function applySlowReverb(inputPath) {
    console.log("\n\n===================== APPLY SLOW + REVERB =====================");
    console.log(" inputPath =", inputPath);

    console.log("\n Vérification immédiate du fichier d'entrée");
    checkExists(inputPath, "Avant traitement");
    delayedExists(inputPath);

    const dir = path.dirname(inputPath);
    const base = path.basename(inputPath, path.extname(inputPath));

    console.log("\nDossier d'entrée :", dir);
    dumpFolder(dir, "CONTENU DOSSIER (avant slow)");

    const outputPath = path.join(dir, base + " [slow+reverb].mp3");
    const tempPath   = path.join(dir, base + " [slow_tmp].wav");

    console.log("\noutputPath =", outputPath);
    console.log("tempPath   =", tempPath);

    const irPath = app.isPackaged
        ? path.join(process.resourcesPath, "app.asar.unpacked", "backend", "impulse", "Deep Space.wav")
        : path.join(__dirname, "impulse", "Deep Space.wav");


    console.log("\n irPath =", irPath);
    checkExists(irPath, "Impulse existe ?");

    if (!fs.existsSync(inputPath)) {
        console.error("FICHIER D'ENTRÉE INTROUVABLE AU DÉBUT");
        return;
    }

    try {
        console.log("\n➡Étape 1 : Slow + Pitch…");

        const slowFilter =
            "aformat=sample_fmts=s16:sample_rates=44100:channel_layouts=stereo," +
            "asetrate=44100*0.9,aresample=44100,atempo=0.95";

        await runFFmpeg([
            "-y",
            "-i", inputPath,
            "-filter:a", slowFilter,
            "-ac", "2",
            "-ar", "44100",
            tempPath
        ]);

        console.log("\nVérif existence tempPath après étape 1");
        checkExists(tempPath);
        dumpFolder(dir, "CONTENU DOSSIER (après slow)");

        console.log("\n➡Étape 2 : Reverb…");

        const mix = 0.7;
        const preDelayMs = 60;

        const reverbFilter =
            "[0:a]asplit=2[dry][toverb];" +
            "[toverb][1:a]afir=dry=1:wet=1[wet0];" +
            `[wet0]adelay=${preDelayMs}|${preDelayMs},lowpass=f=9000[wet];` +
            `[dry]volume=${(1 - mix).toFixed(2)}[dryv];` +
            `[wet]volume=${mix.toFixed(2)}[wetv];` +
            "[dryv][wetv]amix=inputs=2:normalize=0[out]";

        await runFFmpeg([
            "-y",
            "-i", tempPath,
            "-i", irPath,
            "-filter_complex", reverbFilter,
            "-map", "[out]",
            "-b:a", "192k",
            outputPath
        ]);

        console.log("\nVérif existence outputPath après étape 2");
        checkExists(outputPath);
        dumpFolder(dir, "CONTENU DOSSIER (après reverb)");

        if (fs.existsSync(tempPath)) {
            console.log("Suppression tempPath:", tempPath);
            fs.unlinkSync(tempPath);
        } else {
            console.log("⚠tempPath déjà inexistant au moment du cleanup");
        }

        console.log("\nTerminé !");
        console.log("Fichier généré :", outputPath);

        return outputPath;

    } catch (err) {
        console.error("ERREUR finale slow+reverb :", err);
        throw err;
    }
}

module.exports = { applySlowReverb };
