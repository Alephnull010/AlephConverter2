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

// -----------------------------------------------------------
// DOWNLOAD MP3
// -----------------------------------------------------------
async function downloadMP3(url, folder) {
    console.log("Téléchargement MP3…");

    // 1) Récupérer le titre
    const info = await ytdlp.getVideoInfo(url);
    const safeTitle = makeSafeTitle(info?.title || "audio");

    const outputPath = path.join(folder, safeTitle + ".mp3");

    console.log("Nom prévu :", outputPath);

    // 2) Conversion
    await ytdlp.exec([
        url,
        "--extract-audio",
        "--audio-format", "mp3",
        "-o", outputPath,
        "--ffmpeg-location", ffmpegBinary,
        "--no-update"
    ]);

    // 3) Vérification réelle : le fichier existe ?
    let finalFile = findDownloadedFile(folder, ".mp3");

    if (!finalFile) {
        console.log("Aucun fichier MP3 trouvé après téléchargement !");
        throw new Error("Téléchargement échoué (pas de mp3 généré)");
    }

    console.log("MP3 créé :", finalFile);
    return finalFile;
}

// -----------------------------------------------------------
// DOWNLOAD MP4
// -----------------------------------------------------------
async function downloadMP4(url, folder) {
    console.log("Téléchargement MP4…");

    const info = await ytdlp.getVideoInfo(url);
    const safeTitle = makeSafeTitle(info?.title || "video");

    const outputPath = path.join(folder, safeTitle + ".mp4");

    console.log("nom prévu :", outputPath);

    await ytdlp.exec([
        url,
        "-f", "bestvideo+bestaudio/best",
        "-o", outputPath,
        "--merge-output-format", "mp4",
        "--ffmpeg-location", ffmpegBinary,
        "--no-update"
    ]);

    // Vérification réelle
    const finalFile = findDownloadedFile(folder, ".mp4");

    if (!finalFile) {
        console.log("Aucun fichier MP4 trouvé après téléchargement !");
        throw new Error("Téléchargement échoué (pas de mp4 généré)");
    }

    console.log("MP4 créé :", finalFile);
    return finalFile;
}


module.exports = { downloadMP3, downloadMP4 };
