import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sky, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Realistic forest scene — "Plant the Future".
 *
 * Fully real-time, fully offline (every texture is generated procedurally on a <canvas>):
 *   • Real atmospheric SKY + sunrise (drei <Sky>, sun uniform animated each frame).
 *   • Real 3D TREES that grow small → big: tiny shoot → trunk extends & thickens →
 *     branches unfurl → twigs sprout → layered leafy canopy fills in. Each tree is a
 *     tapered bark trunk + 5 branches + 10 twigs + 11 foliage clusters, all instanced.
 *   • Real 3D SNOW: hundreds of instanced solid flakes falling with drift, sway & tumble,
 *     recycled at the top. Always gently snowing; ✊ fist boosts a heavier snowfall.
 *   • Undulating ground, camera-facing grass tufts, rain, drifting clouds, pollen, shadows.
 *
 * Perf: instance visibility is driven by InstancedMesh.count (unwritten slots never render);
 * a tree's "wood" (trunk/branch/twig) matrices are frozen once it finishes growing, so a
 * static forest only re-uploads the swaying foliage + falling snow.
 *
 * Imperative API (via ref):
 *   plantTree(x?) -> bool | plantBurst() -> number | rain() | sunlight()
 *   snow() -> bool (toggles heavy) | setSnow(on) | treesCount() -> number | reset()
 */

const MAX = 180;
const BRANCHES_PER = 5;
const TWIGS_PER = 10;        // 2 twigs per branch
const FOLIAGE_PER = 11;      // crownTop + crownUnder + skirt + 3 lobes + 5 twig-tips
const TOTAL_BRANCH = MAX * BRANCHES_PER;    // 900
const TOTAL_TWIG = MAX * TWIGS_PER;         // 1800
const TOTAL_FOLIAGE = MAX * FOLIAGE_PER;    // 1980
const TUFT_COUNT = 240;
const GROUND_Y = -1.6;
const GROWTH_MS = 2600;
const MIN_DIST = 1.5;         // min spacing between single-planted mini trees (centre-to-centre)
const MIN_DIST_BURST = 1.15;  // tighter spacing for a dense expansion cluster

// snow
const SNOW_AMBIENT = 220;
const SNOW_HEAVY = 520;
const SNOW_VOL_X = 30;
const SNOW_VOL_Z = 22;
const SNOW_TOP = 14;

/* ---------- easing + helpers ---------- */
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const smooth01 = (a, b, t) => clamp01((t - a) / (b - a));
const rnd = () => Math.random() * Math.PI;

function hide(dummy, inst, idx) {
  dummy.position.set(0, -1000, 0);
  dummy.scale.set(0, 0, 0);
  dummy.rotation.set(0, 0, 0);
  dummy.updateMatrix();
  inst.setMatrixAt(idx, dummy.matrix);
}

function sunPos(elevDeg, azDeg, out) {
  const e = THREE.MathUtils.degToRad(elevDeg);
  const a = THREE.MathUtils.degToRad(azDeg);
  const D = 100;
  out.set(D * Math.cos(e) * Math.sin(a), D * Math.sin(e), D * Math.cos(e) * Math.cos(a));
  return out;
}

/**
 * Find a planting spot near a target that keeps `minD` clearance from every existing
 * tree, so trees form with visible distance between them instead of overlapping.
 * Searches outward if the area is crowded; falls back to the (clamped) target.
 */
function pickSpot(trees, tx, tz, minD, tries = 16) {
  const m2 = minD * minD;
  const bx = (tx == null) ? (Math.random() - 0.5) * 15 : tx;
  const bz = (tz == null) ? ((Math.random() - 0.5) * 4.2 - 1.2) : tz;
  const free = (x, z) => {
    for (let i = 0; i < trees.length; i++) {
      const dx = trees[i].x - x, dz = trees[i].z - z;
      if (dx * dx + dz * dz < m2) return false;
    }
    return true;
  };
  for (let k = 0; k < tries; k++) {
    const spread = 0.5 + k * 0.5; // widen the search the more crowded it is
    const cx = THREE.MathUtils.clamp(bx + (Math.random() - 0.5) * 2 * spread, -8, 8);
    const cz = THREE.MathUtils.clamp(bz + (Math.random() - 0.5) * spread, -3.6, 0.8);
    if (free(cx, cz)) return [cx, cz];
  }
  return [THREE.MathUtils.clamp(bx, -8, 8), THREE.MathUtils.clamp(bz, -3.6, 0.8)];
}

