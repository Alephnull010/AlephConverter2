const YTDlpWrap = require("yt-dlp-wrap").default;
const fs = require("fs");
const path = require("path");
const https = require("https");

const CACHE_DIR = path.join(process.env.LOCALAPPDATA, "AlephConverter", "bin");
const CACHED_EXE = path.join(CACHE_DIR, "yt-dlp.exe");
const VERSION_FILE = path.join(CACHE_DIR, "version.txt");

// ==========================================
// Récupération version distante
// ==========================================
async function getLatestVersion(updateCallback = () => {}) {
    const url = "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest";

    updateCallback("Checking for updates...");

    return new Promise((resolve, reject) => {
        https.get(url, { headers: { "User-Agent": "AlephConverter" } }, res => {
            let data = "";
            res.on("data", chunk => data += chunk);
            res.on("end", () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json.tag_name);
                } catch (err) {
                    reject(err);
                }
            });
        }).on("error", reject);
    });
}

// ==========================================
// Mise à jour yt-dlp
// ==========================================
async function initYtDlp(updateCallback = () => {}) {

    const log = (msg) => {
        console.log("YTDLP", msg);
        updateCallback(msg);
    };

    log("Initializing yt-dlp…");

    if (!fs.existsSync(CACHE_DIR)) {
        log("Creating local folder…");
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }

    const localVersion = fs.existsSync(VERSION_FILE)
        ? fs.readFileSync(VERSION_FILE, "utf8").trim()
        : null;

    log("Local version: " + (localVersion || "none"));

    const latestVersion = await getLatestVersion(log);
    log("Remote version: " + latestVersion);

    if (fs.existsSync(CACHED_EXE) && localVersion === latestVersion) {
        log("yt-dlp already up to date ✓");
        return CACHED_EXE;
    }

    log("Downloading yt-dlp…");
    const downloaded = await YTDlpWrap.downloadFromGithub(CACHED_EXE);

    log("Download complete ✓");

    fs.writeFileSync(VERSION_FILE, latestVersion);
    log("yt-dlp updated ✓");

    return downloaded;
}

// ==========================================
// Vérifier si MAJ nécessaire
// ==========================================
async function needsUpdate() {
    if (!fs.existsSync(CACHED_EXE) || !fs.existsSync(VERSION_FILE))
        return true;

    const localVersion = fs.readFileSync(VERSION_FILE, "utf8").trim();
    const latestVersion = await getLatestVersion(() => {});

    return localVersion !== latestVersion;
}

module.exports = { initYtDlp, needsUpdate };
