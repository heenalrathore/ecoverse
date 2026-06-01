import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Stylized 3D city for the Pollution Cleaner module.
 *
 *   cleanliness  0..1  drives sky tint, sun brightness, river color, smoke fade
 *   smokeKill    0..1  fades smoke independently (swipe-left action)
 *   factoriesOn  bool  whether industrial lights / building lights are on
 *   birdsActive  bool  flock of birds animate above the skyline
 *
 * Realism upgrades over previous version:
 *   - Multi-stop sky plane with horizon glow
 *   - Cloud "sprites" (semi-transparent stretched spheres) drifting
 *   - Smoke is a PARTICLE pool (200 particles per chimney) that rise + spread +
 *     fade with age, rather than 5 huge static spheres
 *   - Buildings vary in width, height, color, window-grid size
 *   - Streetlights at ground level
 *   - Foreground silhouette pavement
 */
export default function CityScene({
  cleanliness = 0,
  smokeKill = 0,
  factoriesOn = true,
  birdsActive = false,
}) {
  const skyRef = useRef(null);
  const sunRef = useRef(null);
  const riverRef = useRef(null);
  const cloudsRef = useRef([]);
  const smokeRefs = useRef([]);              // 4 stacks × 50 particles
  const birdRefs = useRef([]);

  // Build static city data once
  const buildings = useMemo(() => generateBuildings(), []);
  const chimneys = useMemo(() => (
    [-4.5, -2.0, 1.5, 4.0].map((x) => ({ x, h: 2.6 + Math.random() * 0.8 }))
  ), []);
  const clouds = useMemo(() => (
    Array.from({ length: 5 }, (_, i) => ({
      x: -8 + i * 4 + Math.random() * 2,
      y: 2 + Math.random() * 1.6,
      z: -7 + Math.random() * 2,
      scale: 0.7 + Math.random() * 0.6,
      speed: 0.05 + Math.random() * 0.05,
    }))
  ), []);
  const birds = useMemo(() => (
    Array.from({ length: 8 }, () => ({
      offset: Math.random() * Math.PI * 2,
      r: 2.8 + Math.random() * 2.5,
      y: 2.2 + Math.random() * 1.5,
      speed: 0.45 + Math.random() * 0.35,
    }))
  ), []);

  // Smoke particle pool — 50 per chimney, recycled
  const smokeParticles = useMemo(() => (
    chimneys.flatMap((c, ci) =>
      Array.from({ length: 50 }, (_, pi) => ({
        ci,
        x0: c.x, y0: -1.6 + c.h + 0.1,
        age: Math.random() * 4,           // randomize so they don't all spawn together
        lifetime: 3 + Math.random() * 1.5,
        seed: pi,
      }))
    )
  ), [chimneys]);

  // Dedupe-aware ref collector
  const collect = (arr) => (el) => {
    if (el && !arr.current.includes(el)) arr.current.push(el);
  };

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;

    // Sky color lerp
    if (skyRef.current?.material) {
      const dirty = new THREE.Color('#4d3520');
      const clean = new THREE.Color('#8dd2ff');
      skyRef.current.material.color.lerpColors(dirty, clean, cleanliness);
    }
    // Sun brightens as we clean
    if (sunRef.current?.material) {
      sunRef.current.material.opacity = 0.35 + cleanliness * 0.6;
    }
    // River color
    if (riverRef.current?.material) {
      const dirty = new THREE.Color('#4d3a20');
      const clean = new THREE.Color('#3ab0e0');
      riverRef.current.material.color.lerpColors(dirty, clean, cleanliness);
    }

    // Clouds drift sideways
    cloudsRef.current.forEach((cloud, i) => {
      if (!cloud) return;
      const d = clouds[i];
      cloud.position.x += d.speed * dt;
      if (cloud.position.x > 11) cloud.position.x = -11;
    });

    // Smoke particle animation
    smokeParticles.forEach((p, idx) => {
      const mesh = smokeRefs.current[idx];
      if (!mesh) return;
      p.age += dt;
      if (p.age >= p.lifetime) {
        p.age = 0;
        p.lifetime = 3 + Math.random() * 1.5;
      }
      const lifeFrac = p.age / p.lifetime;
      // Rises and spreads
      mesh.position.x = p.x0 + Math.sin(p.seed + t * 0.5) * lifeFrac * 0.6;
      mesh.position.y = p.y0 + lifeFrac * 4.5;
      mesh.position.z = -2 + Math.cos(p.seed + t * 0.3) * lifeFrac * 0.4;
      const scale = 0.15 + lifeFrac * 0.7;
      mesh.scale.setScalar(scale);
      // Fades with age, killed by cleanliness/smokeKill
      const visibility = (1 - lifeFrac) * (1 - smokeKill) * (1 - cleanliness * 0.85);
      mesh.material.opacity = Math.max(0, 0.45 * visibility);
    });

    // Birds
    if (birdsActive) {
      birdRefs.current.forEach((b, i) => {
        if (!b) return;
        const d = birds[i];
        b.position.x = Math.cos(t * d.speed + d.offset) * d.r;
        b.position.z = Math.sin(t * d.speed + d.offset) * d.r - 1;
        b.position.y = d.y + Math.sin(t * 4 + d.offset) * 0.15;
        b.rotation.y = -t * d.speed + Math.PI / 2;
        b.visible = true;
      });
    } else {
      birdRefs.current.forEach((b) => { if (b) b.visible = false; });
    }
  });

  return (
    <group>
      {/* ============= SKY ============= */}
      <mesh ref={skyRef} position={[0, 4, -10]}>
        <planeGeometry args={[40, 18]} />
        <meshBasicMaterial color="#4d3520" />
      </mesh>
      {/* horizon glow */}
      <mesh position={[0, -0.5, -9.9]}>
        <planeGeometry args={[40, 2.5]} />
        <meshBasicMaterial color="#ffd896" transparent opacity={0.4 + cleanliness * 0.4} />
      </mesh>
      {/* sun */}
      <mesh ref={sunRef} position={[5, 4, -9.5]}>
        <circleGeometry args={[0.85, 32]} />
        <meshBasicMaterial color="#fff5cd" transparent opacity={0.35} />
      </mesh>
      {/* sun halo */}
      <mesh position={[5, 4, -9.4]}>
        <circleGeometry args={[1.6, 32]} />
        <meshBasicMaterial color="#fff5cd" transparent opacity={0.22 * cleanliness} />
      </mesh>

      {/* ============= CLOUDS ============= */}
      {clouds.map((c, i) => (
        <group
          key={i}
          ref={(el) => (cloudsRef.current[i] = el)}
          position={[c.x, c.y, c.z]}
          scale={[c.scale, c.scale, c.scale]}
        >
          {/* Cluster of 5 stretched spheres = puffy cloud */}
          {[[-0.6, 0, 0], [0, 0.1, 0], [0.6, 0, 0], [-0.3, -0.2, 0], [0.3, -0.2, 0]].map((p, j) => (
            <mesh key={j} position={p}>
              <sphereGeometry args={[0.5, 12, 12]} />
              <meshBasicMaterial
                color={cleanliness > 0.5 ? '#ffffff' : '#9c8c78'}
                transparent
                opacity={0.55 + cleanliness * 0.25}
              />
            </mesh>
          ))}
        </group>
      ))}

      {/* ============= RIVER ============= */}
      <mesh ref={riverRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.6, 0]}>
        <planeGeometry args={[40, 5]} />
        <meshStandardMaterial color="#4d3a20" roughness={0.5} metalness={0.4} />
      </mesh>

      {/* ============= GROUND BEHIND RIVER ============= */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.6, -5]}>
        <planeGeometry args={[40, 8]} />
        <meshStandardMaterial color="#3a2f1f" roughness={1} />
      </mesh>
      {/* ============= FOREGROUND STREET ============= */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.6, 3.5]}>
        <planeGeometry args={[40, 4]} />
        <meshStandardMaterial color="#252830" roughness={0.95} />
      </mesh>
      {/* road stripes */}
      {[-12, -8, -4, 0, 4, 8, 12].map((x, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, -1.59, 3.5]}>
          <planeGeometry args={[1.5, 0.12]} />
          <meshBasicMaterial color="#e8c43a" />
        </mesh>
      ))}

      {/* ============= BUILDINGS ============= */}
      {buildings.map((b, i) => <Building key={i} b={b} factoriesOn={factoriesOn} />)}

      {/* ============= CHIMNEYS ============= */}
      {chimneys.map((c, i) => (
        <group key={i} position={[c.x, -1.6, -2]}>
          {/* shaft */}
          <mesh position={[0, c.h / 2, 0]}>
            <boxGeometry args={[0.42, c.h, 0.42]} />
            <meshStandardMaterial color="#1a1d21" roughness={0.95} />
          </mesh>
          {/* red striped band */}
          <mesh position={[0, c.h - 0.3, 0]}>
            <boxGeometry args={[0.46, 0.2, 0.46]} />
            <meshStandardMaterial color="#c43e2b" roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* ============= STREETLIGHTS along foreground ============= */}
      {[-10, -6, -2, 2, 6, 10].map((x, i) => (
        <group key={i} position={[x, -1.6, 2]}>
          <mesh position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.06, 0.08, 2.2, 6]} />
            <meshStandardMaterial color="#2a2d33" />
          </mesh>
          <mesh position={[0, 2.25, 0]}>
            <sphereGeometry args={[0.16, 12, 12]} />
            <meshBasicMaterial color="#fff2a0" />
          </mesh>
          {/* small glow */}
          <mesh position={[0, 2.25, 0]}>
            <sphereGeometry args={[0.35, 12, 12]} />
            <meshBasicMaterial color="#fff2a0" transparent opacity={0.25} />
          </mesh>
        </group>
      ))}

      {/* ============= SMOKE PARTICLES ============= */}
      {smokeParticles.map((_, idx) => (
        <mesh key={idx} ref={collect(smokeRefs)} position={[0, -100, 0]}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial color="#5a5860" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}

      {/* ============= BIRDS ============= */}
      {birds.map((_, i) => (
        <group key={i} ref={(el) => (birdRefs.current[i] = el)} visible={false}>
          <mesh>
            <coneGeometry args={[0.08, 0.3, 4]} />
            <meshBasicMaterial color="#1a1a1a" />
          </mesh>
        </group>
      ))}

      {/* ============= LIGHTS ============= */}
      <ambientLight intensity={0.4 + cleanliness * 0.45} color={cleanliness > 0.5 ? '#cfe9ff' : '#caa86a'} />
      <directionalLight position={[5, 6, 4]} intensity={0.5 + cleanliness * 0.7} color="#ffffff" />
      <hemisphereLight args={['#9dd2f5', '#3a2f1f', 0.3]} />
    </group>
  );
}

