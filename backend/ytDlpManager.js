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

    updateCallback("Vérification de la version...");

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
        console.log("💬", msg);
        updateCallback(msg);
    };

    log("Initialisation de yt-dlp…");

    if (!fs.existsSync(CACHE_DIR)) {
        log("Création du dossier local…");
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }

    const localVersion = fs.existsSync(VERSION_FILE)
        ? fs.readFileSync(VERSION_FILE, "utf8").trim()
        : null;

    log("Version locale : " + (localVersion || "aucune"));

    const latestVersion = await getLatestVersion(log);
    log("Version distante : " + latestVersion);

    if (fs.existsSync(CACHED_EXE) && localVersion === latestVersion) {
        log("yt-dlp déjà à jour ✓");
        return CACHED_EXE;
    }

    log("Téléchargement de yt-dlp…");
    const downloaded = await YTDlpWrap.downloadFromGithub(CACHED_EXE);

    log("Téléchargement terminé ✓");

    fs.writeFileSync(VERSION_FILE, latestVersion);
    log("yt-dlp mis à jour ✓");

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
