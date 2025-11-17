const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const ffmpeg = require("ffmpeg-static");

function runFFmpeg(args) {
    return new Promise((resolve, reject) => {
        execFile(ffmpeg, args, (err, stdout, stderr) => {
            if (err) {
                console.error("FFmpeg error:", stderr?.toString() || err);
                return reject(err);
            }
            resolve();
        });
    });
}

async function applySlowReverb(inputPath) {

    if (!fs.existsSync(inputPath)) {
        console.error("Fichier introuvable :", inputPath);
        return;
    }

    const dir = path.dirname(inputPath);
    const base = path.basename(inputPath, path.extname(inputPath));

    const outputPath = path.join(dir, base + " [slow+reverb].mp3");
    const tempPath   = path.join(dir, base + " [slow_tmp].wav");

    const irPath = path.join(__dirname, "impulse", "Deep Space.wav");

    if (!fs.existsSync(irPath)) {
        console.error("Impulse Response manquante :", irPath);
        return;
    }

    try {
        console.log("➡️ Étape 1 : Slow + Pitch...");

        const slowFilter =
            "aformat=sample_fmts=s16:sample_rates=44100:channel_layouts=stereo," +
            "asetrate=44100*0.8,aresample=44100,atempo=0.92";

        await runFFmpeg([
            "-y",
            "-i", inputPath,
            "-filter:a", slowFilter,
            "-ac", "2",
            "-ar", "44100",
            tempPath
        ]);

        console.log("➡️ Étape 2 : Reverb…");

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

        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

        console.log("🎉 Terminé !");
        console.log("Fichier généré :", outputPath);

        return outputPath;

    } catch (err) {
        console.error("❌ Erreur slow+reverb :", err);
        throw err;
    }
}

// ---------------------
// EXPORT DE LA FONCTION
// ---------------------
module.exports = { applySlowReverb };
