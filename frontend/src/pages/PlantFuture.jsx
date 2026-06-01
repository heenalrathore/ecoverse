import { useEffect, useRef, useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import ForestScene from '../three/ForestScene';
import { useCanvasScene } from '../hooks/useCanvasScene';
import { useGesture } from '../hooks/useGesture';
import { useScore } from '../hooks/useScore';
import { useSound } from '../hooks/useSound';
import { MODULE_THEMES } from '../utils/colors';

/**
 * Plant vs. Carbon Monster — merged module.
 *
 * A 3D living forest (ForestScene, R3F) with a 2D Carbon Monster battle layered on top
 * (transparent canvas overlay). The story: a Carbon Monster looms over the world —
 * emit CO₂ blasts to battle it (✌), and grow a forest (☝) whose trees also weaken it,
 * while you control the weather (🤟 sun, 🖐 snow). ✊ fist exits (handled in Navbar).
 */
const THEME = MODULE_THEMES.forest;
const MONSTER_HP = 100;

export default function PlantFuture() {
  const sceneRef = useRef(null);
  const battleRef = useRef({
    monsterHP: MONSTER_HP,
    defeatedAt: 0,
    phase: 0,
    blasts: [],   // CO₂ projectiles rising to the monster
    smog: [],     // monster's counter-attack puffs drifting over the forest
    bursts: [],   // hit particles
    smogTimer: 1.5,
  });
  const [toast, setToast] = useState(null);
  const [today, setToday] = useState(0);
  const [monsterHP, setMonsterHP] = useState(MONSTER_HP);
  const [victory, setVictory] = useState(false);
  const { bump, score } = useScore();
  const { play, preload } = useSound();
  const toastTimer = useRef(null);

  useEffect(() => { preload(['rain', 'pop', 'whoosh', 'birds', 'power']); }, [preload]);

  const flashToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1500);
  };
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // Mirror battle state into React for the HUD (low frequency is plenty)
  useEffect(() => {
    const id = setInterval(() => {
      const s = battleRef.current;
      setMonsterHP(Math.max(0, Math.round(s.monsterHP)));
      if (s.defeatedAt > 0) setVictory(true);
    }, 150);
    return () => clearInterval(id);
  }, []);

  // Reward once when the monster is defeated
  useEffect(() => { if (victory) bump({ health: 30, oxygen: 1500 }); }, [victory, bump]);

  useGesture((g, frame) => {
    if (!sceneRef.current) return;
    const s = battleRef.current;
    switch (g) {
      case 'two_fingers': // Emit CO₂ — battle the monster
        if (s.defeatedAt === 0) {
          emitCO2(s, 3, 9);
          play('whoosh');
          flashToast('✌ CO₂ blast — strike the monster');
        } else {
          flashToast('✌ The monster is gone');
        }
        bump({ health: 1, oxygen: 8 });
        break;

      case 'one_finger': { // Grow a tree (trees also weaken the carbon monster)
        const lm = frame.landmarks;
        const tip = lm && lm[8];
        const px = tip ? (1 - tip.x) : Math.random();
        const worldX = (px - 0.5) * 14;
        if (sceneRef.current.plantTree(worldX)) {
          setToday((t) => t + 1);
          bump({ health: 2, oxygen: 30, trees: 1 });
          play('pop');
          if (s.defeatedAt === 0) { s.monsterHP -= 2.5; risingLeaf(s); }
          flashToast('☝ Tree planted');
        } else {
          flashToast('🌲 Forest is full');
        }
        break;
      }

      case 'three_fingers': // Sun rises
        sceneRef.current.sunlight();
        bump({ health: 4, oxygen: 40 });
        play('whoosh');
        flashToast('🤟 The sun rises');
        break;

      case 'five_fingers': // Snowfall
        sceneRef.current.snow();
        bump({ health: 2, oxygen: 20 });
        play('birds');
        flashToast('🖐 Snowfall');
        break;

      case 'both_hands': { // Bonus: forest surge + heavy CO₂ strike
        const planted = sceneRef.current.plantBurst();
        if (planted) { setToday((t) => t + planted); bump({ health: 8, oxygen: planted * 30, trees: planted }); }
        if (s.defeatedAt === 0) { emitCO2(s, 6, 26); s.monsterHP -= 6; }
        play('birds');
        flashToast('🙌 Forest surge!');
        break;
      }

      default: break; // 'fist' is handled globally in Navbar (exit to home)
    }
  });

  // ---- 2D Carbon Monster battle overlay (transparent — forest shows through) ----
  const canvasRef = useCanvasScene((ctx, W, H, t, dt) => {
    const s = battleRef.current;
    s.phase += dt;
    const mx = W * 0.5, my = H * 0.26;

    if (s.defeatedAt === 0) {
      const sway = Math.sin(s.phase * 1.2) * 8;
      const breath = 1 + Math.sin(s.phase * 2) * 0.04;
      drawMonster(ctx, mx + sway, my, 0.82 * breath, Math.max(0, s.monsterHP) / MONSTER_HP);

      s.smogTimer -= dt;
      if (s.smogTimer <= 0) {
        s.smogTimer = 1.6 + Math.random() * 1.2;
        s.smog.push({ x: mx + (Math.random() - 0.5) * 130, y: my + 55, vx: (Math.random() - 0.5) * 26, vy: 55 + Math.random() * 40, r: 15 + Math.random() * 14, life: 3 });
      }
    } else {
      const since = (t - s.defeatedAt) / 1000;
      const cnt = Math.max(0, 70 - Math.floor(since * 26));
      for (let i = 0; i < cnt; i++) {
        const ang = (i / cnt) * Math.PI * 2, r = 30 + since * 90;
        ctx.fillStyle = `rgba(122,245,152,${Math.max(0, 1 - since * 0.5)})`;
        ctx.beginPath(); ctx.arc(mx + Math.cos(ang) * r, my + Math.sin(ang) * r - since * 50, 3 + Math.random() * 4, 0, Math.PI * 2); ctx.fill();
      }
    }

    // monster smog drifting down over the forest
    for (let i = s.smog.length - 1; i >= 0; i--) {
      const a = s.smog[i];
      a.x += a.vx * dt; a.y += a.vy * dt; a.life -= dt;
      if (a.life <= 0) { s.smog.splice(i, 1); continue; }
      const al = Math.min(1, a.life) * 0.28;
      ctx.fillStyle = `rgba(70,58,68,${al})`;
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(110,80,90,${al * 0.6})`;
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r * 1.5, 0, Math.PI * 2); ctx.fill();
    }

    // CO₂ blasts rising toward the monster
    for (let i = s.blasts.length - 1; i >= 0; i--) {
      const b = s.blasts[i];
      b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > 8) b.trail.shift();
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (s.defeatedAt === 0 && b.y < my + 32 && Math.abs(b.x - mx) < 95) {
        s.monsterHP -= b.damage;
        for (let k = 0; k < 14; k++) s.bursts.push({ x: b.x, y: b.y, vx: (Math.random() - 0.5) * 340, vy: (Math.random() - 0.5) * 340, life: 0.6 + Math.random() * 0.3, c: [193, 255, 126] });
        s.blasts.splice(i, 1);
        if (s.monsterHP <= 0 && s.defeatedAt === 0) s.defeatedAt = t;
        continue;
      }
      if (b.life <= 0 || b.y < -40) { s.blasts.splice(i, 1); continue; }
      for (let k = 0; k < b.trail.length; k++) {
        const tp = b.trail[k];
        ctx.fillStyle = `rgba(150,200,140,${(k / b.trail.length) * 0.5})`;
        ctx.beginPath(); ctx.arc(tp.x, tp.y, 3 + k * 0.3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(190,235,160,0.95)';
      ctx.shadowColor = '#9fd08a'; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(b.x, b.y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }

    // hit particles
    for (let i = s.bursts.length - 1; i >= 0; i--) {
      const p = s.bursts[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0) { s.bursts.splice(i, 1); continue; }
      ctx.fillStyle = `rgba(${p.c[0]},${p.c[1]},${p.c[2]},${Math.min(1, p.life * 1.6)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
    }

    // monster HP bar
    if (s.defeatedAt === 0) {
      const bw = Math.min(520, W * 0.46), bx = (W - bw) / 2, by = 86;
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(bx - 4, by - 4, bw + 8, 16);
      ctx.fillStyle = '#ff6d6d'; ctx.fillRect(bx, by, bw * Math.max(0, s.monsterHP / MONSTER_HP), 8);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = 'bold 11px Sora, system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('CARBON MONSTER', W / 2, by + 26); ctx.textAlign = 'start';
    }
  });

  return (
    <section className={`relative min-h-screen bg-gradient-to-b ${THEME.gradient} overflow-hidden`}>
      <div className="absolute inset-0">
        <Canvas
          shadows="percentage"
          dpr={[1, 1.5]}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
          camera={{ position: [0, 1.5, 8.5], fov: 54, near: 0.1, far: 3000 }}
        >
          <Suspense fallback={null}>
            <ForestScene ref={sceneRef} />
          </Suspense>
        </Canvas>
      </div>

      {/* Carbon Monster battle overlay (visual only) */}
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-[2]" />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(10,42,31,0.30)_100%)]" />

      <div className="relative z-10 pt-28 px-6 max-w-6xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="font-display text-4xl md:text-5xl font-extrabold tracking-tight"
          style={{ color: THEME.color, textShadow: `0 2px 18px rgba(255,255,255,.7), 0 0 24px ${THEME.color}55` }}
        >
          Plant vs. Carbon Monster
        </motion.h2>
        <p className="mt-3 text-eco-ink font-medium max-w-xl" style={{ textShadow: '0 2px 10px rgba(255,255,255,.7)' }}>
          Emit CO₂ to battle the monster, then grow your forest to heal the world.
        </p>

        <div className="mt-6 flex flex-wrap gap-4 items-stretch">
          <div className="glass-strong rounded-2xl p-4 min-w-[200px]">
            <div className="text-[10px] uppercase tracking-widest text-eco-ink2">Trees planted today</div>
            <div className="font-display text-4xl tabular-nums font-extrabold" style={{ color: THEME.color }}>
              {today}
            </div>
            <div className="text-[11px] text-eco-ink2 mt-1">
              All-time: <span className="text-eco-ink font-semibold">{score.trees}</span>
            </div>
          </div>

          <div className="glass-strong rounded-2xl p-4 min-w-[200px]">
            <div className="text-[10px] uppercase tracking-widest text-eco-ink2">Carbon Monster</div>
            <div className="font-display text-4xl tabular-nums font-extrabold" style={{ color: victory ? THEME.color : '#e84a4a' }}>
              {victory ? 'DEFEATED' : `${monsterHP}%`}
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-black/15 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${monsterHP}%`, background: victory ? THEME.color : '#e84a4a' }} />
            </div>
          </div>

          <div className="glass rounded-2xl p-4 text-xs leading-relaxed text-eco-ink">
            <div className="text-[10px] uppercase tracking-widest text-eco-ink2 mb-2">Gestures</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              <div><span className="font-bold" style={{ color: THEME.color }}>☝ 1 finger</span> · Grow a tree</div>
              <div><span className="font-bold" style={{ color: '#e84a4a' }}>✌ 2 fingers</span> · Emit CO₂ · battle</div>
              <div><span className="font-bold" style={{ color: THEME.color }}>🤟 3 fingers</span> · Sun rises</div>
              <div><span className="font-bold" style={{ color: THEME.color }}>🖐 5 fingers</span> · Snowfall</div>
              <div><span className="font-bold" style={{ color: THEME.color }}>🙌 Both hands</span> · Forest surge</div>
              <div><span className="font-bold" style={{ color: THEME.color }}>✊ Fist</span> · Exit</div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {victory && (
          <motion.div
            key="victory"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-20 grid place-items-center"
          >
            <div className="text-center px-8">
              <div className="font-display text-[clamp(34px,6vw,76px)] font-extrabold gradient-text neon-text">
                CARBON MONSTER<br />DEFEATED
              </div>
              <div className="mt-4 text-eco-ink text-lg font-medium" style={{ textShadow: '0 2px 10px rgba(255,255,255,.7)' }}>
                Your forest healed the world. Keep planting, or ✊ fist to exit.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast}
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            className="fixed left-1/2 -translate-x-1/2 top-24 z-30 px-5 py-2.5 rounded-full glass-strong font-bold"
            style={{ color: THEME.color, boxShadow: `0 8px 28px ${THEME.color}44` }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/* ---------- battle helpers ---------- */
function emitCO2(s, count, damage) {
  const W = window.innerWidth, H = window.innerHeight;
  for (let i = 0; i < count; i++) {
    s.blasts.push({
      x: W * 0.5 + (i - (count - 1) / 2) * 24, y: H * 0.84,
      vx: (Math.random() - 0.5) * 70, vy: -700,
      damage: damage / count, life: 1.8, trail: [],
    });
  }
}

// little green leaf-spark rising when a tree damages the monster
function risingLeaf(s) {
  const W = window.innerWidth, H = window.innerHeight;
  for (let k = 0; k < 6; k++) {
    s.bursts.push({ x: W * (0.35 + Math.random() * 0.3), y: H * 0.7, vx: (Math.random() - 0.5) * 80, vy: -120 - Math.random() * 80, life: 0.8 + Math.random() * 0.4, c: [122, 245, 152] });
  }
}

/* ---------- Carbon Monster art (2D canvas) ---------- */
function drawMonster(ctx, cx, cy, scale, hpFrac) {
  const r = 70 * scale;
  const dark = lerpRgb([15, 8, 12], [45, 80, 50], 1 - hpFrac);
  const alpha = 0.65 + hpFrac * 0.30;

  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const px = cx + Math.cos(ang) * r * 1.4, py = cy + Math.sin(ang) * r * 1.4;
    const auraG = ctx.createRadialGradient(px, py, 0, px, py, r * 0.9);
    auraG.addColorStop(0, `rgba(60, 30, 50, ${alpha * 0.35})`);
    auraG.addColorStop(1, 'rgba(60, 30, 50, 0)');
    ctx.fillStyle = auraG;
    ctx.beginPath(); ctx.arc(px, py, r * 0.9, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 4; i++) {
    const wx = cx + (i - 1.5) * r * 0.45, wy = cy + r * 0.95 + i * 8;
    const wisp = ctx.createRadialGradient(wx, wy, 0, wx, wy, r * 0.5);
    wisp.addColorStop(0, `rgba(40, 20, 30, ${alpha * 0.4})`);
    wisp.addColorStop(1, 'rgba(40, 20, 30, 0)');
    ctx.fillStyle = wisp;
    ctx.beginPath(); ctx.arc(wx, wy, r * 0.5, 0, Math.PI * 2); ctx.fill();
  }

  ctx.fillStyle = `rgba(${dark.join(',')}, ${alpha})`;
  ctx.beginPath();
  ctx.moveTo(cx - r * 1.1, cy + r * 0.8);
  ctx.bezierCurveTo(cx - r * 1.4, cy + r * 0.3, cx - r * 1.5, cy - r * 0.2, cx - r * 1.0, cy - r * 0.6);
  ctx.bezierCurveTo(cx - r * 0.9, cy - r * 1.0, cx - r * 0.5, cy - r * 1.1, cx - r * 0.3, cy - r * 0.9);
  ctx.bezierCurveTo(cx - r * 0.1, cy - r * 0.7, cx + r * 0.1, cy - r * 0.7, cx + r * 0.3, cy - r * 0.9);
  ctx.bezierCurveTo(cx + r * 0.5, cy - r * 1.1, cx + r * 0.9, cy - r * 1.0, cx + r * 1.0, cy - r * 0.6);
  ctx.bezierCurveTo(cx + r * 1.5, cy - r * 0.2, cx + r * 1.4, cy + r * 0.3, cx + r * 1.1, cy + r * 0.8);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = `rgba(15, 8, 12, ${alpha + 0.15})`;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.85, cy - r * 0.65);
  ctx.bezierCurveTo(cx - r * 1.0, cy - r * 1.3, cx - r * 1.05, cy - r * 1.7, cx - r * 0.75, cy - r * 1.85);
  ctx.bezierCurveTo(cx - r * 0.65, cy - r * 1.3, cx - r * 0.68, cy - r * 0.9, cx - r * 0.55, cy - r * 0.75);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.85, cy - r * 0.65);
  ctx.bezierCurveTo(cx + r * 1.0, cy - r * 1.3, cx + r * 1.05, cy - r * 1.7, cx + r * 0.75, cy - r * 1.85);
  ctx.bezierCurveTo(cx + r * 0.65, cy - r * 1.3, cx + r * 0.68, cy - r * 0.9, cx + r * 0.55, cy - r * 0.75);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = `rgba(15, 8, 12, ${alpha + 0.2})`;
  for (const side of [-1, 1]) {
    const handX = cx + side * r * 1.25, handY = cy + r * 0.1;
    for (let i = -1; i <= 1; i++) {
      const clawAng = (i * 0.5) - (side > 0 ? Math.PI : 0);
      const tipX = handX + Math.cos(clawAng) * r * 0.45, tipY = handY + Math.sin(clawAng) * r * 0.45;
      ctx.beginPath(); ctx.moveTo(handX, handY);
      ctx.lineTo(tipX - 3, tipY - 1); ctx.lineTo(tipX, tipY); ctx.lineTo(tipX - 1, tipY + 3);
      ctx.closePath(); ctx.fill();
    }
  }

  const eyeY = cy - r * 0.25;
  for (const side of [-1, 1]) {
    const eyeX = cx + side * r * 0.32;
    const eyeGlow = ctx.createRadialGradient(eyeX, eyeY, 0, eyeX, eyeY, 16);
    eyeGlow.addColorStop(0, `rgba(255, 80, 30, ${alpha + 0.3})`);
    eyeGlow.addColorStop(1, 'rgba(255, 80, 30, 0)');
    ctx.fillStyle = eyeGlow;
    ctx.beginPath(); ctx.arc(eyeX, eyeY, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255, 220, 50, ${alpha + 0.3})`;
    ctx.beginPath(); ctx.ellipse(eyeX, eyeY, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a0808';
    ctx.beginPath(); ctx.ellipse(eyeX, eyeY, 1.5, 4, 0, 0, Math.PI * 2); ctx.fill();
  }

  ctx.fillStyle = `rgba(20, 8, 12, ${alpha + 0.1})`;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.35, cy + r * 0.2);
  ctx.quadraticCurveTo(cx, cy + r * 0.45, cx + r * 0.35, cy + r * 0.2);
  ctx.lineTo(cx + r * 0.32, cy + r * 0.25);
  ctx.quadraticCurveTo(cx, cy + r * 0.35, cx - r * 0.32, cy + r * 0.25);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = `rgba(240, 230, 210, ${alpha + 0.1})`;
  for (let i = 0; i < 5; i++) {
    const fx = cx - r * 0.30 + (i / 4) * r * 0.6, fy = cy + r * 0.22;
    ctx.beginPath(); ctx.moveTo(fx - r * 0.04, fy); ctx.lineTo(fx + r * 0.04, fy); ctx.lineTo(fx, fy + r * 0.12);
    ctx.closePath(); ctx.fill();
  }
}

function lerpRgb(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}
