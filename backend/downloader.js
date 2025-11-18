const YTDlpWrap = require("yt-dlp-wrap").default;
const ffmpegStatic = require("ffmpeg-static");
const path = require("path");
const fs = require("fs");
const { app } = require("electron");

// MEME CHEMIN QUE YTDlpManager
const ytDlpExecutable = path.join(
    process.env.LOCALAPPDATA,
    "AlephConverter",
    "bin",
    "yt-dlp.exe"
);

// Chemin ffmpeg DEV / PROD
const ffmpegBinary = app.isPackaged
    ? path.join(process.resourcesPath, "bin", "ffmpeg.exe")
    : ffmpegStatic;

// Vérif (pour debug)
if (!fs.existsSync(ytDlpExecutable)) {
    console.error("yt-dlp introuvable :", ytDlpExecutable);
}

// Instance principale
const ytdlp = new YTDlpWrap(ytDlpExecutable);

function makeSafeTitle(title) {
    if (!title) return "Titre_inconnu";
    return title.replace(/[\/\\:*?"<>|]/g, "_").trim();
}

async function downloadMP3(url, folder) {
    const info = await ytdlp.getVideoInfo(url);
    const safeTitle = makeSafeTitle(info?.title || "Titre inconnu");

    const outputPath = path.join(folder, safeTitle + ".mp3");

    await ytdlp.exec([
        url,
        "--extract-audio",
        "--audio-format", "mp3",
        "-o", outputPath,
        "--ffmpeg-location", ffmpegBinary,
        "--no-update"
    ]);

    return outputPath;
}

async function downloadMP4(url, folder) {
    const info = await ytdlp.getVideoInfo(url);
    const safeTitle = makeSafeTitle(info?.title || "Titre inconnu");

    const outputPath = path.join(folder, safeTitle + ".mp4");

    await ytdlp.exec([
        url,
        "-f", "mp4",
        "-o", outputPath,
        "--ffmpeg-location", ffmpegBinary,
        "--no-update"
    ]);

    return outputPath;
}

module.exports = { downloadMP3, downloadMP4 };
