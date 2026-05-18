const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const freeverb = require("./freeverb");

const PRESETS = {
  warm:    { slowRate: 0.85, roomSize: 0.4,  damping: 0.2,  wet: 0.44, dry: 0.55, width: 0.5, preDelayMs: 20, lfoDepth: 5,  erWet: 0.12 },
  dreamy:  { slowRate: 0.80, roomSize: 0.6,  damping: 0.55, wet: 0.35, dry: 0.50, width: 1.0, preDelayMs: 45, lfoDepth: 8,  erWet: 0.10 },
  elegant: { slowRate: 0.90, roomSize: 0.60, damping: 0.72, wet: 0.22, dry: 0.65, width: 0.7, preDelayMs: 12, lfoDepth: 3,  erWet: 0.15 },
  liquid:  { slowRate: 0.75, roomSize: 0.90, damping: 0.9,  wet: 0.50, dry: 0.60, width: 1.0, preDelayMs: 40, lfoDepth: 10, erWet: 0.08 },
};

function runFFmpeg(args, setCancelFn, ffmpegBin) {
  return new Promise((resolve, reject) => {
    let killed = false;
    const proc = execFile(ffmpegBin, args, (err, _stdout, stderr) => {
      if (killed) return reject(Object.assign(new Error("cancelled"), { cancelled: true }));
      if (err) {
        console.error("FFmpeg error:", stderr);
        return reject(err);
      }
      resolve();
    });
    if (setCancelFn) setCancelFn(() => { killed = true; proc.kill(); });
  });
}

async function applySlowReverb(inputPath, presetName = "warm", opts = {}) {
  const { setCancelFn, ffmpegBin = require("ffmpeg-static") } = opts;
  const settings = PRESETS[presetName] ?? PRESETS.warm;

  const dir  = path.dirname(inputPath);
  const base = path.basename(inputPath, path.extname(inputPath));

  const slowWavPath   = path.join(dir, `${base}_slow_tmp.wav`);
  const reverbWavPath = path.join(dir, `${base}_reverb_tmp.wav`);
  const outputPath    = path.join(dir, `${base} [slow+reverb - ${presetName}].mp3`);

  const sampleRate = 44100;
  const targetRate = Math.round(sampleRate * settings.slowRate);

  try {
    // Étape 1 : ralentissement + décalage de pitch (FFmpeg)
    await runFFmpeg([
      "-y", "-i", inputPath,
      "-filter:a", [
        `aformat=sample_fmts=s16:sample_rates=${sampleRate}:channel_layouts=stereo`,
        `asetrate=${targetRate}`,
        `aresample=${sampleRate}`,
      ].join(","),
      "-ac", "2", "-ar", String(sampleRate),
      slowWavPath,
    ], setCancelFn, ffmpegBin);

    // Étape 2 : reverb Freeverb (synchrone, non annulable)
    if (setCancelFn) setCancelFn(null);
    freeverb.processFile(slowWavPath, reverbWavPath, settings);

    // Étape 3 : encodage MP3 (FFmpeg)
    await runFFmpeg([
      "-y", "-i", reverbWavPath,
      "-b:a", "320k",
      outputPath,
    ], setCancelFn, ffmpegBin);

  } finally {
    if (fs.existsSync(slowWavPath))   fs.unlinkSync(slowWavPath);
    if (fs.existsSync(reverbWavPath)) fs.unlinkSync(reverbWavPath);
  }

  return outputPath;
}

module.exports = { applySlowReverb };
