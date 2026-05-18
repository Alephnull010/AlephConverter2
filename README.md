# AlephConverter2

**AlephConverter2** is a desktop application for downloading audio and video from URLs.

It supports fast downloads from most platforms *(YouTube, SoundCloud, Twitch, Reddit, Instagram, Facebook, and [many more](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md))*, with optional audio processing.  
The application is intentionally minimalist, focusing on simplicity and ease of use.

---

## Features

### Downloading
- **Audio / Video mode** — switch between audio and video download with a single click
- **Audio format selection** — choose between No conversion (keeps original format), MP3, M4A, or FLAC
- **MP4** video download at best available quality
- Full **playlist** support
- Automatic **yt-dlp** update at launch, ensuring long-term platform compatibility

### Audio Processing
- Optional **Slow + Reverb** effect with 4 presets:
  - `warm` — intimate & cozy
  - `dreamy` — atmospheric & trippy
  - `elegant` — natural & refined
  - `liquid` — deep & immersive
- Output is encoded as MP3 at 320 kbps regardless of the selected format — quality loss is negligible
- Processing runs in a background thread — the UI stays responsive throughout

### User Experience
- **Live phase indicator** — shows the current step: Downloading, Converting, Reverbizing
- **Cancel button** — abort any download or processing at any time
- **Click the filename** to reveal the output file in Explorer
- Handles accented and non-Latin filenames correctly (Arabic, Chinese, Russian, etc.)

---

## Stack

- **Electron** — desktop application framework
- **yt-dlp** — media downloading engine (auto-updated at launch)
- **ffmpeg** — audio/video encoding and pitch-shifting
- **Node.js** — backend logic and Worker Threads for non-blocking processing
- **Freeverb** — reverb engine in pure JavaScript, based on the Jezar at Dreampoint algorithm

---

## Application Preview

<p align="center">
  <img src="https://github.com/user-attachments/assets/8717da64-3fcd-4bbd-9ab7-098eb6035b0b" width="50%" alt="AlephConverter2 interface">
</p>

---

## Run from source

```bash
git clone https://github.com/Alephnull010/AlephConverter2.git
cd AlephConverter2
npm install
npm start
```

> Requires [Node.js](https://nodejs.org/) and a working internet connection (yt-dlp is downloaded automatically on first launch).

---

## Build

```bash
npm run build
```

Produces a Windows installer via `electron-builder` in the `dist/` folder.

---

## License

MIT