const ForestScene = forwardRef(function ForestScene(props, ref) {
  const trunkInst = useRef(null);
  const branchInst = useRef(null);
  const twigInst = useRef(null);
  const foliageInst = useRef(null);
  const tuftInst = useRef(null);
  const snowRef = useRef(null);
  const grassRef = useRef(null);
  const rainRef = useRef(null);
  const skyRef = useRef(null);
  const sunRef = useRef(null);
  const ambientRef = useRef(null);
  const hemiRef = useRef(null);
  const fogRef = useRef(null);
  const cloudsRef = useRef(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const treesRef = useRef([]);
  const sunState = useRef({ elevation: 16, target: 16, azimuth: 75, prevElev: NaN });
  const snowState = useRef({ active: SNOW_AMBIENT, target: SNOW_AMBIENT, intensity: 0 });
  const colorsInit = useRef(false);
  const rainTimer = useRef(null);
  const sunTimer = useRef(null);
  const snowTimer = useRef(null);
  const [, force] = useState(0);
  const [raining, setRaining] = useState(false);

  const skySun = useMemo(() => sunPos(16, 75, new THREE.Vector3()), []);

  const scratch = useMemo(() => ({
    up: new THREE.Vector3(0, 1, 0),
    dir: new THREE.Vector3(),
    side: new THREE.Vector3(),
    tdir: new THREE.Vector3(),
    q: new THREE.Quaternion(),
    cA: new THREE.Color(),
    cB: new THREE.Color(),
    col: new THREE.Color(),
  }), []);

  /* ---------- procedural textures + geometry (offline) ---------- */
  const barkTex = useMemo(makeBarkTexture, []);
  const leafTex = useMemo(makeLeafTexture, []);
  const leafMaskTex = useMemo(makeLeafMaskTexture, []);
  const grassTex = useMemo(makeGrassTexture, []);
  const tuftTex = useMemo(makeTuftTexture, []);
  const cloudTex = useMemo(makeCloudTexture, []);
  const terrainGeom = useMemo(() => makeTerrainGeometry(), []);

  useEffect(() => () => {
    [barkTex, leafTex, leafMaskTex, grassTex, tuftTex, cloudTex].forEach((t) => t.dispose());
    terrainGeom.dispose();
    clearTimeout(rainTimer.current);
    clearTimeout(sunTimer.current);
    clearTimeout(snowTimer.current);
  }, [barkTex, leafTex, leafMaskTex, grassTex, tuftTex, cloudTex, terrainGeom]);

  /* ---------- grass tufts (static base, camera-faced + swayed each frame) ---------- */
  const tufts = useMemo(() => Array.from({ length: TUFT_COUNT }, () => {
    const x = (Math.random() - 0.5) * 52;
    const z = Math.random() * 13 - 9;
    return {
      x, z,
      y: GROUND_Y + 0.3 + terrainH(x, z),
      scale: 0.28 + Math.random() * 0.22,
      phase: Math.random() * Math.PI * 2,
    };
  }), []);

  /* ---------- raindrops ---------- */
  const drops = useMemo(() => Array.from({ length: 300 }, () => ({
    x: (Math.random() - 0.5) * 26,
    y: Math.random() * 8 + 2,
    z: (Math.random() - 0.5) * 16,
    speed: 6 + Math.random() * 5,
  })), []);
  const rainGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(drops.length * 3);
    drops.forEach((d, i) => { pos[i * 3] = d.x; pos[i * 3 + 1] = d.y; pos[i * 3 + 2] = d.z; });
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, [drops]);
  useEffect(() => () => rainGeom.dispose(), [rainGeom]);

  /* ---------- snowflakes ---------- */
  const flakes = useMemo(() => Array.from({ length: SNOW_HEAVY }, () => ({
    x: (Math.random() - 0.5) * 2 * SNOW_VOL_X,
    y: GROUND_Y + Math.random() * (SNOW_TOP - GROUND_Y),
    z: (Math.random() - 0.5) * 2 * SNOW_VOL_Z,
    drift: (Math.random() - 0.5) * 0.6,
    swayAmp: 0.25 + Math.random() * 0.6,
    swayPhase: Math.random() * Math.PI * 2,
    swaySpeed: 0.5 + Math.random() * 0.9,
    fall: 0.7 + Math.random() * 1.1,
    size: 0.05 + Math.random() * 0.09,
    spin: new THREE.Vector3((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2),
    rot: new THREE.Euler(rnd(), rnd(), rnd()),
  })), []);

  /* ---------- imperative API ---------- */
  useImperativeHandle(ref, () => ({
    plantTree(x) {
      if (treesRef.current.length >= MAX) return false;
      const [px, pz] = pickSpot(treesRef.current, x, undefined, MIN_DIST);
      treesRef.current.push(makeTree(px, pz));
      force((n) => n + 1);
      return true;
    },
    plantBurst() {
      const n = Math.min(28, MAX - treesRef.current.length);
      const center = Math.random() * Math.PI * 2;
      for (let i = 0; i < n; i++) {
        const ring = Math.floor(i / 8);
        const ang = center + (i % 8) / 8 * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const r = ring * 1.7 + 2.2 + (Math.random() - 0.5) * 0.5;
        const [px, pz] = pickSpot(
          treesRef.current,
          Math.cos(ang) * r,
          Math.sin(ang) * r * 0.4 - 1.2,
          MIN_DIST_BURST,
        );
        treesRef.current.push(makeTree(px, pz, i * 60));
      }
      if (n > 0) force((k) => k + 1);
      return n;
    },
    rain() {
      clearTimeout(rainTimer.current);
      setRaining(true);
      rainTimer.current = setTimeout(() => setRaining(false), 6000);
    },
    sunlight() {
      const S = sunState.current;
      S.target = Math.min(42, S.elevation + 22);
      clearTimeout(sunTimer.current);
      sunTimer.current = setTimeout(() => { sunState.current.target = 16; }, 7000);
    },
    snow() {
      const SN = snowState.current;
      clearTimeout(snowTimer.current);
      if (SN.target >= SNOW_HEAVY) { SN.target = SNOW_AMBIENT; snowTimer.current = null; return false; }
      SN.target = SNOW_HEAVY;
      snowTimer.current = setTimeout(() => { snowState.current.target = SNOW_AMBIENT; }, 6000);
      return true;
    },
    setSnow(on) {
      clearTimeout(snowTimer.current);
      snowTimer.current = null;
      snowState.current.target = on ? SNOW_HEAVY : SNOW_AMBIENT;
    },
    treesCount: () => treesRef.current.length,
    reset() {
      treesRef.current = [];
      clearTimeout(sunTimer.current); sunTimer.current = null;
      clearTimeout(snowTimer.current); snowTimer.current = null;
      sunState.current.elevation = 16; sunState.current.target = 16;
      snowState.current.target = SNOW_AMBIENT;
      force((n) => n + 1);
    },
  }), []);

  /* ---------- one-time: dynamic-usage hint + shadow setup ---------- */
  useEffect(() => {
    [trunkInst, branchInst, twigInst, foliageInst, tuftInst, snowRef].forEach((r) => {
      if (r.current) r.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    });
    const L = sunRef.current;
    if (!L) return;
    L.shadow.mapSize.set(2048, 2048);
    L.shadow.bias = -0.0004;
    L.shadow.normalBias = 0.03;
    const cam = L.shadow.camera;
    cam.near = 0.5; cam.far = 220;
    cam.left = -22; cam.right = 22; cam.top = 22; cam.bottom = -22;
    cam.updateProjectionMatrix();
  }, []);

  /* ---------- the render loop ---------- */
  useFrame((state, dt) => {
    if (!trunkInst.current || !branchInst.current || !twigInst.current || !foliageInst.current) return;
    const now = performance.now();
    const tt = state.clock.elapsedTime;
    const trees = treesRef.current;
    const len = trees.length;

    // 0) seed instanceColor buffers once (white)
    if (!colorsInit.current) {
      const w = scratch.col.setRGB(1, 1, 1);
      for (let i = 0; i < MAX; i++) trunkInst.current.setColorAt(i, w);
      for (let i = 0; i < TOTAL_BRANCH; i++) branchInst.current.setColorAt(i, w);
      for (let i = 0; i < TOTAL_TWIG; i++) twigInst.current.setColorAt(i, w);
      for (let i = 0; i < TOTAL_FOLIAGE; i++) foliageInst.current.setColorAt(i, w);
      [trunkInst, branchInst, twigInst, foliageInst].forEach((r) => {
        if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true;
      });
      colorsInit.current = true;
    }

    // 1) TREES
    let colorsDirty = false, woodDirty = false;
    for (let i = 0; i < len; i++) {
      const t = trees[i];
      const age = clamp01((now - t.t0) / GROWTH_MS);

      if (age <= 0) { // burst-delayed: keep every part hidden until it starts
        hide(dummy, trunkInst.current, i);
        for (let b = 0; b < BRANCHES_PER; b++) hide(dummy, branchInst.current, i * BRANCHES_PER + b);
        for (let w = 0; w < TWIGS_PER; w++) hide(dummy, twigInst.current, i * TWIGS_PER + w);
        for (let f = 0; f < FOLIAGE_PER; f++) hide(dummy, foliageInst.current, i * FOLIAGE_PER + f);
        woodDirty = true;
        continue;
      }

      if (t.baseY === 0) t.baseY = GROUND_Y + terrainH(t.x, t.z);

      const trunkGrow = easeOutCubic(smooth01(0.0, 0.55, age));
      const trunkFat = easeOutQuad(smooth01(0.12, 0.6, age));
      const reveal = easeOutCubic(smooth01(0.45, 0.82, age));
      const twigRev = easeOutCubic(smooth01(0.53, 0.9, age));
      const popTop = Math.max(0, easeOutBack(smooth01(0.04, 0.45, age)));
      const popMain = Math.max(0, easeOutBack(smooth01(0.62, 1.0, age)));
      const sway = Math.sin(tt * 1.1 + t.phase) * t.swayAmp;

      if (!t.colorSet) {
        trunkInst.current.setColorAt(i, t.trunkColor);
        for (let b = 0; b < BRANCHES_PER; b++) branchInst.current.setColorAt(i * BRANCHES_PER + b, t.trunkColor);
        for (let w = 0; w < TWIGS_PER; w++) twigInst.current.setColorAt(i * TWIGS_PER + w, t.trunkColor);
        for (let f = 0; f < FOLIAGE_PER; f++) foliageInst.current.setColorAt(i * FOLIAGE_PER + f, t.foliageColors[f]);
        t.colorSet = true; colorsDirty = true;
      }

      const matureH = t.trunkLen * t.scaleTarget;
      const hNow = Math.max(0.05, trunkGrow * matureH);
      const rNow = (0.025 + 0.05 * trunkFat) * (0.7 + 0.3 * t.scaleTarget);
      const canopyY = t.baseY + hNow;

      // ---- WOOD: recompute only while growing; freeze when settled ----
      if (!t.settled) {
        dummy.position.set(t.x, t.baseY + hNow / 2 - 0.05, t.z);
        dummy.rotation.set(t.lean * trunkGrow, t.rot, t.leanZ * trunkGrow);
        dummy.scale.set(rNow / 0.5, hNow, rNow / 0.5);
        dummy.updateMatrix();
        trunkInst.current.setMatrixAt(i, dummy.matrix);

        for (let b = 0; b < BRANCHES_PER; b++) {
          const br = t.branches[b], idx = i * BRANCHES_PER + b;
          const ay = t.baseY + hNow * br.heightFrac;
          const L = br.length * reveal * t.scaleTarget;
          const cp = Math.cos(br.pitch), sp = Math.sin(br.pitch);
          scratch.dir.set(Math.cos(br.angle) * cp, sp, Math.sin(br.angle) * cp); // unit, y>0
          const ex = t.x + scratch.dir.x * L, ey = ay + scratch.dir.y * L, ez = t.z + scratch.dir.z * L;
          t.branchEnds[b].set(ex, ey, ez);

          if (reveal < 0.02) hide(dummy, branchInst.current, idx);
          else {
            scratch.q.setFromUnitVectors(scratch.up, scratch.dir);
            dummy.position.set((t.x + ex) / 2, (ay + ey) / 2, (t.z + ez) / 2);
            dummy.quaternion.copy(scratch.q);
            const brR = br.radius * reveal;
            dummy.scale.set(brR / 0.5, L, brR / 0.5);
            dummy.updateMatrix();
            branchInst.current.setMatrixAt(idx, dummy.matrix);
          }

          scratch.side.crossVectors(scratch.dir, scratch.up);
          if (scratch.side.lengthSq() < 1e-4) scratch.side.set(1, 0, 0);
          scratch.side.normalize();
          for (let j = 0; j < 2; j++) {
            const tw = br.twigs[j], widx = i * TWIGS_PER + b * 2 + j;
            const apx = t.x + scratch.dir.x * L * tw.at, apy = ay + scratch.dir.y * L * tw.at, apz = t.z + scratch.dir.z * L * tw.at;
            scratch.tdir.copy(scratch.dir).addScaledVector(scratch.side, tw.side * tw.spread).addScaledVector(scratch.up, 0.25).normalize();
            const TL = tw.length * twigRev * t.scaleTarget;
            const tex = apx + scratch.tdir.x * TL, tey = apy + scratch.tdir.y * TL, tez = apz + scratch.tdir.z * TL;
            t.twigEnds[b * 2 + j].set(tex, tey, tez);
            if (twigRev < 0.02) hide(dummy, twigInst.current, widx);
            else {
              scratch.q.setFromUnitVectors(scratch.up, scratch.tdir);
              dummy.position.set((apx + tex) / 2, (apy + tey) / 2, (apz + tez) / 2);
              dummy.quaternion.copy(scratch.q);
              const twR = tw.radius * twigRev;
              dummy.scale.set(twR / 0.5, TL, twR / 0.5);
              dummy.updateMatrix();
              twigInst.current.setMatrixAt(widx, dummy.matrix);
            }
          }
        }
        woodDirty = true;
        if (age >= 1) t.settled = true;
      }

      // ---- FOLIAGE: every frame (sway), rides cached branch/twig ends ----
      const canopyScale = (t.bushy ? 0.48 : 0.40) + 0.26 * t.scaleTarget;
      for (let f = 0; f < FOLIAGE_PER; f++) {
        const fl = t.foliage[f], idx = i * FOLIAGE_PER + f;
        const born = fl.type === 'crownTop' ? popTop : popMain;
        const fs = born * fl.scale * canopyScale;
        if (fs < 0.01) { hide(dummy, foliageInst.current, idx); continue; }
        if (fl.type === 'twig') {
          const te = t.twigEnds[fl.bi * 2];
          dummy.position.set(te.x + sway * 0.6, te.y + 0.05, te.z);
        } else {
          dummy.position.set(
            t.x + fl.dx * trunkGrow + sway,
            canopyY + fl.dy * (0.4 + 0.6 * trunkGrow),
            t.z + fl.dz * trunkGrow,
          );
        }
        dummy.rotation.set(fl.rotX, fl.rotY + tt * 0.015, sway * Math.cos(f) * 0.5);
        const flat = (fl.type === 'crownUnder' || fl.type === 'skirt') ? 0.72 : 0.92;
        dummy.scale.set(fs, fs * flat, fs);
        dummy.updateMatrix();
        foliageInst.current.setMatrixAt(idx, dummy.matrix);
      }
    }
    // visibility via count — unwritten slots never render
    trunkInst.current.count = len;
    branchInst.current.count = len * BRANCHES_PER;
    twigInst.current.count = len * TWIGS_PER;
    foliageInst.current.count = len * FOLIAGE_PER;
    foliageInst.current.instanceMatrix.needsUpdate = true;
    if (woodDirty) {
      trunkInst.current.instanceMatrix.needsUpdate = true;
      branchInst.current.instanceMatrix.needsUpdate = true;
      twigInst.current.instanceMatrix.needsUpdate = true;
    }
    if (colorsDirty) {
      [trunkInst, branchInst, twigInst, foliageInst].forEach((r) => {
        if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true;
      });
    }

    // 2) SUN / SKY — sunrise
    const S = sunState.current;
    if (Math.abs(S.elevation - S.target) > 0.05) {
      S.elevation = THREE.MathUtils.clamp(S.elevation + Math.sign(S.target - S.elevation) * 9 * dt, 1, 45);
    }
    sunPos(S.elevation, S.azimuth, skySun);
    if (skyRef.current) skyRef.current.material.uniforms.sunPosition.value.copy(skySun);
    const e = S.elevation;
    const L = sunRef.current;
    if (L) {
      L.position.copy(skySun);
      let r, g, b, I;
      if (e < 6) { const k = e / 6; r = 1; g = 0.46 + 0.20 * k; b = 0.30 + 0.18 * k; I = 0.9 + 0.5 * k; }
      else if (e < 20) { const k = (e - 6) / 14; r = 1; g = 0.66 + 0.29 * k; b = 0.48 + 0.45 * k; I = 1.4 + 0.3 * k; }
      else { const k = clamp01((e - 20) / 25); r = 1; g = 0.95 + 0.03 * k; b = 0.93 + 0.06 * k; I = 1.7; }
      L.color.setRGB(r, g, b);
      L.intensity = (raining ? I * 0.45 : I) * (1 - snowState.current.intensity * 0.3);
      if (e !== S.prevElev) {
        const sd = THREE.MathUtils.lerp(28, 18, e / 45);
        const cam = L.shadow.camera;
        cam.left = -sd; cam.right = sd; cam.top = sd; cam.bottom = -sd;
        cam.updateProjectionMatrix();
        S.prevElev = e;
      }
    }
    if (ambientRef.current) ambientRef.current.intensity = THREE.MathUtils.lerp(0.55, 0.85, clamp01(e / 40));
    if (hemiRef.current) hemiRef.current.intensity = THREE.MathUtils.lerp(0.5, 0.85, clamp01(e / 40));

    // 3) FOG — warm dawn → blue day, greyer in rain/snow
    if (fogRef.current) {
      const F = fogRef.current;
      if (e < 6) { F.color.lerpColors(scratch.cA.set('#ff6a3a'), scratch.cB.set('#ffb38a'), e / 6); F.far = THREE.MathUtils.lerp(55, 78, e / 6); }
      else if (e < 24) { const k = (e - 6) / 18; F.color.lerpColors(scratch.cA.set('#ffb38a'), scratch.cB.set('#bcd9f0'), k); F.far = THREE.MathUtils.lerp(78, 120, k); }
      else { F.color.set('#cfe2f2'); F.far = 140; }
      if (raining) { F.color.lerp(scratch.cA.set('#8fa0ad'), 0.5); F.far = 60; }
      const snowI = snowState.current.intensity;
      if (snowI > 0.01) { F.color.lerp(scratch.cA.set('#dfe9f5'), snowI * 0.55); F.far = THREE.MathUtils.lerp(F.far, 70, snowI * 0.6); }
    }

    // 4) RAIN
    if (rainRef.current) {
      if (raining) {
        const pos = rainRef.current.geometry.attributes.position;
        for (let i = 0; i < drops.length; i++) {
          drops[i].y -= drops[i].speed * dt;
          if (drops[i].y < GROUND_Y) drops[i].y = 7 + Math.random() * 2;
          pos.setXYZ(i, drops[i].x, drops[i].y, drops[i].z);
        }
        pos.needsUpdate = true;
        rainRef.current.visible = true;
      } else {
        rainRef.current.visible = false;
      }
    }

    // 4.5) SNOW — true 3D instanced flakes
    if (snowRef.current) {
      const SN = snowState.current;
      SN.active += (SN.target - SN.active) * Math.min(1, dt * 3);
      const liveCount = Math.round(SN.active);
      SN.intensity = THREE.MathUtils.clamp((SN.active - SNOW_AMBIENT) / (SNOW_HEAVY - SNOW_AMBIENT), 0, 1);
      const gust = 1 + SN.intensity * 0.8, wind = 0.4 + SN.intensity * 0.7;
      for (let i = 0; i < liveCount; i++) {
        const fk = flakes[i];
        fk.y -= fk.fall * gust * dt;
        fk.x += fk.drift * wind * dt;
        fk.swayPhase += fk.swaySpeed * dt;
        if (fk.y < GROUND_Y + terrainH(fk.x, fk.z)) {
          fk.y = SNOW_TOP;
          fk.x = (Math.random() - 0.5) * 2 * SNOW_VOL_X;
          fk.z = (Math.random() - 0.5) * 2 * SNOW_VOL_Z;
        }
        if (fk.x > SNOW_VOL_X) fk.x -= 2 * SNOW_VOL_X;
        if (fk.x < -SNOW_VOL_X) fk.x += 2 * SNOW_VOL_X;
        const s = Math.sin(fk.swayPhase) * fk.swayAmp;
        dummy.position.set(fk.x + s, fk.y, fk.z + Math.cos(fk.swayPhase * 0.7) * fk.swayAmp * 0.5);
        dummy.rotation.set(fk.rot.x + fk.spin.x * tt, fk.rot.y + fk.spin.y * tt, fk.rot.z + fk.spin.z * tt);
        dummy.scale.setScalar(fk.size);
        dummy.updateMatrix();
        snowRef.current.setMatrixAt(i, dummy.matrix);
      }
      snowRef.current.count = liveCount;
      snowRef.current.instanceMatrix.needsUpdate = true;
    }

    // 5) GROUND colour + grass tuft wind (camera-facing, half rate)
    if (grassRef.current?.material) {
      const lush = clamp01((e - 4) / 28 + (raining ? 0.45 : 0));
      grassRef.current.material.color.lerpColors(scratch.cA.set('#7d8a52'), scratch.cB.set('#3f7a45'), lush);
    }
    if (tuftInst.current && ((tt * 60 | 0) % 2 === 0)) {
      const cx = state.camera.position.x, cz = state.camera.position.z;
      for (let i = 0; i < TUFT_COUNT; i++) {
        const tg = tufts[i];
        const s = Math.sin(tt * 1.3 + tg.phase) * 0.06;
        dummy.position.set(tg.x + s, tg.y, tg.z);
        dummy.rotation.set(0, Math.atan2(cx - tg.x, cz - tg.z), s * 0.25);
        dummy.scale.set(tg.scale, tg.scale + 0.25, tg.scale);
        dummy.updateMatrix();
        tuftInst.current.setMatrixAt(i, dummy.matrix);
      }
      tuftInst.current.instanceMatrix.needsUpdate = true;
    }

    // 6) drifting clouds, gently tinted by sun warmth
    if (cloudsRef.current) {
      const warm = e < 14 ? 1 : 0;
      cloudsRef.current.children.forEach((c) => {
        c.position.x += (c.userData.speed || 0.2) * dt;
        if (c.position.x > 40) c.position.x = -40;
        if (c.material) c.material.color.lerpColors(scratch.cA.set('#ffffff'), scratch.cB.set('#ffcba0'), warm * 0.5);
      });
    }
  });

  return (
    <group>
      <Sky ref={skyRef} sunPosition={skySun} turbidity={6} rayleigh={2.0} mieCoefficient={0.005} mieDirectionalG={0.85} />
      <fog ref={fogRef} attach="fog" args={['#bcd9f0', 14, 130]} />

      <ambientLight ref={ambientRef} intensity={0.6} color="#ffe8cc" />
      <directionalLight ref={sunRef} castShadow position={[60, 26, 24]} intensity={1.3} color="#fff4e0" />
      <hemisphereLight ref={hemiRef} args={['#cfe4f5', '#3f7a45', 0.6]} />

      {/* undulating ground */}
      <mesh ref={grassRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_Y, 0]} receiveShadow>
        <primitive object={terrainGeom} attach="geometry" />
        <meshStandardMaterial map={grassTex} color="#5d7a48" roughness={0.95} metalness={0} />
      </mesh>

      {/* trunks */}
      <instancedMesh ref={trunkInst} args={[undefined, undefined, MAX]} castShadow receiveShadow>
        <cylinderGeometry args={[0.34, 0.5, 1, 10]} />
        <meshStandardMaterial map={barkTex} roughness={0.95} metalness={0} />
      </instancedMesh>

      {/* branches */}
      <instancedMesh ref={branchInst} args={[undefined, undefined, TOTAL_BRANCH]}>
        <cylinderGeometry args={[0.32, 0.5, 1, 6]} />
        <meshStandardMaterial map={barkTex} roughness={0.9} metalness={0} />
      </instancedMesh>

      {/* twigs */}
      <instancedMesh ref={twigInst} args={[undefined, undefined, TOTAL_TWIG]}>
        <cylinderGeometry args={[0.3, 0.5, 1, 5]} />
        <meshStandardMaterial map={barkTex} roughness={0.9} metalness={0} />
      </instancedMesh>

      {/* leafy canopy — colour from leafTex, leafy cutout from leafMaskTex (.g) */}
      <instancedMesh ref={foliageInst} args={[undefined, undefined, TOTAL_FOLIAGE]} castShadow>
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial
          map={leafTex} alphaMap={leafMaskTex} alphaTest={0.35}
          side={THREE.DoubleSide} roughness={0.7} metalness={0} color="#ffffff"
          onUpdate={(m) => { m.alphaToCoverage = true; }}
        />
      </instancedMesh>

      {/* foreground grass tufts */}
      <instancedMesh ref={tuftInst} args={[undefined, undefined, TUFT_COUNT]}>
        <planeGeometry args={[0.6, 1.2]} />
        <meshStandardMaterial map={tuftTex} alphaMap={tuftTex} alphaTest={0.5} side={THREE.DoubleSide} color="#5d9d4d" roughness={0.85} />
      </instancedMesh>

      {/* rain */}
      <points ref={rainRef} geometry={rainGeom} visible={false}>
        <pointsMaterial size={0.07} color="#cfe9ff" transparent opacity={0.8} depthWrite={false} />
      </points>

      {/* real 3D snow */}
      <instancedMesh ref={snowRef} args={[undefined, undefined, SNOW_HEAVY]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#ffffff" emissive="#cfe0f5" emissiveIntensity={0.45} roughness={0.5} metalness={0} flatShading />
      </instancedMesh>

      {/* drifting procedural clouds */}
      <group ref={cloudsRef}>
        <mesh position={[-14, 11, -20]} rotation={[-0.12, 0, 0]} userData={{ speed: 0.25 }}>
          <planeGeometry args={[16, 7]} />
          <meshBasicMaterial map={cloudTex} transparent opacity={0.7} depthWrite={false} />
        </mesh>
        <mesh position={[8, 13, -26]} rotation={[-0.12, 0, 0]} userData={{ speed: 0.16 }}>
          <planeGeometry args={[20, 8]} />
          <meshBasicMaterial map={cloudTex} transparent opacity={0.55} depthWrite={false} />
        </mesh>
        <mesh position={[22, 9.5, -32]} rotation={[-0.12, 0, 0]} userData={{ speed: 0.32 }}>
          <planeGeometry args={[13, 6]} />
          <meshBasicMaterial map={cloudTex} transparent opacity={0.6} depthWrite={false} />
        </mesh>
      </group>

      {/* floating pollen / light motes */}
      <Sparkles count={60} scale={[16, 8, 8]} position={[0, 1.5, 0]} size={2} speed={0.3} color="#f6e6b4" opacity={0.5} />
    </group>
  );
});

export default ForestScene;

/* ===================== tree factory ===================== */
function makeTree(x, z, delayMs = 0) {
  const bushy = Math.random() < 0.5;
  // mini trees — kept small so many can dot the field with space between them
  const scaleTarget = bushy ? 0.42 + Math.random() * 0.16 : 0.55 + Math.random() * 0.22;
  const trunkLen = bushy ? 0.70 + Math.random() * 0.20 : 0.95 + Math.random() * 0.25;
  const crownLift = bushy ? 0.22 : 0.42;
  const branchSpread = bushy ? 1.0 : 0.7;

  const trunkColor = new THREE.Color().setHSL(
    0.07 + Math.random() * 0.04, 0.42 + Math.random() * 0.18, 0.18 + Math.random() * 0.10);
  const lightLeaf = () => new THREE.Color().setHSL(0.26 + Math.random() * 0.05, 0.55 + Math.random() * 0.18, 0.40 + Math.random() * 0.10);
  const darkLeaf = () => new THREE.Color().setHSL(0.30 + Math.random() * 0.06, 0.55 + Math.random() * 0.18, 0.24 + Math.random() * 0.08);

  const golden = 2.399963;
  const branches = Array.from({ length: BRANCHES_PER }, (_, k) => ({
    heightFrac: 0.45 + (k / BRANCHES_PER) * 0.42 + Math.random() * 0.04,
    angle: k * golden + Math.random() * 0.3,
    pitch: branchSpread + Math.random() * 0.35, // > 0 → branches point up (no quaternion flip)
    length: (bushy ? 0.85 : 0.7) + Math.random() * 0.45,
    radius: 0.045 + Math.random() * 0.02,
    twigs: Array.from({ length: 2 }, (_, j) => ({
      at: 0.55 + j * 0.30, side: j === 0 ? 1 : -1,
      spread: 0.5 + Math.random() * 0.4, length: 0.30 + Math.random() * 0.20,
      radius: 0.025 + Math.random() * 0.012,
    })),
  }));

  const foliage = [
    { type: 'crownTop', dx: 0, dy: crownLift + 0.24, dz: 0, scale: 0.92, light: true, rotX: rnd(), rotY: rnd() },
    { type: 'crownUnder', dx: 0, dy: crownLift - 0.04, dz: 0, scale: 0.98, light: false, rotX: rnd(), rotY: rnd() },
    { type: 'skirt', dx: 0, dy: crownLift - 0.22, dz: 0, scale: 1.06, light: false, rotX: rnd(), rotY: rnd() },
  ];
  for (let i = 0; i < 3; i++) {
    const a = Math.random() * Math.PI * 2, r = 0.30 + Math.random() * 0.22;
    foliage.push({
      type: 'lobe', dx: Math.cos(a) * r, dy: crownLift + (Math.random() - 0.4) * 0.28, dz: Math.sin(a) * r,
      scale: 0.42 + Math.random() * 0.18, light: Math.random() < 0.5, rotX: rnd(), rotY: rnd(),
    });
  }
  for (let b = 0; b < BRANCHES_PER; b++) {
    foliage.push({ type: 'twig', bi: b, scale: 0.40 + Math.random() * 0.16, light: true, rotX: rnd(), rotY: rnd() });
  }
  const foliageColors = foliage.map((f) => (f.light ? lightLeaf() : darkLeaf()));

  return {
    x: x ?? (Math.random() - 0.5) * 14,
    z: z ?? (Math.random() - 0.5) * 4 - 1.4,
    t0: performance.now() + delayMs,
    bushy, scaleTarget, trunkLen, crownLift,
    rot: Math.random() * Math.PI * 2,
    lean: (Math.random() - 0.5) * 0.10, leanZ: (Math.random() - 0.5) * 0.10,
    phase: Math.random() * Math.PI * 2, swayAmp: 0.03 + Math.random() * 0.03,
    baseY: 0,
    colorSet: false, settled: false,
    trunkColor, foliageColors, branches, foliage,
    branchEnds: Array.from({ length: BRANCHES_PER }, () => new THREE.Vector3()),
    twigEnds: Array.from({ length: TWIGS_PER }, () => new THREE.Vector3()),
  };
}

/* ===================== procedural assets ===================== */
function terrainH(x, z) {
  return 0.15 * Math.sin(x * 0.3) * Math.cos(z * 0.4) + 0.08 * Math.sin(x * 0.7) * Math.cos(z * 0.8);
}

function makeTerrainGeometry(w = 64, h = 40, seg = 36) {
  const geom = new THREE.PlaneGeometry(w, h, seg, seg);
  const p = geom.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, terrainH(p.getX(i), p.getY(i)));
  p.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}

