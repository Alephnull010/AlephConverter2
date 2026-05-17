"use strict";
/**
 * Freeverb — implémentation Node.js pure (algorithme Jezar at Dreampoint)
 *
 * 8 comb filters parallèles + 4 allpass filters en série, stéréo.
 * Même algorithme que Fruity Reeverb 2 / Freeverb VST.
 *
 * Aucune dépendance externe — lecture/écriture WAV via Buffer natif.
 */

const fs = require("fs");

// ─── Délais Freeverb standard @ 44100 Hz ────────────────────────────────────
const COMB_DELAYS_L    = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const ALLPASS_DELAYS_L = [556, 441, 341, 225];
const STEREO_SPREAD    = 23; // décalage R vs L (constant Jezar)

// ─── Constantes internes ─────────────────────────────────────────────────────
const FIXED_GAIN    = 0.015; // gain après sommation des 8 combs — NE PAS TOUCHER
const ALLPASS_FEED  = 0.5;   // feedback fixe des allpass (constant Jezar)
const ROOM_OFFSET   = 0.7;
const ROOM_SCALE    = 0.28;
const DAMP_SCALE    = 0.4;

// ─── CombFilter ──────────────────────────────────────────────────────────────

class CombFilter {
  constructor(size) {
    this.buffer      = new Float64Array(size);
    this.pos         = 0;
    this.feedback    = 0;
    this.damp1       = 0;
    this.damp2       = 1;
    this.filterStore = 0;
  }

  setFeedback(f) { this.feedback = f; }
  setDamp(d)     { this.damp1 = d; this.damp2 = 1 - d; }

  process(input) {
    const output = this.buffer[this.pos];
    this.filterStore = output * this.damp2 + this.filterStore * this.damp1;
    this.buffer[this.pos] = input + this.filterStore * this.feedback;
    this.pos = (this.pos + 1) % this.buffer.length;
    return output;
  }
}

// ─── AllpassFilter ───────────────────────────────────────────────────────────

class AllpassFilter {
  constructor(size) {
    this.buffer = new Float64Array(size);
    this.pos    = 0;
  }

  process(input) {
    const bufOut = this.buffer[this.pos];
    const output = -input + bufOut;
    this.buffer[this.pos] = input + bufOut * ALLPASS_FEED;
    this.pos = (this.pos + 1) % this.buffer.length;
    return output;
  }
}

// ─── Lecteur WAV ─────────────────────────────────────────────────────────────

function readWav(filePath) {
  const buf = fs.readFileSync(filePath);

  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Fichier WAV invalide : header RIFF/WAVE attendu");
  }

  let fmt = null;
  let dataOffset = -1;
  let dataSize   = -1;
  let pos = 12;

  while (pos < buf.length - 8) {
    const chunkId   = buf.toString("ascii", pos, pos + 4);
    const chunkSize = buf.readUInt32LE(pos + 4);

    if (chunkId === "fmt ") {
      const audioFormat   = buf.readUInt16LE(pos + 8);
      const numChannels   = buf.readUInt16LE(pos + 10);
      const sampleRate    = buf.readUInt32LE(pos + 12);
      const bitsPerSample = buf.readUInt16LE(pos + 22);

      if (audioFormat !== 1)    throw new Error(`WAV non-PCM non supporté (audioFormat=${audioFormat})`);
      if (numChannels !== 2)    throw new Error(`Stéréo requis (channels=${numChannels})`);
      if (bitsPerSample !== 16) throw new Error(`16-bit requis (bits=${bitsPerSample})`);
      if (sampleRate !== 44100) throw new Error(`44100 Hz requis (rate=${sampleRate})`);

      fmt = { numChannels, sampleRate, bitsPerSample };
    } else if (chunkId === "data") {
      dataOffset = pos + 8;
      dataSize   = chunkSize;
      break;
    }

    pos += 8 + chunkSize;
    if (chunkSize % 2 !== 0) pos++;
  }

  if (!fmt)           throw new Error("Chunk fmt introuvable");
  if (dataOffset < 0) throw new Error("Chunk data introuvable");

  const numFrames = Math.floor(dataSize / 4);
  const left  = new Float64Array(numFrames);
  const right = new Float64Array(numFrames);

  for (let i = 0; i < numFrames; i++) {
    left[i]  = buf.readInt16LE(dataOffset + i * 4)     / 32768.0;
    right[i] = buf.readInt16LE(dataOffset + i * 4 + 2) / 32768.0;
  }

  return { numFrames, left, right };
}

// ─── Écrivain WAV ────────────────────────────────────────────────────────────

