const { parentPort, workerData } = require("worker_threads");
const { applySlowReverb } = require("./audioProcessor");

const { inputPath, presetName, ffmpegBin } = workerData;

let cancelFn = null;
let cancelRequested = false;

parentPort.on("message", (msg) => {
    if (msg === "cancel") {
        cancelRequested = true;
        if (cancelFn) cancelFn();
    }
});

applySlowReverb(inputPath, presetName, {
    ffmpegBin,
    setCancelFn: (fn) => {
        cancelFn = fn;
        if (cancelRequested && fn) fn();
    },
    onPhase: (phase) => parentPort.postMessage({ type: "phase", phase })
})
    .then(output => parentPort.postMessage({ type: "done", output }))
    .catch(err => parentPort.postMessage({ type: "error", message: err.message, cancelled: !!err.cancelled }));
