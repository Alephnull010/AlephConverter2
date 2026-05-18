const btnDownload = document.getElementById("download");
const btnMinimize = document.getElementById("minimize");
const btnClose = document.getElementById("close");
const inputUrl = document.getElementById("url");
const switchFormat = document.getElementById("formatSwitch");
const textStatus = document.getElementById("status");
const overlay = document.getElementById("overlay");
const overlayDownload = document.getElementById("overlayDownload");
const fxSlow   = document.getElementById("fxSlow");
const fxPreset = document.getElementById("fxPreset");

fxSlow.addEventListener("change", () => {
    fxPreset.classList.toggle("visible", fxSlow.checked);
});

btnDownload.onclick = async () => {
    const url = inputUrl.value.trim();
    if (!url) return;

    // === Overlay sélection dossier ===
    overlay.classList.add("show");
    const folder = await window.api.chooseFolder();
    overlay.classList.remove("show");

    if (!folder) {
        textStatus.innerText = "Selection cancelled.";
        return;
    }

    // === Overlay téléchargement ===
    overlayDownload.querySelector("p").innerText = "Downloading…";
    overlayDownload.classList.add("show");

    // slowReverb = nom du preset (string) si coché, null sinon
    const slowReverb = fxSlow.checked ? fxPreset.value : null;
    const format = switchFormat.checked ? "mp4" : "mp3";

    let result;

    if (format === "mp3") {
        result = await window.api.downloadMP3(url, folder, slowReverb);
    } else {
        result = await window.api.downloadMP4(url, folder, slowReverb);
    }

    // === FIN ===
    overlayDownload.classList.remove("show");

    if (result.success) {
        const filename = result.final.split(/[\\/]/).pop();
        textStatus.innerText = "✓ " + filename;
    } else {
        textStatus.innerText = "Error: " + (result.error || "Download failed");
    }
};


btnMinimize.onclick = () => window.api.windowControl("minimize");
btnClose.onclick = () => window.api.windowControl("close");
