const { spawn } = require("child_process");
const { app } = require("electron");
const path = require("path");
const fs = require("fs");
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

ffmpegBinary = ffmpegBinary.replace(/\\/g, "/");

console.log("FFmpeg utilisé :", ffmpegBinary);
console.log("yt-dlp utilisé :", ytDlpExecutable);

const AUDIO_EXTS = new Set([".mp3", ".m4a", ".webm", ".opus", ".ogg", ".flac", ".wav", ".aac"]);

// Trouve le fichier le plus récemment modifié dans folder parmi les extensions autorisées,
// modifié après startTime (avec une tolérance de 3s pour les FS lents / OneDrive).
function findRecentFile(folder, startTime, allowedExts) {
    try {
        return fs.readdirSync(folder)
            .map(f => path.join(folder, f))
            .find(f => {
                if (f.endsWith(".part") || f.endsWith(".ytdl")) return false;
                if (!allowedExts.has(path.extname(f).toLowerCase())) return false;
                try { return fs.statSync(f).mtimeMs >= startTime - 3000; }
                catch { return false; }
            }) || null;
    } catch { return null; }
}


// -----------------------------------------------------------
// TELECHARGEMENT AUDIO (original / mp3 / m4a / flac)
// -----------------------------------------------------------
async function downloadAudio(url, folder, audioFormat = "original", opts = {}) {
    const { setCancelFn } = opts;
    console.log("Downloading audio —", audioFormat);

    const outputTemplate = path.join(folder, "%(title)s.%(ext)s");
    const startTime = Date.now();

    return new Promise((resolve, reject) => {

        const args = [
            url,
            "--no-simulate",
            "-o", outputTemplate,
            "--ffmpeg-location", ffmpegBinary,
            "--no-update",
            "--print", "after_move:filepath"
        ];

        if (audioFormat === "original") {
            args.push("-f", "bestaudio");
        } else {
            args.push(
                "--extract-audio",
                "--audio-format", audioFormat,
                "--audio-quality", "0"
            );
        }

        console.log("[YTDLP CMD AUDIO]", ytDlpExecutable, args);

        const proc = spawn(ytDlpExecutable, args, {
            env: { ...process.env, PYTHONUTF8: "1" }
        });
        let cancelled = false;
        let resolvedPath = "";

        if (setCancelFn) setCancelFn(() => { cancelled = true; proc.kill(); });

        proc.stdout.on("data", d => {
            const line = d.toString("utf8").trim();
            console.log("[YTDLP STDOUT AUDIO]", line);
            if (line) resolvedPath = line;
        });

        proc.stderr.on("data", d => console.log("[YTDLP ERR AUDIO]", d.toString()));

        proc.on("close", code => {
            console.log("[YTDLP EXIT AUDIO]", code);
            if (cancelled) return reject(Object.assign(new Error("cancelled"), { cancelled: true }));
            if (code !== 0) return reject(new Error("Échec yt-dlp audio (exit " + code + ")"));

            console.log("[AUDIO PATH]", resolvedPath);
            console.log("[AUDIO EXISTS]", fs.existsSync(resolvedPath));
            console.log("[FOLDER CONTENT]", fs.readdirSync(folder));

            if (resolvedPath && fs.existsSync(resolvedPath)) {
                console.log("[AUDIO OK primary] →", resolvedPath);
                return resolve(resolvedPath);
            }

            // Fallback : fichier modifié depuis le début du téléchargement
            const fallback = findRecentFile(folder, startTime, AUDIO_EXTS);
            console.log("[AUDIO FALLBACK]", fallback);
            if (fallback) return resolve(fallback);

            reject(new Error("Downloading failed... file not found"));
        });
    });
}


// -----------------------------------------------------------
// TELECHARGEMENT VIDEO (mp4)
// -----------------------------------------------------------
async function downloadVideo(url, folder, opts = {}) {
    const { setCancelFn } = opts;
    console.log("Downloading MP4…");

    const outputTemplate = path.join(folder, "%(title)s.%(ext)s");
    const startTime = Date.now();

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

        console.log("[YTDLP CMD VIDEO]", ytDlpExecutable, args);

        const proc = spawn(ytDlpExecutable, args, {
            env: { ...process.env, PYTHONUTF8: "1" }
        });
        let cancelled = false;
        let resolvedPath = "";

        if (setCancelFn) setCancelFn(() => { cancelled = true; proc.kill(); });

        proc.stdout.on("data", d => {
            const line = d.toString("utf8").trim();
            console.log("[YTDLP STDOUT VIDEO]", line);
            if (line) resolvedPath = line;
        });

        proc.stderr.on("data", d => console.log("[YTDLP ERR VIDEO]", d.toString()));

        proc.on("close", code => {
            console.log("[YTDLP EXIT VIDEO]", code);
            if (cancelled) return reject(Object.assign(new Error("cancelled"), { cancelled: true }));
            if (code !== 0) return reject(new Error("Échec yt-dlp MP4 (exit " + code + ")"));

            console.log("[VIDEO PATH]", resolvedPath);
            console.log("[VIDEO EXISTS]", fs.existsSync(resolvedPath));

            if (resolvedPath && fs.existsSync(resolvedPath)) {
                console.log("[VIDEO OK primary] →", resolvedPath);
                return resolve(resolvedPath);
            }

            const fallback = findRecentFile(folder, startTime, new Set([".mp4"]));
            console.log("[VIDEO FALLBACK]", fallback);
            if (fallback) return resolve(fallback);

            reject(new Error("Downloading MP4 failed (no MP4 has been found)"));
        });
    });
}


// -----------------------------------------------------------
module.exports = {
    downloadAudio,
    downloadVideo
};
