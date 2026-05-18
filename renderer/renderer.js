const btnDownload     = document.getElementById("download");
const btnMinimize     = document.getElementById("minimize");
const btnClose        = document.getElementById("close");
const btnCancel       = document.getElementById("btn-cancel");
const inputUrl        = document.getElementById("url");
const textStatus      = document.getElementById("status");
const dlStatus        = document.getElementById("dl-status");
const overlay         = document.getElementById("overlay");
const overlayDownload = document.getElementById("overlayDownload");
const fxSlow          = document.getElementById("fxSlow");
const fxPreset        = document.getElementById("fxPreset");
const fxWrapper       = document.querySelector(".fx-wrapper");
const fmtOptions = document.getElementById("fmtOptions");

document.querySelectorAll('input[name="mode-radio"]').forEach(radio => {
    radio.addEventListener("change", () => {
        const isAudio = radio.value === "audio";
        fmtOptions.classList.toggle("hidden", !isAudio);
        fxWrapper.style.visibility = isAudio ? "" : "hidden";
    });
});

window.api.onPhase(phase => { dlStatus.innerText = phase + "…"; });

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

    overlay.classList.add("show");
    const folder = await window.api.chooseFolder();
    overlay.classList.remove("show");

    if (!folder) {
        textStatus.innerText = "Selection cancelled.";
        return;
    }

    dlStatus.innerText = "Downloading…";
    btnCancel.disabled = false;
    btnCancel.innerText = "Cancel";
    overlayDownload.classList.add("show");

    const slowReverb = fxSlow.checked ? fxPreset.value : null;

    const currentMode = document.querySelector('input[name="mode-radio"]:checked').value;

    let result;
    if (currentMode === "video") {
        result = await window.api.downloadVideo(url, folder);
    } else {
        const audioFormat = document.querySelector('input[name="fmt-radio"]:checked').value;
        result = await window.api.downloadAudio(url, folder, audioFormat, slowReverb);
    }

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
