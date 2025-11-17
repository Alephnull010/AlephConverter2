const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("splashAPI", {
    onUpdate: (cb) => ipcRenderer.on("update-text", (_, msg) => cb(msg))
});
