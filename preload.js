const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {

    chooseFolder: () => ipcRenderer.invoke("choose-folder"),

    downloadMP3: (url, folder, slowReverb) => ipcRenderer.invoke("download", {
        url,
        format: "mp3",
        folder,
        slowReverb
    }),

    downloadMP4: (url, folder, slowReverb) => ipcRenderer.invoke("download", {
        url,
        format: "mp4",
        folder,
        slowReverb
    }),


    // APPEL GENERIQUE
    download: (data) => ipcRenderer.invoke("download", data),

    windowControl: (action) => ipcRenderer.send("window-control", action)
});
