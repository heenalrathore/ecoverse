import { useEffect, useRef, useState } from 'react';
import ModuleFrame from '../components/ModuleFrame';
import { useCanvasScene } from '../hooks/useCanvasScene';
import { useGesture } from '../hooks/useGesture';
import { useScore } from '../hooks/useScore';
import { useSound } from '../hooks/useSound';
import { MODULE_THEMES } from '../utils/colors';

const THEME = MODULE_THEMES.rhythm;

/**
 * Interactive musical forest. Each finger count "plays an instrument" — we
 * spawn a different particle system per gesture so visitors can SEE the music
 * even without audio files installed.
 *
 *   1 finger  — wind-chime: sparse rising sparkles (purple)
 *   2 fingers — birds:      flock of fast upward streaks (cyan)
 *   3 fingers — rain:       dense downward streaks (blue)
 *   5 fingers — orchestra:  multi-hue radial burst from center
 *   both      — thunder:    full-screen flash + jagged bolt
 */
export default function EcoRhythm() {
  const stateRef = useRef({
    particles: [],
    waveformOffset: 0,
    flashUntil: 0,
    boltUntil: 0,
    intensity: 0,
    instruments: { wind: 0, birds: 0, rain: 0, orchestra: 0, thunder: 0 },
    trees: spawnTreeline(),
    fireflies: spawnFireflies(40),
  });

  const [toast, setToast] = useState(null);
  const [played, setPlayed] = useState(0);
  const toastTimer = useRef(null);
  const { bump } = useScore();
  const { play, preload } = useSound();

  useEffect(() => { preload(['wind', 'birds', 'rain', 'thunder', 'chime']); }, [preload]);
  const flashToast = (m) => {
    setToast(m); clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1300);
  };

  useGesture((g) => {
    const s = stateRef.current;
    const W = window.innerWidth, H = window.innerHeight;
    s.intensity = Math.min(1, s.intensity + 0.18);

    switch (g) {
      case 'one_finger':
        // sparse upward chimes
        for (let i = 0; i < 14; i++) s.particles.push(spawnChime(W, H));
        s.instruments.wind++;
        bump({ health: 1, oxygen: 10 });
        play('wind');
        flashToast('☝ Wind chimes');
        break;
      case 'two_fingers':
        // bird flock — fast upward streaks
        for (let i = 0; i < 28; i++) s.particles.push(spawnBird(W, H));
        s.instruments.birds++;
        bump({ health: 2, oxygen: 20 });
        play('birds');
        flashToast('✌ Birds chorus');
        break;
      case 'three_fingers':
        // rain — many downward streaks
        for (let i = 0; i < 80; i++) s.particles.push(spawnRain(W, H));
        s.instruments.rain++;
        bump({ health: 2, oxygen: 25 });
        play('rain');
        flashToast('🤟 Rain');
        break;
      case 'five_fingers':
        // orchestra — radial burst from center, multi-hue
        for (let i = 0; i < 120; i++) s.particles.push(spawnOrchestra(W, H));
        s.instruments.orchestra++;
        bump({ health: 4, oxygen: 60 });
        play('chord');
        flashToast('🖐 Full orchestra');
        break;
      case 'both_hands':
        // thunder — flash + bolt
        s.flashUntil = performance.now() + 220;
        s.boltUntil = performance.now() + 320;
        s.instruments.thunder++;
        bump({ health: 6, oxygen: 80 });
        play('thunder');
        flashToast('🙌 THUNDER');
        break;
      default: return;
    }
    setPlayed((n) => n + 1);
  });

  const canvasRef = useCanvasScene((ctx, W, H, t, dt) => {
    const s = stateRef.current;

    // Decay intensity
    s.intensity = Math.max(0, s.intensity - dt * 0.25);

    // Sky gradient (purple → mid → dark)
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#3a1860');
    grd.addColorStop(0.55, '#1b1138');
    grd.addColorStop(1, '#080418');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);

    // Moon — multi-layer glow + surface craters
    const mx = W * 0.82, my = H * 0.18;
    // outer haze
    const haze = ctx.createRadialGradient(mx, my, 30, mx, my, 150);
    haze.addColorStop(0, 'rgba(255, 240, 220, 0.35)');
    haze.addColorStop(0.4, 'rgba(255, 240, 220, 0.10)');
    haze.addColorStop(1, 'rgba(255, 240, 220, 0)');
    ctx.fillStyle = haze;
    ctx.fillRect(mx - 160, my - 160, 320, 320);
    // moon surface gradient
    const surfaceG = ctx.createRadialGradient(mx - 12, my - 12, 5, mx, my, 42);
    surfaceG.addColorStop(0, '#fff8e8');
    surfaceG.addColorStop(0.7, '#f0e0c0');
    surfaceG.addColorStop(1, '#c0a890');
    ctx.fillStyle = surfaceG;
    ctx.beginPath(); ctx.arc(mx, my, 42, 0, Math.PI * 2); ctx.fill();
    // craters — small dark dots
    const craters = [[-10, -8, 4], [12, -4, 3], [-5, 14, 5], [16, 12, 3], [4, 6, 2], [-15, 4, 2]];
    ctx.fillStyle = 'rgba(120, 100, 80, 0.5)';
    for (const [dx, dy, r] of craters) {
      ctx.beginPath(); ctx.arc(mx + dx, my + dy, r, 0, Math.PI * 2); ctx.fill();
    }

    // Thunder flash overlay
    if (t < s.flashUntil) {
      const fade = (s.flashUntil - t) / 220;
      ctx.fillStyle = `rgba(220, 200, 255, ${0.65 * fade})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Lightning bolt
    if (t < s.boltUntil) {
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      let bx = W * 0.55, by = 0;
      ctx.moveTo(bx, by);
      while (by < H * 0.78) {
        bx += (Math.random() - 0.5) * 80;
        by += 30 + Math.random() * 30;
        ctx.lineTo(bx, by);
      }
      ctx.stroke();
    }

    // Rhythm waveform — pulses with current intensity
    s.waveformOffset += dt * (0.6 + s.intensity * 4);
    ctx.strokeStyle = `rgba(198, 137, 255, ${0.55 + s.intensity * 0.35})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 6) {
      const amp = 18 + s.intensity * 80;
      const f1 = Math.sin(x * 0.02 + s.waveformOffset) * amp;
      const f2 = Math.sin(x * 0.005 + s.waveformOffset * 0.7) * amp * 0.4;
      const y = H * 0.55 + f1 + f2;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Particles
    for (let i = s.particles.length - 1; i >= 0; i--) {
      const p = s.particles[i];
      p.vy += (p.gravity || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0 || p.y < -20 || p.y > H + 30 || p.x < -30 || p.x > W + 30) {
        s.particles.splice(i, 1); continue;
      }
      ctx.fillStyle = p.color.replace('ALPHA', String(Math.min(1, p.life * 1.4)));
      if (p.shape === 'streak') {
        ctx.fillRect(p.x, p.y, p.w, p.h);
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Fireflies — slow-drifting yellow glow dots between mid-ground and foreground
    for (const f of s.fireflies) {
      f.phaseX += dt * f.speedX;
      f.phaseY += dt * f.speedY;
      const fx = f.baseX * W + Math.sin(f.phaseX) * 40;
      const fy = f.baseY * H + Math.cos(f.phaseY) * 30;
      const flicker = (Math.sin(t * 0.005 + f.seed) + 1) / 2;
      // outer glow
      const glow = ctx.createRadialGradient(fx, fy, 0, fx, fy, 18);
      glow.addColorStop(0, `rgba(255, 240, 130, ${0.55 * flicker})`);
      glow.addColorStop(1, 'rgba(255, 240, 130, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(fx, fy, 18, 0, Math.PI * 2); ctx.fill();
      // body
      ctx.fillStyle = `rgba(255, 252, 200, ${0.85 * flicker + 0.15})`;
      ctx.beginPath(); ctx.arc(fx, fy, 2, 0, Math.PI * 2); ctx.fill();
    }

    // Foreground forest silhouette (animated sway, multi-lobe organic shapes)
    for (let i = 0; i < s.trees.length; i++) {
      const tr = s.trees[i];
      const sway = Math.sin(t * 0.0015 + i) * 4;
      drawTreeSilhouette(ctx, tr.x * W + sway, H * 0.92, tr.scale, tr.kind);
    }
    // Ground line
    ctx.fillStyle = '#040a18';
    ctx.fillRect(0, H * 0.92, W, H * 0.08);
  });

  return (
    <ModuleFrame
      theme={THEME}
      title="Eco Rhythm Experience"
      tagline="Conduct a living forest of sound. Each hand pose plays a different instrument."
      stats={[
        { label: 'Notes played', value: played },
        { label: 'Intensity',    value: Math.round(stateRef.current.intensity * 100) + '%' },
      ]}
      gestures={[
        { label: '☝ 1 finger',    does: 'Wind chimes' },
        { label: '✌ 2 fingers',   does: 'Birds chorus' },
        { label: '🤟 3 fingers',  does: 'Rainfall' },
        { label: '🖐 5 fingers',  does: 'Full orchestra' },
        { label: '🙌 Both hands', does: 'THUNDER',  wide: true },
      ]}
      toast={toast}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
    </ModuleFrame>
  );
}

/* ---- spawners ---- */
function spawnTreeline() {
  const arr = [];
  for (let i = 0; i < 22; i++) {
    arr.push({
      x: i / 21 + (Math.random() - 0.5) * 0.02,
      scale: 0.65 + Math.random() * 0.95,
      kind: Math.random() < 0.35 ? 'pine' : 'deciduous',
    });
  }
  return arr;
}
function spawnFireflies(n) {
  return Array.from({ length: n }, () => ({
    baseX: Math.random(),
    baseY: 0.55 + Math.random() * 0.35,
    phaseX: Math.random() * Math.PI * 2,
    phaseY: Math.random() * Math.PI * 2,
    speedX: 0.4 + Math.random() * 0.5,
    speedY: 0.3 + Math.random() * 0.4,
    seed: Math.random() * 100,
  }));
}
function spawnChime(W, H) {
  return {
    x: W * (0.2 + Math.random() * 0.6),
    y: H * (0.55 + Math.random() * 0.3),
    vx: (Math.random() - 0.5) * 30,
    vy: -40 - Math.random() * 60,
    r: 2 + Math.random() * 3,
    life: 1.5 + Math.random(),
    color: 'rgba(198,137,255,ALPHA)',
    shape: 'dot',
  };
}
function spawnBird(W, H) {
  return {
    x: W * Math.random(),
    y: H * (0.7 + Math.random() * 0.2),
    vx: (Math.random() - 0.5) * 80,
    vy: -160 - Math.random() * 100,
    r: 1.5 + Math.random() * 2.5,
    life: 1.3 + Math.random() * 0.6,
    color: 'rgba(159,240,255,ALPHA)',
    shape: 'dot',
  };
}
function spawnRain(W, H) {
  return {
    x: Math.random() * W,
    y: -20,
    vx: 0,
    vy: 240 + Math.random() * 160,
    w: 1.5,
    h: 8 + Math.random() * 8,
    life: 2.2,
    color: 'rgba(180,210,255,ALPHA)',
    shape: 'streak',
    gravity: 0,
  };
}
function spawnOrchestra(W, H) {
  const ang = Math.random() * Math.PI * 2;
  const sp = 120 + Math.random() * 320;
  const palette = ['198,137,255', '159,240,255', '193,255,126', '255,236,109', '255,138,92'];
  const c = palette[Math.floor(Math.random() * palette.length)];
  return {
    x: W / 2, y: H * 0.55,
    vx: Math.cos(ang) * sp,
    vy: Math.sin(ang) * sp,
    r: 2 + Math.random() * 3,
    life: 1.6 + Math.random() * 0.5,
    color: `rgba(${c},ALPHA)`,
    shape: 'dot',
    gravity: 60,
  };
}
/**
 * Multi-lobe organic tree silhouette.
 * `kind`: 'deciduous' → fluffy round canopy of overlapping circles
 *         'pine' → layered conifer (stacked triangles, narrower toward top)
 */
function drawTreeSilhouette(ctx, x, y, scale, kind = 'deciduous') {
  ctx.fillStyle = '#020608';

  if (kind === 'pine') {
    // Trunk
    ctx.fillRect(x - 3 * scale, y - 22 * scale, 6 * scale, 22 * scale);
    // 4 stacked tiers
    const tierH = 28 * scale;
    let tierY = y - 22 * scale;
    let tierW = 36 * scale;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x - tierW, tierY);
      ctx.lineTo(x, tierY - tierH);
      ctx.lineTo(x + tierW, tierY);
      ctx.closePath();
      ctx.fill();
      tierY -= tierH * 0.75;
      tierW *= 0.78;
    }
    return;
  }

  // Deciduous — fat trunk + multi-lobe round canopy
  // Trunk
  ctx.fillRect(x - 5 * scale, y - 35 * scale, 10 * scale, 35 * scale);
  // Canopy lobes — central + 4 surrounding for an organic fluff
  const canopyY = y - 65 * scale;
  const lobes = [
    [0, 0, 38 * scale],
    [-26 * scale, 6 * scale, 26 * scale],
    [26 * scale, 6 * scale, 26 * scale],
    [-14 * scale, -22 * scale, 26 * scale],
    [14 * scale, -22 * scale, 26 * scale],
    [0, -32 * scale, 22 * scale],
  ];
  for (const [dx, dy, r] of lobes) {
    ctx.beginPath();
    ctx.arc(x + dx, canopyY + dy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}
