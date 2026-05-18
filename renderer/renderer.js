const btnDownload = document.getElementById("download");
const btnMinimize = document.getElementById("minimize");
const btnClose    = document.getElementById("close");
const btnCancel   = document.getElementById("btn-cancel");
const inputUrl    = document.getElementById("url");
const switchFormat = document.getElementById("formatSwitch");
const textStatus  = document.getElementById("status");
const dlStatus    = document.getElementById("dl-status");
const overlay     = document.getElementById("overlay");
const overlayDownload = document.getElementById("overlayDownload");
const fxSlow   = document.getElementById("fxSlow");
const fxPreset = document.getElementById("fxPreset");

fxSlow.addEventListener("change", () => {
    fxPreset.classList.toggle("visible", fxSlow.checked);
});

btnCancel.onclick = () => {
    window.api.cancelDownload();
    btnCancel.disabled = true;
    btnCancel.innerText = "Cancelling…";
};

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
    dlStatus.innerText = "Downloading…";
    btnCancel.disabled = false;
    btnCancel.innerText = "Cancel";
    overlayDownload.classList.add("show");

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

    if (result.cancelled) {
        textStatus.innerText = "Cancelled.";
        textStatus.dataset.path = "";
        textStatus.classList.remove("clickable");
    } else if (result.success) {
        const filename = result.final.split(/[\\/]/).pop();
        textStatus.innerText = "✓ " + filename;
        textStatus.dataset.path = result.final;
        textStatus.classList.add("clickable");
    } else {
        textStatus.innerText = "Error: " + (result.error || "Download failed");
        textStatus.dataset.path = "";
        textStatus.classList.remove("clickable");
    }
};


textStatus.onclick = () => {
    if (textStatus.dataset.path) window.api.openFile(textStatus.dataset.path);
};

btnMinimize.onclick = () => window.api.windowControl("minimize");
btnClose.onclick    = () => window.api.windowControl("close");