function makeBarkTexture(w = 512, h = 512) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#5a3a1a'; ctx.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 4) {
    const baseHue = 32 + Math.sin(x * 0.01) * 10;
    let y = 0;
    while (y < h) {
      const streak = 18 + Math.random() * 60;
      const hue = baseHue + (Math.random() - 0.5) * 18;
      ctx.fillStyle = `hsl(${hue}, 45%, ${14 + Math.random() * 16}%)`;
      ctx.fillRect(x, y, 7 + Math.random() * 4, streak);
      y += streak + 8 + Math.random() * 18;
    }
  }
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 28;
    d[i] += n; d[i + 1] += n * 0.8; d[i + 2] += n * 0.6;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 2);
  t.anisotropy = 4;
  return t;
}

// Opaque leaf COLOUR map (lit green gradient + veins + warm flecks). Cutout lives in the mask.
function makeLeafTexture(w = 256, h = 256) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(w * 0.45, h * 0.4, 0, w / 2, h / 2, w * 0.72);
  g.addColorStop(0, '#86d96a'); g.addColorStop(0.5, '#3f9a32'); g.addColorStop(1, '#1d5320');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(20,55,20,0.5)'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 16; i++) {
    const x1 = Math.random() * w, y1 = Math.random() * h;
    ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + (Math.random() - 0.5) * w * 0.5, y1 + (Math.random() - 0.5) * h * 0.5);
    ctx.stroke();
  }
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(${200 + Math.random() * 55 | 0},${210 + Math.random() * 40 | 0},120,0.16)`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Leaf ALPHA mask — three's alphaMap samples the GREEN channel. A scalloped, lobed white
// blob (with internal holes) on black gives a leafy canopy silhouette. Linear (no sRGB).
function makeLeafMaskTexture(w = 256, h = 256) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2;
  const blob = (x, y, r) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  };
  ctx.globalCompositeOperation = 'lighter';
  blob(cx, cy, w * 0.30);
  const lobes = 7;
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2 + Math.random() * 0.3;
    blob(cx + Math.cos(a) * w * 0.22, cy + Math.sin(a) * h * 0.22, w * (0.18 + Math.random() * 0.06));
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000';
  for (let i = 0; i < 12; i++) {
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(Math.random() * w, Math.random() * h, w * (0.015 + Math.random() * 0.04), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}

function makeGrassTexture(w = 256, h = 256) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#5d7a48'; ctx.fillRect(0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let noise = 0, freq = 0.05, amp = 1;
      for (let o = 0; o < 3; o++) { noise += amp * Math.sin(x * freq) * Math.cos(y * freq * 0.7); freq *= 2.1; amp *= 0.5; }
      noise = (noise + 1) / 2;
      const blade = Math.abs(Math.sin(y * 0.15)) > 0.85 ? 0.15 : 0;
      const dirt = Math.random() < 0.08 ? -0.12 : 0;
      const v = Math.max(0, Math.min(1, noise * 0.3 + blade + dirt + 0.5));
      const idx = (y * w + x) * 4;
      d[idx] = (v * 80 + 55) | 0; d[idx + 1] = (v * 120 + 80) | 0; d[idx + 2] = (v * 40 + 20) | 0; d[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 8);
  t.anisotropy = 4;
  return t;
}

function makeTuftTexture(w = 48, h = 64) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  const blades = [
    { x: 10, col: '#3d6d3a', a: 0.85 }, { x: 18, col: '#4f9a47', a: 0.95 },
    { x: 26, col: '#2a5a28', a: 0.75 }, { x: 36, col: '#4f9a47', a: 0.9 },
  ];
  for (const bl of blades) {
    ctx.strokeStyle = bl.col; ctx.globalAlpha = bl.a; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(bl.x, h);
    ctx.quadraticCurveTo(bl.x - 2, h * 0.55, bl.x + 1, 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeCloudTexture(size = 256) {
  const c = document.createElement('canvas'); c.width = size; c.height = size / 2;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  for (let i = 0; i < 26; i++) {
    const px = (0.12 + Math.random() * 0.76) * c.width;
    const py = (0.35 + Math.random() * 0.4) * c.height;
    const rad = (0.06 + Math.random() * 0.14) * c.width;
    const g = ctx.createRadialGradient(px, py, 0, px, py, rad);
    const a = 0.10 + Math.random() * 0.16;
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(px, py, rad, 0, Math.PI * 2); ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
