# AlephConverter2

**AlephConverter2** is a desktop application designed to convert **URLs into MP3 or MP4 files**.

It supports fast conversions *(depending on your connection speed)* from most audio and video platforms *(SoundCloud, YouTube, Twitch, Reddit, Instagram, Facebook, etc.)*.  
One of its key strengths is an **automatic yt-dlp update system**, ensuring long-term compatibility.

The application is intentionally minimalist, focusing on simplicity and ease of use.

---

## Features

- MP3 conversion at best quality (320 kbps via ffmpeg)
- MP4 conversion at best available quality
- Full **playlist conversion** support
- Supports a wide range of platforms *(full list: [yt-dlp supported sites](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md))*
- Automatic **yt-dlp** and **app** update system
- Optional **Slow + Reverb** audio processing with 4 presets:
  - `warm` — intimate & cozy
  - `dreamy` — atmospheric & trippy
  - `elegant` — natural & refined
  - `liquid` — deep & immersive

---

## Stack

- **Electron** — desktop application framework
- **yt-dlp** — media downloading engine (auto-updated at launch)
- **ffmpeg** — audio/video encoding and pitch-shifting
- **Node.js** — backend logic
- **Freeverb** — reverb engine implemented in pure JavaScript (no DSP dependencies), based on the Jezar at Dreampoint algorithm

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
