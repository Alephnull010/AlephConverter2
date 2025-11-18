const { parentPort } = require("worker_threads");
const { applySlowReverb } = require("./audioprocessor");

parentPort.on("message", async (inputPath) => {
    try {
        const output = await applySlowReverb(inputPath);
        parentPort.postMessage({ success: true, output });
    } catch (e) {
        parentPort.postMessage({ success: false, error: e.message });
    }
});
