# EcoVerse — Gesture-Controlled Environmental Experience

A cinematic, touchless, React + Three.js installation for Environment Day exhibitions
and mall events. Visitors raise their hands to a webcam and trigger interactive
environmental scenes — planting forests, cleaning pollution, lighting cities, defeating
the carbon monster.

## Quick start

```bash
cd frontend
npm install     # one-time
npm run dev     # open the printed http://localhost:5173 URL
```

Open the URL in Chrome/Edge/Firefox and **allow camera access**. The webcam preview
appears in the bottom-left corner with a live hand-skeleton overlay.

> Open via the dev server URL, not by double-clicking `dist/index.html` —
> browsers block `getUserMedia` over `file://`.

Production build:

```bash
npm run build
npm run preview
```

## What's in the box

- **Home** (`/`) — cinematic hero with animated Earth, particle field, 6 module cards.
- **Pollution Cleaner** (`/pollution-cleaner`) — Three.js city scene; swipe / palm / fist gestures clear smoke, clean the river, halt factories, summon birds.
- **Plant the Future** (`/plant-future`) — Three.js forest growth; pinch to plant a tree, wave for rain, both hands up for a forest burst.
- **Ocean Cleanup, Energy Generator, Eco Rhythm, Carbon Monster** — themed shells with the live gesture playground (full scenes are the next milestone).
- **Ending** (`/ending`) — final cinematic Earth with the session's stats.

## Gestures

| Gesture          | Trigger                                         |
|------------------|-------------------------------------------------|
| 🖐 Open palm     | ≥4 fingers extended                             |
| ✊ Fist          | 0 fingers extended (also returns to Home from any module) |
| 🤏 Pinch         | Thumb + index tips within 5% normalized distance|
| ⬅ Swipe left    | Fast horizontal motion of index tip             |
| ➡ Swipe right   | Fast horizontal motion of index tip             |
| 👋 Wave          | ≥3 direction flips within 12 frames             |
| 🌀 Circle        | ≥1.4π angular sweep around the centroid        |
| 🙌 Both hands up | Two hands detected, both wrists in upper half   |

Classifier lives in `src/gesture/GestureClassifier.js` and runs against MediaPipe
Hands landmarks. MediaPipe is loaded over CDN from `index.html`.

## Sound

The audio loader is wired up but no audio files ship with the repo. Drop mp3s into
`public/sounds/` using the filenames listed in `public/sounds/README.md` — the app
will pick them up automatically. Missing files fail silently.

## Troubleshooting

- **Webcam preview is black** — your browser may not have permission. Click the
  camera icon in the address bar and allow access, then reload.
- **No gestures detected** — make sure your whole hand is in the camera view and
  well-lit. The MediaPipe model is loaded over CDN; if you're offline at the venue,
  vendor the model files to `public/`.
- **Performance on older laptops** — lower `modelComplexity` from `1` to `0` in
  `src/gesture/HandTracker.js`, and reduce particle counts in `Home.jsx` and
  `ParticleBackdrop.jsx`.
- **`Hands is not defined`** — the MediaPipe CDN script in `index.html` hasn't loaded.
  Check the browser console + network tab.

## Project layout

```
src/
  components/   Navbar, ModuleCard, GestureOverlay, EcoMeter, CursorGlow, ...
  pages/        Home, PollutionCleaner, PlantFuture, OceanCleanup, EnergyGenerator,
                EcoRhythm, CarbonMonster, Ending, _ModuleShell
  three/        EarthOrb, ParticleField, CityScene, ForestScene
  gesture/      HandTracker, GestureClassifier, GestureContext
  hooks/        useGesture, useSound, useScore, useTilt
  utils/        math, colors, audioLoader
  index.css     Tailwind + global eco theme
  App.jsx       Router + providers
```
