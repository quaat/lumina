<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Lumina MIDI

Lumina is a browser-based MIDI visualizer and player. Load a `.mid`/`.midi` file to explore it in a classic 2D piano roll or a 3D “highway” view, with optional Web MIDI output to external devices.

## Features
- Visualize MIDI in 2D scroll or 3D highway projection.
- Color notes by track or by pitch class.
- Per-track mute and hide controls.
- MIDI playback controls: play/pause, stop, scrub, and speed.
- Pitch range tools: auto-fit to content, zoom in/out, reset, or full-range.
- MIDI file info modal with duration, BPM, time signatures, and tempo map.
- Web MIDI input for transport control (start/stop) and key highlighting.

## Project Contents
- `App.tsx`: Main playback scheduler, state, and app layout.
- `components/`: UI for sidebar, piano roll, view settings, transport, and modals.
- `services/`: MIDI parsing, Web MIDI I/O, key layout geometry, and note coloring.
- `types.ts`: Shared type definitions.

## Requirements
- Node.js (recommended: current LTS).
- A browser with Web MIDI support (Chrome/Edge) if you want MIDI input/output.
  - Web MIDI generally requires running on `https://` or `http://localhost`.

## Install
```bash
npm install
```

## Run (Dev)
```bash
npm run dev
```
Vite prints the local URL in the terminal (usually `http://localhost:5173`).

## Build and Preview
```bash
npm run build
npm run preview
```
