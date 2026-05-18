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
    console.log("Downloading MP3…");

    const outputTemplate = path.join(folder, "%(title)s.%(ext)s");

    return new Promise((resolve, reject) => {

        const args = [
            url,
            "--extract-audio",
            "--audio-format", "mp3",
            "--audio-quality", "0",
            "--no-simulate",
            "-o", outputTemplate,
            "--ffmpeg-location", ffmpegBinary,
            "--no-update",
            "--print", "after_move:filepath"
        ];

        console.log("[YTDLP CMD MP3]", ytDlpExecutable, args);

        const proc = spawn(ytDlpExecutable, args);
        let resolvedPath = "";

        proc.stdout.on("data", d => {
            const line = d.toString().trim();
            if (line) resolvedPath = line;
        });

        proc.stderr.on("data", d =>
            console.log("[YTDLP ERR MP3]", d.toString())
        );

        proc.on("close", code => {
            console.log("[YTDLP EXIT MP3]", code);

            if (code !== 0) {
                return reject(new Error("Échec yt-dlp MP3 (exit " + code + ")"));
            }

            if (!resolvedPath || !fs.existsSync(resolvedPath)) {
                return reject(new Error("Downloading failed... no .mp3 has been found"));
            }

            console.log("[MP3 FINAL OK] →", resolvedPath);
            resolve(resolvedPath);
        });
    });
}




// -----------------------------------------------------------
// TELECHARGEMENT MP4
// -----------------------------------------------------------
async function downloadMP4(url, folder) {
    console.log("Downloading MP4…");

    const outputTemplate = path.join(folder, "%(title)s.%(ext)s");

    return new Promise((resolve, reject) => {

        const args = [
            url,
            "-f", "bestvideo+bestaudio/best",
            "--merge-output-format", "mp4",
            "--no-simulate",
            "-o", outputTemplate,
            "--ffmpeg-location", ffmpegBinary,
            "--no-update",
            "--print", "after_move:filepath"
        ];

        console.log("[YTDLP CMD MP4]", ytDlpExecutable, args);

        const proc = spawn(ytDlpExecutable, args);
        let resolvedPath = "";

        proc.stdout.on("data", d => {
            const line = d.toString().trim();
            if (line) resolvedPath = line;
        });

        proc.stderr.on("data", d =>
            console.log("[YTDLP ERR MP4]", d.toString())
        );

        proc.on("close", code => {
            console.log("[YTDLP EXIT MP4]", code);

            if (code !== 0) {
                return reject(new Error("Échec yt-dlp MP4 (exit " + code + ")"));
            }

            if (!resolvedPath || !fs.existsSync(resolvedPath)) {
                return reject(new Error("Downloading MP4 failed (no MP4 has been found)"));
            }

            console.log("[MP4 FINAL OK] →", resolvedPath);
            resolve(resolvedPath);
        });
    });
}




// -----------------------------------------------------------
module.exports = {
    downloadMP3,
    downloadMP4
};