function writeWav(filePath, left, right) {
  const numFrames = left.length;
  const dataSize  = numFrames * 4;
  const buf       = Buffer.allocUnsafe(44 + dataSize);

  buf.write("RIFF",  0, "ascii");
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE",  8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16,        16);
  buf.writeUInt16LE(1,         20);
  buf.writeUInt16LE(2,         22);
  buf.writeUInt32LE(44100,     24);
  buf.writeUInt32LE(44100 * 4, 28);
  buf.writeUInt16LE(4,         32);
  buf.writeUInt16LE(16,        34);
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataSize,  40);

  for (let i = 0; i < numFrames; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i]))  * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i])) * 32767), 44 + i * 4 + 2);
  }

  fs.writeFileSync(filePath, buf);
}

// ─── Freeverb ────────────────────────────────────────────────────────────────

/**
 * @param {string} inputWavPath   WAV 16-bit stéréo 44100 Hz
 * @param {string} outputWavPath
 * @param {object} opts
 * @param {number} opts.roomSize    0.0–1.0
 * @param {number} opts.damping     0.0–1.0
 * @param {number} opts.wet         0.0–1.0
 * @param {number} opts.dry         0.0–1.0
 * @param {number} opts.width       0.0–1.0
 * @param {number} opts.preDelayMs  ms
 */
function processFile(inputWavPath, outputWavPath, opts) {
  const {
    roomSize   = 0.75,
    damping    = 0.55,
    wet        = 0.33,
    dry        = 0.40,
    width      = 1.0,
    preDelayMs = 20,
  } = opts;

  const scaledRoom = roomSize * ROOM_SCALE + ROOM_OFFSET;
  const scaledDamp = damping  * DAMP_SCALE;
  const wet1 = wet * (width / 2 + 0.5);
  const wet2 = wet * (1 - width) / 2;

  const combL = COMB_DELAYS_L.map(d => new CombFilter(d));
  const combR = COMB_DELAYS_L.map(d => new CombFilter(d + STEREO_SPREAD));
  for (const c of [...combL, ...combR]) {
    c.setFeedback(scaledRoom);
    c.setDamp(scaledDamp);
  }

  const apL = ALLPASS_DELAYS_L.map(d => new AllpassFilter(d));
  const apR = ALLPASS_DELAYS_L.map(d => new AllpassFilter(d + STEREO_SPREAD));

  const preDelaySamples = Math.max(0, Math.round(preDelayMs / 1000 * 44100));
  let pdBufL, pdBufR, pdPos;
  if (preDelaySamples > 0) {
    pdBufL = new Float64Array(preDelaySamples);
    pdBufR = new Float64Array(preDelaySamples);
    pdPos  = 0;
  }

  const { numFrames, left: inL, right: inR } = readWav(inputWavPath);
  const outL = new Float64Array(numFrames);
  const outR = new Float64Array(numFrames);

  for (let i = 0; i < numFrames; i++) {
    let inputL = inL[i];
    let inputR = inR[i];

    if (preDelaySamples > 0) {
      const delayedL = pdBufL[pdPos];
      const delayedR = pdBufR[pdPos];
      pdBufL[pdPos]  = inputL;
      pdBufR[pdPos]  = inputR;
      pdPos          = (pdPos + 1) % preDelaySamples;
      inputL = delayedL;
      inputR = delayedR;
    }

    let leftOut  = 0;
    let rightOut = 0;
    for (let j = 0; j < 8; j++) {
      leftOut  += combL[j].process(inputL);
      rightOut += combR[j].process(inputR);
    }

    leftOut  *= FIXED_GAIN;
    rightOut *= FIXED_GAIN;

    for (let j = 0; j < 4; j++) {
      leftOut  = apL[j].process(leftOut);
      rightOut = apR[j].process(rightOut);
    }

    outL[i] = leftOut  * wet1 + rightOut * wet2 + inL[i] * dry;
    outR[i] = rightOut * wet1 + leftOut  * wet2 + inR[i] * dry;
  }

  // Normalisation si le peak dépasse 0.95
  let peak = 0;
  for (let i = 0; i < numFrames; i++) {
    const p = Math.max(Math.abs(outL[i]), Math.abs(outR[i]));
    if (p > peak) peak = p;
  }
  if (peak > 0.95) {
    const scale = 0.95 / peak;
    for (let i = 0; i < numFrames; i++) {
      outL[i] *= scale;
      outR[i] *= scale;
    }
  }

  writeWav(outputWavPath, outL, outR);
}

module.exports = { processFile };
