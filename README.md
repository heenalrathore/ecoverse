# 🌍 EcoVerse — Gesture-Controlled Environmental Experience

A **touchless, gesture-controlled** environmental experience built for Environment Day exhibitions and mall installations. Visitors raise their hands to a webcam, and a [MediaPipe](https://developers.google.com/mediapipe) hand-tracker turns finger counts into actions that drive cinematic [Three.js](https://threejs.org/) scenes — plant a forest, clean a polluted river, restore an ocean, and power a sustainable city.

No controllers, no touchscreens. Just your hands.

> Built with **React 19 + Vite**, **@react-three/fiber** (Three.js), MediaPipe Hands, Framer Motion, GSAP, and Howler.

---

## ✨ Features

- **Touchless gesture control** — finger-count based, designed to be robust under varied lighting, distances, and hand poses.
- **Five cinematic modules**, each a self-contained themed scene with its own gesture mapping, soundscape, and HUD.
- **Procedural, offline-safe 3D** — all textures are generated on the fly (no remote URLs to 404 mid-show).
- **Persistent eco-score** — health, oxygen, trees, and interactions accumulate across modules and reloads.
- **Glassmorphic HUD** with live stats, a gesture legend, and toast feedback per action.
- **Smooth route transitions** via Framer Motion.

---

## 🖐️ Gestures

The classifier is intentionally simple and **finger-count based** (see [`GestureClassifier.js`](frontend/src/gesture/GestureClassifier.js)). A gesture only fires after it stays steady for ~4 frames and a per-gesture cooldown (850 ms) elapses, preventing accidental triggers.

| Gesture | Fingers | Meaning |
| --- | --- | --- |
| ☝ `one_finger` | 1 | Primary action (plant / clean / energize) |
| ✌ `two_fingers` | 2 | Secondary action |
| 🤟 `three_fingers` | 3 | Tertiary action |
| 🖐 `five_fingers` | 4–5 (open palm) | Big / "restore everything" action |
| 🙌 `both_hands` | 2 hands | Bonus / ultimate finale action |
| ✊ `fist` | 0 | Exit back to home |

Exact effects differ per module — each page's HUD shows its own legend.

---

## 🧭 Modules

| Route | Module | What your hands do |
| --- | --- | --- |
| `/` | **Home** | Hub / module selector |
| `/plant-future` | **Plant the Future** | Grow trees, raise the sun, trigger snowfall, and battle a carbon monster |
| `/pollution-cleaner` | **Pollution Cleaner** | Clear smoke, cleanse the river, toggle factories, and restore blue skies |
| `/ocean-cleanup` | **Ocean Cleanup** | Collect plastic, grow coral, purify water, and bring sea life back |
| `/energy-generator` | **Energy Generator** | Light buildings, spin wind turbines, switch on solar, and overload the energy core |
| `/ending` | **Ending** | Closing / reward screen |

---

## 🚀 Getting Started

The entire app lives in **`frontend/`**. All commands run from there.

```bash
cd frontend
npm install      # one-time
npm run dev      # Vite dev server → http://localhost:5173
```

> ⚠️ **Open in a browser at `http://localhost` (or `https`), not `file://`** — the webcam API requires a secure/localhost context.

### Other commands

```bash
npm run build    # production build → dist/
npm run preview  # serve the built dist/
npm run lint     # ESLint (flat config: eslint.config.js)
```

There is no test runner configured. "Verifying a change" means: run `npm run lint`, run `npm run build`, and load the dev server in a browser to watch the scene and gestures behave.

---

## 🎥 Requirements

- A modern browser with **WebGL** and **webcam** support (Chrome / Edge recommended).
- A connected webcam, granted camera permission.
- **Internet access on first load** — MediaPipe Hands is loaded from a CDN (see below). For offline venues, vendor the model files locally.

---

## 🏗️ Architecture

### Gesture pipeline (the core input system)

Hand input flows through four layers:

1. **[`index.html`](frontend/index.html)** loads **MediaPipe Hands over CDN** as global `<script>` tags (`window.Hands`, `window.Camera`) — it is *not* an npm dependency. A `Hands is not defined` error means the CDN script didn't load.
2. **[`HandTracker.js`](frontend/src/gesture/HandTracker.js)** polls for those globals, runs the webcam through a hidden `<video>`, and emits raw hand landmarks.
3. **[`GestureContext.jsx`](frontend/src/gesture/GestureContext.jsx)** (`GestureProvider`, mounted once in [`App.jsx`](frontend/src/App.jsx)) owns the tracker, classifies every frame, and exposes `{ status, frame, lastGestureRef }` via React context.
4. **[`GestureClassifier.js`](frontend/src/gesture/GestureClassifier.js)** counts fingers and fires a gesture once steady + past cooldown. Pages subscribe via the **[`useGesture(cb)`](frontend/src/hooks/useGesture.js)** hook, which calls `cb(gestureName, frame)` once per distinct fired gesture.

### Pages are self-contained modules

Each route in `src/pages/` wires together: a Three.js scene it drives imperatively, `useGesture` handlers that call scene methods + `bump()` the score + `play()` a sound + show a toast, and a glass HUD. **`PlantFuture` + `ForestScene` is the best reference** for the scene pattern.

### Three.js scenes (`src/three/`)

Built as `@react-three/fiber` `forwardRef` components exposing an imperative API the page calls from gesture callbacks. Conventions:

- Heavy use of **`InstancedMesh`** with matrices recomputed each frame in `useFrame`.
- **All textures are generated procedurally** (`<canvas>` → `THREE.CanvasTexture`) — deliberately offline-safe. Do **not** introduce CDN/remote texture URLs in scenes.

### Cross-cutting state & assets

- **Score** ([`useScore.js`](frontend/src/hooks/useScore.js)) — a module-level singleton persisted to `localStorage` (`ecoverse:score:v1`); `bump({health, oxygen, trees, interactions})` mutates it globally across routes and reloads.
- **Sound** ([`useSound.js`](frontend/src/hooks/useSound.js)) — Howler-based; files live in `public/sounds/<name>.mp3`. **Missing files fail silently** (a no-op, not an error), so no audio ships with the repo.
- **Theming** ([`utils/colors.js`](frontend/src/utils/colors.js)) — per-module themes; styling is Tailwind with a custom eco theme (`bg-eco-deep`, `glass`/`glass-strong`).

---

## 📁 Project Structure

```
EVS/
├── CLAUDE.md                 # Guidance for AI coding assistants
├── README.md
└── frontend/
    ├── index.html            # Loads MediaPipe Hands via CDN
    ├── package.json
    ├── eslint.config.js
    ├── public/
    │   └── sounds/           # <name>.mp3 (optional, fail silently if absent)
    └── src/
        ├── App.jsx           # Routes + providers
        ├── main.jsx
        ├── gesture/          # HandTracker, GestureContext, GestureClassifier
        ├── hooks/            # useGesture, useScore, useSound, useCanvasScene, …
        ├── pages/            # Home, PlantFuture, PollutionCleaner, OceanCleanup, EnergyGenerator, Ending
        ├── three/            # @react-three/fiber scenes (ForestScene, CityScene, …)
        ├── components/       # Navbar, HUD, overlays, EcoMeter, …
        └── utils/            # colors, math, audioLoader, synth
```

---

## 🛠️ Tech Stack

| Area | Tech |
| --- | --- |
| Framework | React 19, Vite 8 |
| 3D | Three.js 0.184, @react-three/fiber 9, @react-three/drei 10 |
| Hand tracking | MediaPipe Hands (CDN) |
| Animation | Framer Motion, GSAP |
| Audio | Howler |
| Routing | React Router 7 |
| Styling | TailwindCSS 3 |
| Tooling | ESLint 10 |

---

## 🔧 Troubleshooting

- **`Hands is not defined`** → the MediaPipe CDN script didn't load. Check your internet connection, or vendor the model files into `public/` for offline use.
- **Camera not starting** → ensure you're on `http://localhost` / HTTPS (not `file://`) and that camera permission is granted.
- **No sound** → sound files are optional; drop `.mp3` files into `frontend/public/sounds/` to enable audio.
- **Black / crashing 3D scene** → check the browser console; the dev server also relays browser `console.*` output to its stdout.

---

## 📦 Deployment

```bash
cd frontend
npm run build      # outputs to frontend/dist/
```

Serve the static `dist/` folder from any web host over **HTTPS** (required for camera access). For kiosk installations, point the host browser at the deployed URL in fullscreen / kiosk mode.

---

*Built for Environment Day. Wave your hands — heal the planet. 🌱*
