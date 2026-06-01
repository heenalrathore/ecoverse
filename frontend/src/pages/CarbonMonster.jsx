import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ModuleFrame from '../components/ModuleFrame';
import { useCanvasScene } from '../hooks/useCanvasScene';
import { useGesture } from '../hooks/useGesture';
import { useScore } from '../hooks/useScore';
import { useSound } from '../hooks/useSound';
import { MODULE_THEMES } from '../utils/colors';

const THEME = MODULE_THEMES.monster;
const MONSTER_MAX_HP = 100;
const EARTH_MAX_HP = 100;

export default function CarbonMonster() {
  const navigate = useNavigate();
  const stateRef = useRef({
    monsterHP: MONSTER_MAX_HP,
    earthHP: 35,                  // matches initial score.health default
    bolts: [],                    // active energy bolts traveling toward monster
    smokeAttacks: [],             // toxic puffs the monster fires back
    bursts: [],                   // particle explosions on hit
    defeatedAt: 0,                // performance.now() when monster died (0 = alive)
    healFlashUntil: 0,
    monsterPhase: 0,              // walking-toward-camera oscillator
  });

  const [hpView, setHpView] = useState({ monster: MONSTER_MAX_HP, earth: 35 });
  const [toast, setToast] = useState(null);
  const [showVictory, setShowVictory] = useState(false);
  const toastTimer = useRef(null);
  const { bump } = useScore();
  const { play, preload } = useSound();

  useEffect(() => { preload(['power', 'whoosh', 'thunder', 'chime']); }, [preload]);
  const flashToast = (m) => {
    setToast(m); clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1300);
  };

  // Periodically refresh HUD state from canvas refs (60fps→2fps is plenty for the bars)
  useEffect(() => {
    const id = setInterval(() => {
      const s = stateRef.current;
      setHpView({ monster: Math.max(0, s.monsterHP), earth: Math.max(0, s.earthHP) });
    }, 120);
    return () => clearInterval(id);
  }, []);

  // Monster periodically counter-attacks — drains Earth HP over time
  useEffect(() => {
    const id = setInterval(() => {
      const s = stateRef.current;
      if (s.defeatedAt > 0) return;
      // queue a smoke attack from monster toward Earth (right side)
      const W = window.innerWidth, H = window.innerHeight;
      s.smokeAttacks.push({
        x: W * 0.28, y: H * 0.5 + (Math.random() - 0.5) * 60,
        vx: 220, vy: (Math.random() - 0.5) * 40,
        r: 14, life: 2.5, damage: 4,
      });
    }, 2200);
    return () => clearInterval(id);
  }, []);

  // Win condition watcher
  useEffect(() => {
    if (hpView.monster <= 0 && !showVictory) {
      setShowVictory(true);
      bump({ health: 30, oxygen: 1500 });
      // navigate to ending after the cinematic finishes
      setTimeout(() => navigate('/ending'), 4200);
    }
  }, [hpView.monster, showVictory, bump, navigate]);

  const fireBolt = (s, count, damage) => {
    const W = window.innerWidth, H = window.innerHeight;
    for (let i = 0; i < count; i++) {
      s.bolts.push({
        x: W * 0.78, y: H * 0.55 + (i - (count - 1) / 2) * 28,
        vx: -700, vy: 0,
        damage: damage / count,
        life: 1.6,
        trail: [],
      });
    }
  };

  useGesture((g) => {
    const s = stateRef.current;
    if (s.defeatedAt > 0) return;
    switch (g) {
      case 'one_finger':
        fireBolt(s, 1, 3);
        bump({ health: 1, oxygen: 8 });
        play('whoosh');
        flashToast('☝ Energy bolt');
        break;
      case 'two_fingers':
        fireBolt(s, 2, 7);
        bump({ health: 2, oxygen: 16 });
        play('whoosh');
        flashToast('✌ Twin bolts');
        break;
      case 'three_fingers':
        fireBolt(s, 3, 12);
        bump({ health: 3, oxygen: 24 });
        play('power');
        flashToast('🤟 Triple strike');
        break;
      case 'five_fingers':
        s.earthHP = Math.min(EARTH_MAX_HP, s.earthHP + 12);
        s.healFlashUntil = performance.now() + 800;
        bump({ health: 4, oxygen: 100 });
        play('chime');
        flashToast('🖐 Earth healed');
        break;
      case 'both_hands':
        fireBolt(s, 5, 35);
        s.healFlashUntil = performance.now() + 800;
        s.earthHP = Math.min(EARTH_MAX_HP, s.earthHP + 8);
        bump({ health: 8, oxygen: 200 });
        play('thunder');
        flashToast('🙌 GUARDIAN ULTIMATE');
        break;
      default: break;
    }
  });

  const canvasRef = useCanvasScene((ctx, W, H, t, dt) => {
    const s = stateRef.current;
    s.monsterPhase += dt;

    // Stormy background gradient
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#1a0508');
    grd.addColorStop(0.6, '#2a0d12');
    grd.addColorStop(1, '#080406');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);

    // Distant lightning specks
    if (Math.random() < 0.005) {
      ctx.fillStyle = 'rgba(255,200,200,0.18)';
      ctx.fillRect(0, 0, W, H);
    }

    // Heal flash (when player heals Earth)
    if (t < s.healFlashUntil) {
      const fade = (s.healFlashUntil - t) / 800;
      ctx.fillStyle = `rgba(180, 255, 180, ${0.35 * fade})`;
      ctx.fillRect(0, 0, W, H);
    }

    // --- Earth on the right ---
    const earthX = W * 0.78, earthY = H * 0.55, earthR = 90;
    const hpFrac = s.earthHP / EARTH_MAX_HP;
    drawDetailedEarth(ctx, earthX, earthY, earthR, hpFrac, s.monsterPhase);

    // --- Monster on the left ---
    if (s.defeatedAt === 0) {
      const mx = W * 0.22, my = H * 0.5;
      const sway = Math.sin(s.monsterPhase * 1.3) * 6;
      const breath = 1 + Math.sin(s.monsterPhase * 2) * 0.04;
      drawMonster(ctx, mx + sway, my, 1 * breath, s.monsterHP / MONSTER_MAX_HP);
    } else {
      // dissolve animation — green particles drifting upward
      const since = (t - s.defeatedAt) / 1000;
      const cnt = Math.max(0, 60 - Math.floor(since * 30));
      for (let i = 0; i < cnt; i++) {
        const ang = (i / cnt) * Math.PI * 2;
        const r = 40 + since * 80;
        const px = W * 0.22 + Math.cos(ang) * r;
        const py = H * 0.5 + Math.sin(ang) * r - since * 60;
        ctx.fillStyle = `rgba(122, 245, 152, ${Math.max(0, 1 - since * 0.6)})`;
        ctx.beginPath(); ctx.arc(px, py, 3 + Math.random() * 4, 0, Math.PI * 2); ctx.fill();
      }
    }

    // --- Player energy bolts ---
    for (let i = s.bolts.length - 1; i >= 0; i--) {
      const b = s.bolts[i];
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 8) b.trail.shift();
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.life -= dt;

      // hit monster?
      if (b.x < W * 0.30 && s.defeatedAt === 0) {
        s.monsterHP -= b.damage;
        // spawn burst
        for (let k = 0; k < 14; k++) {
          s.bursts.push({
            x: b.x, y: b.y,
            vx: (Math.random() - 0.5) * 360, vy: (Math.random() - 0.5) * 360,
            life: 0.6 + Math.random() * 0.3, color: '#c1ff7e',
          });
        }
        s.bolts.splice(i, 1);
        if (s.monsterHP <= 0) s.defeatedAt = t;
        continue;
      }
      if (b.life <= 0 || b.x < -50) { s.bolts.splice(i, 1); continue; }

      // draw trail
      for (let k = 0; k < b.trail.length; k++) {
        const tp = b.trail[k];
        ctx.fillStyle = `rgba(122, 245, 152, ${(k / b.trail.length) * 0.7})`;
        ctx.beginPath(); ctx.arc(tp.x, tp.y, 3 + k * 0.3, 0, Math.PI * 2); ctx.fill();
      }
      // head
      ctx.fillStyle = 'rgba(193,255,126,1)';
      ctx.shadowColor = '#c1ff7e'; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(b.x, b.y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }

    // --- Monster smoke attacks ---
    for (let i = s.smokeAttacks.length - 1; i >= 0; i--) {
      const a = s.smokeAttacks[i];
      a.x += a.vx * dt; a.y += a.vy * dt;
      a.life -= dt;
      // hit Earth?
      if (Math.hypot(a.x - earthX, a.y - earthY) < earthR && a.damage > 0) {
        s.earthHP -= a.damage; a.damage = 0; a.life = 0.4;
        for (let k = 0; k < 10; k++) {
          s.bursts.push({
            x: a.x, y: a.y,
            vx: (Math.random() - 0.5) * 200, vy: (Math.random() - 0.5) * 200,
            life: 0.5, color: '#ff6d6d',
          });
        }
      }
      if (a.life <= 0 || a.x > W + 40) { s.smokeAttacks.splice(i, 1); continue; }
      ctx.fillStyle = `rgba(80, 50, 60, ${a.life * 0.4})`;
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(140, 50, 60, ${a.life * 0.25})`;
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r * 1.6, 0, Math.PI * 2); ctx.fill();
    }

    // --- Burst particles ---
    for (let i = s.bursts.length - 1; i >= 0; i--) {
      const p = s.bursts[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) { s.bursts.splice(i, 1); continue; }
      ctx.fillStyle = p.color.replace(')', `, ${p.life * 1.6})`).replace('#', 'rgba(').replace(/^rgba\(([0-9a-f]{6})/i, (_, hex) => {
        const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
        return `rgba(${r},${g},${b}`;
      });
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
    }

    // --- Monster HP bar at top ---
    if (s.defeatedAt === 0) {
      const bw = Math.min(560, W * 0.5);
      const bx = (W - bw) / 2, by = 100;
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(bx - 4, by - 4, bw + 8, 16);
      ctx.fillStyle = '#ff6d6d';
      ctx.fillRect(bx, by, bw * Math.max(0, s.monsterHP / MONSTER_MAX_HP), 8);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = 'bold 11px Sora, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CARBON MONSTER', W / 2, by + 28);
      ctx.textAlign = 'start';
    }
  });

  return (
    <ModuleFrame
      theme={THEME}
      title="Carbon Monster Battle"
      tagline="Become Earth Guardian. Strike the monster, heal the Earth."
      stats={[
        { label: 'Monster HP', value: Math.round(hpView.monster), color: '#ff6d6d' },
        { label: 'Earth HP',   value: Math.round(hpView.earth),   color: '#7af598' },
      ]}
      gestures={[
        { label: '☝ 1 finger',    does: 'Energy bolt' },
        { label: '✌ 2 fingers',   does: 'Twin bolts' },
        { label: '🤟 3 fingers',  does: 'Triple strike' },
        { label: '🖐 5 fingers',  does: 'Heal Earth' },
        { label: '🙌 Both hands', does: 'GUARDIAN ULTIMATE', wide: true },
      ]}
      toast={toast}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
      {showVictory && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/45 backdrop-blur-sm z-10">
          <div className="text-center px-8">
            <div className="font-display text-[clamp(36px,6vw,80px)] font-extrabold gradient-text neon-text">
              EARTH GUARDIAN<br />ACTIVATED
            </div>
            <div className="mt-4 text-white/85 text-lg">The Future Of Earth Is In Your Hands.</div>
          </div>
        </div>
      )}
    </ModuleFrame>
  );
}

/* ---- drawing helpers ---- */
function drawMonster(ctx, cx, cy, scale, hpFrac) {
  // Dark menacing creature. Becomes more translucent + tinges green as HP drops,
  // foreshadowing the dissolution into green particles on defeat.
  const r = 70 * scale;
  const dark = lerpRgb([15, 8, 12], [45, 80, 50], 1 - hpFrac);  // dark monster → greener with damage
  const alpha = 0.65 + hpFrac * 0.30;

  // -- Smoke aura around body
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const px = cx + Math.cos(ang) * r * 1.4;
    const py = cy + Math.sin(ang) * r * 1.4;
    const auraG = ctx.createRadialGradient(px, py, 0, px, py, r * 0.9);
    auraG.addColorStop(0, `rgba(60, 30, 50, ${alpha * 0.35})`);
    auraG.addColorStop(1, 'rgba(60, 30, 50, 0)');
    ctx.fillStyle = auraG;
    ctx.beginPath(); ctx.arc(px, py, r * 0.9, 0, Math.PI * 2); ctx.fill();
  }

  // -- Trailing smoke wisps below
  for (let i = 0; i < 4; i++) {
    const wx = cx + (i - 1.5) * r * 0.45;
    const wy = cy + r * 0.95 + i * 8;
    const wisp = ctx.createRadialGradient(wx, wy, 0, wx, wy, r * 0.5);
    wisp.addColorStop(0, `rgba(40, 20, 30, ${alpha * 0.4})`);
    wisp.addColorStop(1, 'rgba(40, 20, 30, 0)');
    ctx.fillStyle = wisp;
    ctx.beginPath(); ctx.arc(wx, wy, r * 0.5, 0, Math.PI * 2); ctx.fill();
  }

  // -- Body: asymmetric, hunched silhouette
  ctx.fillStyle = `rgba(${dark.join(',')}, ${alpha})`;
  ctx.beginPath();
  // Bottom-left
  ctx.moveTo(cx - r * 1.1, cy + r * 0.8);
  // Left side (curving up to shoulder)
  ctx.bezierCurveTo(cx - r * 1.4, cy + r * 0.3, cx - r * 1.5, cy - r * 0.2, cx - r * 1.0, cy - r * 0.6);
  // Left horn dip
  ctx.bezierCurveTo(cx - r * 0.9, cy - r * 1.0, cx - r * 0.5, cy - r * 1.1, cx - r * 0.3, cy - r * 0.9);
  // Between horns dip
  ctx.bezierCurveTo(cx - r * 0.1, cy - r * 0.7, cx + r * 0.1, cy - r * 0.7, cx + r * 0.3, cy - r * 0.9);
  // Right horn rise
  ctx.bezierCurveTo(cx + r * 0.5, cy - r * 1.1, cx + r * 0.9, cy - r * 1.0, cx + r * 1.0, cy - r * 0.6);
  // Right side down to base
  ctx.bezierCurveTo(cx + r * 1.5, cy - r * 0.2, cx + r * 1.4, cy + r * 0.3, cx + r * 1.1, cy + r * 0.8);
  ctx.closePath();
  ctx.fill();

  // -- HORNS (sharp curved spikes on top)
  ctx.fillStyle = `rgba(15, 8, 12, ${alpha + 0.15})`;
  // Left horn
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.85, cy - r * 0.65);
  ctx.bezierCurveTo(cx - r * 1.0, cy - r * 1.3, cx - r * 1.05, cy - r * 1.7, cx - r * 0.75, cy - r * 1.85);
  ctx.bezierCurveTo(cx - r * 0.65, cy - r * 1.3, cx - r * 0.68, cy - r * 0.9, cx - r * 0.55, cy - r * 0.75);
  ctx.closePath();
  ctx.fill();
  // Right horn (mirror)
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.85, cy - r * 0.65);
  ctx.bezierCurveTo(cx + r * 1.0, cy - r * 1.3, cx + r * 1.05, cy - r * 1.7, cx + r * 0.75, cy - r * 1.85);
  ctx.bezierCurveTo(cx + r * 0.65, cy - r * 1.3, cx + r * 0.68, cy - r * 0.9, cx + r * 0.55, cy - r * 0.75);
  ctx.closePath();
  ctx.fill();

  // -- CLAWS (3 spiked fingers reaching out left and right)
  ctx.fillStyle = `rgba(15, 8, 12, ${alpha + 0.2})`;
  for (const side of [-1, 1]) {
    const handX = cx + side * r * 1.25;
    const handY = cy + r * 0.1;
    for (let i = -1; i <= 1; i++) {
      const clawAng = (i * 0.5) - (side > 0 ? Math.PI : 0);
      const tipX = handX + Math.cos(clawAng) * r * 0.45;
      const tipY = handY + Math.sin(clawAng) * r * 0.45;
      ctx.beginPath();
      ctx.moveTo(handX, handY);
      ctx.lineTo(tipX - 3, tipY - 1);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(tipX - 1, tipY + 3);
      ctx.closePath();
      ctx.fill();
    }
  }

  // -- GLOWING EYES (slit-shaped, intense)
  const eyeY = cy - r * 0.25;
  for (const side of [-1, 1]) {
    const eyeX = cx + side * r * 0.32;
    // outer glow
    const eyeGlow = ctx.createRadialGradient(eyeX, eyeY, 0, eyeX, eyeY, 16);
    eyeGlow.addColorStop(0, `rgba(255, 80, 30, ${alpha + 0.3})`);
    eyeGlow.addColorStop(1, 'rgba(255, 80, 30, 0)');
    ctx.fillStyle = eyeGlow;
    ctx.beginPath(); ctx.arc(eyeX, eyeY, 16, 0, Math.PI * 2); ctx.fill();
    // slit pupil
    ctx.fillStyle = `rgba(255, 220, 50, ${alpha + 0.3})`;
    ctx.beginPath();
    ctx.ellipse(eyeX, eyeY, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // vertical slit
    ctx.fillStyle = '#1a0808';
    ctx.beginPath();
    ctx.ellipse(eyeX, eyeY, 1.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // -- MOUTH: snarling row of fangs
  ctx.fillStyle = `rgba(20, 8, 12, ${alpha + 0.1})`;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.35, cy + r * 0.2);
  ctx.quadraticCurveTo(cx, cy + r * 0.45, cx + r * 0.35, cy + r * 0.2);
  ctx.lineTo(cx + r * 0.32, cy + r * 0.25);
  ctx.quadraticCurveTo(cx, cy + r * 0.35, cx - r * 0.32, cy + r * 0.25);
  ctx.closePath();
  ctx.fill();
  // Fangs (5 triangular teeth pointing down)
  ctx.fillStyle = `rgba(240, 230, 210, ${alpha + 0.1})`;
  for (let i = 0; i < 5; i++) {
    const fx = cx - r * 0.30 + (i / 4) * r * 0.6;
    const fy = cy + r * 0.22;
    ctx.beginPath();
    ctx.moveTo(fx - r * 0.04, fy);
    ctx.lineTo(fx + r * 0.04, fy);
    ctx.lineTo(fx, fy + r * 0.12);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * Detailed Earth — continent silhouettes (Africa, Americas hints), cloud swirls,
 * atmospheric rim glow. Health drives the green vs scorched tint.
 */
function drawDetailedEarth(ctx, cx, cy, r, hpFrac, time = 0) {
  // Outer atmospheric glow
  const glow = ctx.createRadialGradient(cx, cy, r, cx, cy, r + 40);
  glow.addColorStop(0, `rgba(90, 200, 255, ${0.25 * hpFrac + 0.08})`);
  glow.addColorStop(1, 'rgba(90, 200, 255, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(cx, cy, r + 40, 0, Math.PI * 2); ctx.fill();

  // Healthy green-glow ring when high HP
  if (hpFrac > 0.4) {
    ctx.fillStyle = `rgba(122, 245, 152, ${0.18 * hpFrac})`;
    ctx.beginPath(); ctx.arc(cx, cy, r + 18, 0, Math.PI * 2); ctx.fill();
  }

  // Ocean base — radial gradient (lighter on lit side)
  const oceanCol = lerpRgb([60, 30, 30], [30, 120, 175], hpFrac);
  const lighterOcean = oceanCol.map((c) => Math.min(255, c + 40));
  const oceanG = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
  oceanG.addColorStop(0, `rgb(${lighterOcean.join(',')})`);
  oceanG.addColorStop(1, `rgb(${oceanCol.join(',')})`);
  ctx.fillStyle = oceanG;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

  // Continent shapes — drawn within a clip to the Earth circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const landCol = lerpRgb([110, 65, 35], [55, 130, 70], hpFrac);
  ctx.fillStyle = `rgb(${landCol.join(',')})`;

  // Africa-ish landmass (right-center, kidney-bean shape)
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.05, cy - r * 0.45);
  ctx.bezierCurveTo(cx + r * 0.35, cy - r * 0.5, cx + r * 0.5, cy - r * 0.2, cx + r * 0.45, cy + r * 0.1);
  ctx.bezierCurveTo(cx + r * 0.45, cy + r * 0.4, cx + r * 0.25, cy + r * 0.55, cx + r * 0.12, cy + r * 0.5);
  ctx.bezierCurveTo(cx - r * 0.05, cy + r * 0.35, cx - r * 0.1, cy + r * 0.1, cx - r * 0.05, cy - r * 0.1);
  ctx.bezierCurveTo(cx, cy - r * 0.3, cx + r * 0.0, cy - r * 0.4, cx + r * 0.05, cy - r * 0.45);
  ctx.closePath();
  ctx.fill();

  // Americas-ish landmass (left side, narrower, stretched vertical)
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.55, cy - r * 0.55);
  ctx.bezierCurveTo(cx - r * 0.35, cy - r * 0.6, cx - r * 0.3, cy - r * 0.3, cx - r * 0.4, cy - r * 0.05);
  ctx.bezierCurveTo(cx - r * 0.45, cy + r * 0.15, cx - r * 0.55, cy + r * 0.3, cx - r * 0.6, cy + r * 0.5);
  ctx.bezierCurveTo(cx - r * 0.7, cy + r * 0.4, cx - r * 0.75, cy + r * 0.1, cx - r * 0.7, cy - r * 0.15);
  ctx.bezierCurveTo(cx - r * 0.7, cy - r * 0.35, cx - r * 0.65, cy - r * 0.5, cx - r * 0.55, cy - r * 0.55);
  ctx.closePath();
  ctx.fill();

  // Asian / Pacific island scatter (top-right small blobs)
  for (const [dx, dy, br] of [[0.55, -0.45, 0.08], [0.62, -0.30, 0.06], [0.45, -0.62, 0.05]]) {
    ctx.beginPath();
    ctx.arc(cx + r * dx, cy + r * dy, r * br, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cloud swirls — rotate slowly with `time`
  const cloudCount = 6;
  ctx.fillStyle = `rgba(255, 255, 255, ${0.35 + hpFrac * 0.1})`;
  for (let i = 0; i < cloudCount; i++) {
    const ang = (i / cloudCount) * Math.PI * 2 + time * 0.05;
    const dist = r * (0.4 + (i % 2) * 0.3);
    const cdx = Math.cos(ang) * dist;
    const cdy = Math.sin(ang) * dist * 0.6;
    ctx.beginPath();
    ctx.ellipse(cx + cdx, cy + cdy, r * 0.18, r * 0.06, ang, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // Terminator / night side shadow
  const shadowG = ctx.createRadialGradient(cx + r * 0.6, cy + r * 0.4, 0, cx + r * 0.4, cy + r * 0.3, r * 1.2);
  shadowG.addColorStop(0, 'rgba(0,0,0,0)');
  shadowG.addColorStop(0.7, 'rgba(0,0,0,0.2)');
  shadowG.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = shadowG;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}
function lerpRgb(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}
