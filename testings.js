const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const ffmpeg = require("ffmpeg-static");

// -------------------------------------------
// FFmpeg
// -------------------------------------------
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

// -------------------------------------------
// Slow + Reverb indé
// -------------------------------------------
async function applySlowReverb(inputPath) {

    if (!fs.existsSync(inputPath)) {
        console.error("Fichier introuvable :", inputPath);
        return;
    }

    const dir = path.dirname(inputPath);
    const base = path.basename(inputPath, path.extname(inputPath));

    const outputPath = path.join(dir, base + " [slow+reverb].mp3");
    const tempPath   = path.join(dir, base + " [slow_tmp].wav");

    // choix du type de reverb
    const irPath = path.join(__dirname, "backend/impulse", "Deep Space.wav");

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

        console.log("➡️ Étape 2 : Reverb + normalisation...");

        const mix = 0.7;          // 0 = full dry, 1 = full reverb
        const preDelayMs = 60;    // comblé le décalage entre piste et piste verb

        const reverbFilter =
            // 1) Duplique le signal original
            "[0:a]asplit=2[dry][toverb];" +

            // 2) Applique l'IR sur la branche wet
            "[toverb][1:a]afir=dry=1:wet=1[wet0];" +

            // 3) Pré-delay + filtre sur le wet
            `[wet0]adelay=${preDelayMs}|${preDelayMs},lowpass=f=9000[wet];` +

            // 4) Ajuste les gains dry / wet selon mix
            `[dry]volume=${(1 - mix).toFixed(2)}[dryv];` +
            `[wet]volume=${mix.toFixed(2)}[wetv];` +

            // 5) Mix final
            "[dryv][wetv]amix=inputs=2:normalize=0[out]";



        await runFFmpeg([
            "-y",
            "-i", tempPath,  // 0:a = ton audio ralenti
            "-i", irPath,    // 1:a = ton impulse response
            "-filter_complex", reverbFilter,
            "-map", "[out]",
            "-b:a", "192k",
            outputPath
        ]);


        console.log("➡️ Suppression du fichier temporaire…");

        if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
        }

        console.log("Terminé !");
        console.log("Fichier généré :", outputPath);

    } catch (err) {
        console.error("Erreur slow+reverb :", err);
    }
}

// -------------------------------------------
// Execution si lancé via Node
// -------------------------------------------
const mp3 = process.argv[2];

if (!mp3) {
    console.log("Usage : node test_slowreverb.js \"C:\\chemin\\vers\\fichier.mp3\"");
} else {
    applySlowReverb(mp3);
}