/* ---------- Building component (per-building façade) ---------- */
function Building({ b, factoriesOn }) {
  return (
    <group position={[b.x, b.h / 2 - 1.6, -1.5]}>
      {/* main body */}
      <mesh>
        <boxGeometry args={[b.w, b.h, 0.7]} />
        <meshStandardMaterial color={b.color} roughness={0.85} />
      </mesh>
      {/* roof slab */}
      <mesh position={[0, b.h / 2 + 0.05, 0]}>
        <boxGeometry args={[b.w + 0.08, 0.1, 0.74]} />
        <meshStandardMaterial color={b.roofColor} roughness={0.9} />
      </mesh>
      {/* window grid — each window is a small lit plane on the façade */}
      {b.windows.map((win, k) => (
        <mesh key={k} position={[win.x, win.y - b.h / 2, 0.36]}>
          <planeGeometry args={[win.w, win.h]} />
          <meshBasicMaterial
            color={win.on && factoriesOn ? '#ffd86b' : (b.color === '#1e252e' ? '#0c1218' : '#283042')}
            transparent
            opacity={win.on && factoriesOn ? 0.95 : 0.7}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ---------- city generator ---------- */
function generateBuildings() {
  const arr = [];
  let x = -7.5;
  const palette = ['#1e252e', '#222a36', '#2a313a', '#26303c', '#1a2028'];
  const roofs   = ['#0a0e15', '#101620', '#161b25'];

  while (x < 7.5) {
    const w = 0.7 + Math.random() * 1.0;
    const h = 1.6 + Math.random() * 3.2;
    const color = palette[Math.floor(Math.random() * palette.length)];
    const roofColor = roofs[Math.floor(Math.random() * roofs.length)];

    // Window grid — varies by building size
    const cols = 2 + Math.floor(w * 1.5);
    const rows = Math.max(2, Math.floor(h * 1.8));
    const winW = (w - 0.18) / cols * 0.7;
    const winH = (h - 0.3) / rows * 0.55;
    const colSpace = (w - 0.18) / cols;
    const rowSpace = (h - 0.3) / rows;

    const windows = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // 70% lit windows
        const on = Math.random() > 0.30;
        windows.push({
          x: -w / 2 + 0.09 + c * colSpace + colSpace / 2,
          y: 0.15 + r * rowSpace + rowSpace / 2,
          w: winW,
          h: winH,
          on,
        });
      }
    }
    arr.push({ x: x + w / 2, w, h, color, roofColor, windows });
    x += w + 0.05;
  }
  return arr;
}
