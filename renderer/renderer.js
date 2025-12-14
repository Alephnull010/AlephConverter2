const btnDownload = document.getElementById("download");
const btnMinimize = document.getElementById("minimize");
const btnClose = document.getElementById("close");
const inputUrl = document.getElementById("url");
const switchFormat = document.getElementById("formatSwitch");
const textStatus = document.getElementById("status");
const overlay = document.getElementById("overlay");
const overlayDownload = document.getElementById("overlayDownload");
const fxSlow = document.getElementById("fxSlow");

btnDownload.onclick = async () => {
    const url = inputUrl.value.trim();
    if (!url) return;

    // === Overlay sélection dossier ===
    overlay.classList.add("show");
    const folder = await window.api.chooseFolder();
    overlay.classList.remove("show");

    if (!folder) {
        textStatus.innerText = "Sélection annulée.";
        return;
    }

    // === Overlay téléchargement ===
    overlayDownload.querySelector("p").innerText = "Téléchargement…";
    overlayDownload.classList.add("show");

    const slow = fxSlow.checked;
    const format = switchFormat.checked ? "mp4" : "mp3";

    let result;

    if (format === "mp3") {
        result = await window.api.downloadMP3(url, folder, slow);
    } else {
        result = await window.api.downloadMP4(url, folder, slow);
    }

    // === FIN ===
    overlayDownload.classList.remove("show");
    textStatus.innerText = result;
};


btnMinimize.onclick = () => window.api.windowControl("minimize");
btnClose.onclick = () => window.api.windowControl("close");
