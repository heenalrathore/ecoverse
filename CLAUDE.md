# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**EcoVerse** — a touchless, gesture-controlled environmental experience for Environment Day exhibitions / mall installations. Visitors raise their hands to a webcam and a MediaPipe hand-tracker turns finger counts into actions that drive cinematic Three.js scenes (plant a forest, clean pollution, etc.). React 19 + Vite SPA.

The entire app lives in **`frontend/`**. All commands below run from there.

## Commands

```bash
cd frontend
npm install            # one-time
npm run dev            # Vite dev server on http://localhost:5173 (open in a browser; camera needs http/localhost, not file://)
npm run build          # production build → dist/
npm run preview        # serve the built dist/
npm run lint           # ESLint (flat config: eslint.config.js)
```

There is **no test runner** configured (no `test` script, no test files). "Verifying a change" here means: `npm run lint`, `npm run build`, and loading the dev server in a browser to watch the scene/gesture behave. The dev server relays browser `console.*` output to its stdout, which is the main way to catch runtime errors when iterating.

## Architecture (the parts that span multiple files)

### Gesture pipeline — the core input system
Hand input flows through four layers; understand all four before touching gestures:

1. **MediaPipe Hands is loaded over CDN as global `<script>` tags in [frontend/index.html](frontend/index.html)** (`window.Hands`, `window.Camera`) — it is **not** an npm dependency. [HandTracker.js](frontend/src/gesture/HandTracker.js) polls for those globals before starting, runs the webcam through a hidden `<video>`, and emits raw landmark results. A `Hands is not defined` error means the CDN script didn't load; offline venues must vendor the model files into `public/`.
2. **[GestureContext.jsx](frontend/src/gesture/GestureContext.jsx)** (`GestureProvider`, mounted once in [App.jsx](frontend/src/App.jsx)) owns the tracker, runs every frame through the classifier, and exposes `{ status, frame, lastGestureRef }` via React context. `frame` is per-frame state (landmarks, finger count, hands); `lastGestureRef` holds the most recent *fired* gesture + timestamp.
3. **[GestureClassifier.js](frontend/src/gesture/GestureClassifier.js)** is **finger-count based**, intentionally simple for robustness: `fist` (0), `one_finger`, `two_fingers`, `three_fingers`, `five_fingers` (4–5), and `both_hands` (2 hands). A gesture only fires after `STEADY_FRAMES` (4) identical frames **and** a per-gesture `COOLDOWN_MS` (850ms). ⚠️ The README's richer table (pinch/swipe/wave/circle) is aspirational — trust the classifier code, which only counts fingers.
4. **[useGesture(cb)](frontend/src/hooks/useGesture.js)** is what pages subscribe to. It calls `cb(gestureName, frame)` **once per distinct fired gesture** (deduped on timestamp), not every frame. Pages `switch` on the gesture name.

### Pages are self-contained "modules"
Each route in [App.jsx](frontend/src/App.jsx) (`/plant-future`, `/pollution-cleaner`, …) is a themed module page in `src/pages/`. The consistent pattern a page wires together:
- a **Three.js scene** (`<Canvas>` + a scene component) it drives imperatively,
- **`useGesture`** handlers that call the scene's imperative methods + `bump()` the score + `play()` a sound + show a toast,
- a glass HUD (Tailwind) with stats and the gesture legend.
`PlantFuture` + `ForestScene` is the most fully-developed module and the best reference for the scene pattern.

### Three.js scenes (`src/three/`) — imperative-ref + offline-procedural
Scenes are `@react-three/fiber` components built as `forwardRef` + `useImperativeHandle` exposing an **imperative API the page calls from gesture callbacks** (e.g. `ForestScene` → `plantTree/plantBurst/rain/sunlight/snow/reset`). Conventions that matter here:
- **Heavy use of `InstancedMesh`** with matrices recomputed each frame in `useFrame` (a shared `THREE.Object3D` dummy); visibility is driven by `mesh.count`.
- **All textures are generated procedurally on a `<canvas>` → `THREE.CanvasTexture`** — deliberately **offline-safe**. Do not introduce CDN/remote texture URLs in scenes: they can 404 and crash the Canvas via Suspense.
- Scene-specific gotchas already encoded in `ForestScene`: drei `<Sky>` is three-stdlib's *classic* Sky — animate the sunrise by copying into `skyRef.current.material.uniforms.sunPosition.value` each frame (the prop is only applied once at mount); `alphaMap` samples the texture's **green** channel; `<Canvas shadows="percentage">` because three 0.184 deprecated `PCFSoftShadowMap`.

### Cross-cutting state & assets
- **Score** ([useScore.js](frontend/src/hooks/useScore.js)) is a **module-level singleton** (not React-tree state) persisted to `localStorage` under `ecoverse:score:v1`, fanned out to subscribers via a listener `Set`. `bump({health,oxygen,trees,interactions})` mutates it globally; it persists across routes and reloads.
- **Sound** ([useSound.js](frontend/src/hooks/useSound.js) + [utils/audioLoader.js](frontend/src/utils/audioLoader.js)) is Howler-based; files live in `public/sounds/<name>.mp3`. No audio ships with the repo and **missing files fail silently** — `play('x')` for an absent file is a no-op, not an error.
- **Per-module theming** lives in [utils/colors.js](frontend/src/utils/colors.js) (`MODULE_THEMES` keyed by module). Styling is Tailwind with a custom eco theme (`bg-eco-deep`, `text-eco-ink`, `glass`/`glass-strong` utilities); route/page transitions use Framer Motion (`AnimatePresence` in App.jsx), and GSAP is available for finer animation.

## Stack notes
React 19 · Vite 8 · @react-three/fiber 9 + drei 10 + three 0.184 · framer-motion · gsap · howler · react-router 7 · TailwindCSS 3. When adding Three.js code, match the installed versions' APIs (they move fast) and keep scenes offline-safe and instanced.
