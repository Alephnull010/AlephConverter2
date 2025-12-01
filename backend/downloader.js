const { spawn } = require("child_process");
const { app } = require("electron");
const path = require("path");
const fs = require("fs");
const YTDlpWrap = require("yt-dlp-wrap").default;
const ffmpegStatic = require("ffmpeg-static");

// -----------------------------------------------------------
// Chemins YT-DLP + FFmpeg
// -----------------------------------------------------------
const ytDlpExecutable = path.join(
    process.env.LOCALAPPDATA,
    "AlephConverter",
    "bin",
    "yt-dlp.exe"
);

let ffmpegBinary;
if (app.isPackaged) {
    ffmpegBinary = path.join(process.resourcesPath, "bin", "ffmpeg.exe");
} else {
    ffmpegBinary = ffmpegStatic;
}

// yt-dlp préfère les slashes
ffmpegBinary = ffmpegBinary.replace(/\\/g, "/");

console.log("FFmpeg utilisé :", ffmpegBinary);
console.log("yt-dlp utilisé :", ytDlpExecutable);


// -----------------------------------------------------------
// Utilitaire : vérifie existence fichier final
// -----------------------------------------------------------
function ensureFileExists(filepath) {
    if (!filepath) return false;
    return fs.existsSync(filepath);
}


// -----------------------------------------------------------
// TELECHARGEMENT MP3
// -----------------------------------------------------------
async function downloadMP3(url, folder) {
    console.log("Téléchargement MP3…");

    const outputTemplate = path.join(folder, "%(title)s.%(ext)s");

    return new Promise((resolve, reject) => {

        const args = [
            url,
            "--extract-audio",
            "--audio-format", "mp3",
            "--no-simulate",
            "--print", "after_move:filepath",   // ← LE VRAI CHEMIN FINAL
            "-o", outputTemplate,
            "--ffmpeg-location", ffmpegBinary,
            "--no-update"
        ];

        console.log("[YTDLP CMD MP3]", ytDlpExecutable, args);

        const proc = spawn(ytDlpExecutable, args);
        let output = "";

        proc.stdout.on("data", data => {
            const text = data.toString();
            console.log("[YTDLP OUT MP3]", text);
            output += text;
        });

        proc.stderr.on("data", data => {
            console.log("[YTDLP ERR MP3]", data.toString());
        });

        proc.on("close", code => {
            console.log("[YTDLP EXIT MP3]", code);

            if (code !== 0) {
                return reject(new Error("Échec yt-dlp MP3 (exit " + code + ")"));
            }

            const finalFile = output.trim().replace(/"/g, "");
            console.log("[MP3 FINAL] →", finalFile);

            if (!ensureFileExists(finalFile)) {
                console.log("Contenu dossier MP3 :", fs.readdirSync(folder));
                return reject(new Error("Téléchargement MP3 échoué (fichier introuvable)"));
            }

            resolve(finalFile);
        });
    });
}



// -----------------------------------------------------------
// TELECHARGEMENT MP4
// -----------------------------------------------------------
async function downloadMP4(url, folder) {
    console.log("Téléchargement MP4…");

    const outputTemplate = path.join(folder, "%(title)s.%(ext)s");

    return new Promise((resolve, reject) => {

        const args = [
            url,
            "-f", "bestvideo+bestaudio/best",
            "--merge-output-format", "mp4",
            "--no-simulate",
            "--print", "after_move:filepath",   // ← chemin final garanti
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

            const finalFile = output.trim().replace(/"/g, "");
            console.log("[MP4 FINAL] →", finalFile);

            if (!ensureFileExists(finalFile)) {
                try {
                    console.log("Contenu dossier MP4 :", fs.readdirSync(folder));
                } catch (e) {
                    console.log("Impossible de lister dossier MP4 :", e);
                }
                return reject(new Error("Téléchargement MP4 échoué (fichier introuvable)"));
            }

            resolve(finalFile);
        });
    });
}



// -----------------------------------------------------------
module.exports = {
    downloadMP3,
    downloadMP4
};
