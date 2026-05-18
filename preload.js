const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {

    chooseFolder: () => ipcRenderer.invoke("choose-folder"),

    downloadAudio: (url, folder, audioFormat, slowReverb) => ipcRenderer.invoke("download", {
        url,
        type: "audio",
        audioFormat,
        folder,
        slowReverb
    }),

    downloadVideo: (url, folder) => ipcRenderer.invoke("download", {
        url,
        type: "video",
        folder,
        slowReverb: null
    }),

    onPhase: (cb) => ipcRenderer.on("dl-phase", (_, phase) => cb(phase)),
    windowControl: (action) => ipcRenderer.send("window-control", action),
    cancelDownload: () => ipcRenderer.send("cancel-download"),
    openFile: (filePath) => ipcRenderer.invoke("open-file", filePath)
});
