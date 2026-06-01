import { useEffect, useRef, useState } from 'react';
import ModuleFrame from '../components/ModuleFrame';
import { useCanvasScene } from '../hooks/useCanvasScene';
import { useGesture } from '../hooks/useGesture';
import { useScore } from '../hooks/useScore';
import { useSound } from '../hooks/useSound';
import { MODULE_THEMES } from '../utils/colors';

const THEME = MODULE_THEMES.ocean;

/**
 * 2D ocean scene with depth, caustics, and detailed sprite art (drawn directly
 * with Canvas2D paths, no images). Goal: photo-realistic feel without shipping
 * binary assets.
 */
export default function OceanCleanup() {
  const stateRef = useRef({
    cleanliness: 0,                 // 0..1 — drives sky/water/sun color lerps
    plastics: spawnPlastics(20),
    bubbles: [],
    // Start with a small "shy" school of fish even before sea-life-returns —
    // visible only in shadow form when water is dirty, vibrant when clean.
    fish: Array.from({ length: 5 }, () => ({ ...spawnFish(), x: Math.random() * 1500, shy: true })),
    coral: [],
    seaLife: false,
    causticsT: 0,
  });
  const [toast, setToast] = useState(null);
  const [plasticsLeft, setPlasticsLeft] = useState(20);
  const [cleanPct, setCleanPct] = useState(0);
  const toastTimer = useRef(null);
  const { bump } = useScore();
  const { play, preload } = useSound();

  useEffect(() => { preload(['whoosh', 'pop', 'chime', 'wind']); }, [preload]);

  // Periodically reflect canvas-state into React state for the HUD
  useEffect(() => {
    const id = setInterval(() => {
      setCleanPct(Math.round(stateRef.current.cleanliness * 100));
    }, 160);
    return () => clearInterval(id);
  }, []);

  const flashToast = (m) => {
    setToast(m); clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1500);
  };

  useGesture((g) => {
    const s = stateRef.current;
    switch (g) {
      case 'one_finger': {
        const idx = s.plastics.findIndex((p) => !p.removed);
        if (idx >= 0) {
          s.plastics[idx].removed = true;
          s.plastics[idx].fly = { t: 0 };
          for (let i = 0; i < 12; i++) s.bubbles.push(spawnBubble(s.plastics[idx].x, s.plastics[idx].y));
          setPlasticsLeft((n) => Math.max(0, n - 1));
          bump({ health: 2, oxygen: 25 });
          play('pop');
          flashToast('☝ Plastic collected');
        }
        break;
      }
      case 'two_fingers': {
        let removed = 0;
        for (const p of s.plastics) {
          if (!p.removed && removed < 3) {
            p.removed = true; p.fly = { t: 0 }; removed++;
            for (let i = 0; i < 8; i++) s.bubbles.push(spawnBubble(p.x, p.y));
          }
        }
        setPlasticsLeft((n) => Math.max(0, n - removed));
        bump({ health: 4, oxygen: 60 });
        play('whoosh');
        flashToast('✌ Sweep — 3 cleared');
        break;
      }
      case 'three_fingers':
        for (let i = 0; i < 6; i++) {
          s.coral.push(spawnCoral());
        }
        bump({ health: 5, oxygen: 80 });
        play('chime');
        flashToast('🤟 Coral reef grows');
        break;
      case 'five_fingers':
        s.cleanliness = Math.min(1, s.cleanliness + 0.45);
        bump({ health: 10, oxygen: 200 });
        play('chime');
        flashToast('🖐 Water purified');
        break;
      case 'both_hands':
        s.seaLife = true;
        s.cleanliness = 1;
        for (let i = 0; i < 14; i++) {
          s.fish.push(spawnFish());
        }
        bump({ health: 20, oxygen: 600 });
        play('chord');
        flashToast('🙌 Life returns');
        break;
      default: break;
    }
  });

  const canvasRef = useCanvasScene((ctx, W, H, t, dt) => {
    const s = stateRef.current;
    s.causticsT += dt;
    const c = s.cleanliness;
    const horizon = H * 0.52;

    /* ---- SKY ---- */
    const skyTop = lerpColor([85, 100, 80], [120, 180, 230], c);
    const skyMid = lerpColor([135, 130, 105], [180, 215, 240], c);
    const skyHor = lerpColor([165, 150, 120], [230, 235, 240], c);
    const skyG = ctx.createLinearGradient(0, 0, 0, horizon);
    skyG.addColorStop(0,    `rgb(${skyTop.join(',')})`);
    skyG.addColorStop(0.55, `rgb(${skyMid.join(',')})`);
    skyG.addColorStop(1,    `rgb(${skyHor.join(',')})`);
    ctx.fillStyle = skyG;
    ctx.fillRect(0, 0, W, horizon);

    /* ---- SUN with rays + lens flare ---- */
    const sunX = W * 0.78, sunY = H * 0.18, sunR = 44;
    // outer halo
    const haloG = ctx.createRadialGradient(sunX, sunY, sunR * 0.4, sunX, sunY, sunR * 4);
    haloG.addColorStop(0, `rgba(255,240,180,${0.55 * (0.55 + c * 0.45)})`);
    haloG.addColorStop(0.45, `rgba(255,220,140,${0.18 * (0.55 + c * 0.45)})`);
    haloG.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = haloG;
    ctx.fillRect(sunX - sunR * 5, sunY - sunR * 5, sunR * 10, sunR * 10);
    // disc
    const discG = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR);
    discG.addColorStop(0, '#ffffff');
    discG.addColorStop(0.55, '#fff1a8');
    discG.addColorStop(1, '#ffd86b');
    ctx.fillStyle = discG;
    ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2); ctx.fill();
    // light rays (only when clean enough so dirty water looks gloomy)
    if (c > 0.3) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,236,170,${0.10 * c})`;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2 + t * 0.0001;
        const rx = sunX + Math.cos(ang) * sunR * 0.9;
        const ry = sunY + Math.sin(ang) * sunR * 0.9;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(sunX + Math.cos(ang) * sunR * 5, sunY + Math.sin(ang) * sunR * 5);
        ctx.stroke();
      }
      ctx.restore();
    }

    /* ---- WATER ---- */
    // Surface band — bright reflection of sky
    const wTop = lerpColor([95, 100, 80], [140, 200, 220], c);
    const wMid = lerpColor([55, 70, 60],  [40, 130, 175], c);
    const wBot = lerpColor([20, 32, 26],  [8, 60, 100], c);
    const waterG = ctx.createLinearGradient(0, horizon, 0, H);
    waterG.addColorStop(0,    `rgb(${wTop.join(',')})`);
    waterG.addColorStop(0.35, `rgb(${wMid.join(',')})`);
    waterG.addColorStop(1,    `rgb(${wBot.join(',')})`);
    ctx.fillStyle = waterG;
    ctx.fillRect(0, horizon, W, H - horizon);

    // Caustics — soft moving bright patches near the surface
    if (c > 0.15) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 18; i++) {
        const ox = ((i * 89 + s.causticsT * 24) % (W + 200)) - 100;
        const oy = horizon + 8 + ((i * 31) % 60) + Math.sin(s.causticsT * 1.4 + i) * 4;
        const w = 70 + Math.sin(i + s.causticsT) * 20;
        const grd = ctx.createRadialGradient(ox, oy, 0, ox, oy, w);
        grd.addColorStop(0, `rgba(190,235,255,${0.18 * c})`);
        grd.addColorStop(1, 'rgba(190,235,255,0)');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.ellipse(ox, oy, w, w * 0.35, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    // Wave lines — 5 stacked at different depths
    for (let layer = 0; layer < 5; layer++) {
      const alpha = 0.10 + layer * 0.08 + c * 0.15;
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = layer === 0 ? 2 : 1.2;
      const yBase = horizon + 4 + layer * 7;
      const amp = (5 - layer) * 1.4;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 8) {
        const y = yBase + Math.sin((x + t * (0.05 + layer * 0.018)) / 60 + layer) * amp;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Sun reflection on water — column of brighter color directly below the sun
    if (c > 0.1) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const refl = ctx.createLinearGradient(0, horizon, 0, H * 0.78);
      refl.addColorStop(0, `rgba(255,240,180,${0.30 * c})`);
      refl.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = refl;
      const colW = 50 + c * 30;
      ctx.beginPath();
      ctx.moveTo(sunX - colW * 0.5, horizon);
      ctx.lineTo(sunX + colW * 0.5, horizon);
      ctx.lineTo(sunX + colW * 2.5, H * 0.78);
      ctx.lineTo(sunX - colW * 2.5, H * 0.78);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    /* ---- CORAL (foreground) ---- */
    for (const cr of s.coral) {
      cr.t = Math.min(1, cr.t + dt * 0.6);
      drawCoral(ctx, cr, H);
    }

    /* ---- PLASTICS ---- */
    for (const p of s.plastics) {
      if (p.removed) {
        p.fly.t = Math.min(1, p.fly.t + dt * 1.6);
        const ty = p.y - 220 * p.fly.t;
        ctx.save();
        ctx.globalAlpha = 1 - p.fly.t;
        drawPlastic(ctx, p.x, ty, p.kind, p.rot);
        ctx.restore();
        continue;
      }
      p.y += Math.sin((t + p.bobOffset) / 600) * 0.06;
      p.rot += dt * p.rotSpeed;
      drawPlastic(ctx, p.x, p.y, p.kind, p.rot);
    }

    /* ---- FISH ---- */
    // shy fish (always present, dimmed when water dirty)
    // vibrant fish (added by "both hands" gesture)
    for (let i = s.fish.length - 1; i >= 0; i--) {
      const f = s.fish[i];
      f.x += f.speed * dt;
      f.wiggleT += dt * 8;
      const wy = f.y + Math.sin(f.wiggleT) * 4;
      if (f.x > W + 80) {
        if (f.shy) { f.x = -80; f.y = H * (0.62 + Math.random() * 0.32); }
        else { s.fish.splice(i, 1); continue; }
      }
      ctx.save();
      // shy fish only visible once water clears a bit
      ctx.globalAlpha = f.shy ? Math.min(0.95, c * 1.3) : 1;
      drawFish(ctx, f.x, wy, f.scale, f.color, f.wiggleT);
      ctx.restore();
    }

    /* ---- BUBBLES ---- */
    for (let i = s.bubbles.length - 1; i >= 0; i--) {
      const b = s.bubbles[i];
      // grow as they rise (depth illusion)
      b.y -= b.vy * dt * 60;
      b.r += dt * 1.5;
      b.life -= dt;
      if (b.life <= 0 || b.y < horizon - 10) { s.bubbles.splice(i, 1); continue; }
      // body
      ctx.beginPath();
      ctx.fillStyle = `rgba(180,235,255,${0.15 + b.life * 0.25})`;
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      // highlight
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${0.4 + b.life * 0.3})`;
      ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  return (
    <ModuleFrame
      theme={THEME}
      title="Ocean Cleanup"
      tagline="Pull plastic from the depths. Grow coral. Bring back the fish."
      stats={[
        { label: 'Plastics left', value: plasticsLeft },
        { label: 'Clarity',       value: cleanPct + '%', color: '#0a78b8' },
      ]}
      gestures={[
        { label: '☝ 1 finger',    does: 'Collect one plastic' },
        { label: '✌ 2 fingers',   does: 'Sweep — clear 3' },
        { label: '🤟 3 fingers',  does: 'Grow coral reef' },
        { label: '🖐 5 fingers',  does: 'Purify the water' },
        { label: '🙌 Both hands', does: 'Sea life returns', wide: true },
      ]}
      toast={toast}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
    </ModuleFrame>
  );
}

/* ================================================================
   Drawing helpers + spawners
================================================================= */
function spawnPlastics(n) {
  const W = typeof window !== 'undefined' ? window.innerWidth  : 1200;
  const H = typeof window !== 'undefined' ? window.innerHeight : 800;
  return Array.from({ length: n }, () => ({
    x: 80 + Math.random() * (W - 160),
    y: H * (0.62 + Math.random() * 0.32),
    kind: ['bottle', 'bag', 'can'][Math.floor(Math.random() * 3)],
    bobOffset: Math.random() * 1000,
    rot: (Math.random() - 0.5) * 0.4,
    rotSpeed: (Math.random() - 0.5) * 0.4,
    removed: false,
  }));
}
function spawnBubble(x, y) {
  return {
    x: x + (Math.random() - 0.5) * 30, y,
    vy: 0.4 + Math.random() * 1.0,
    r: 1 + Math.random() * 2,
    life: 1.2 + Math.random() * 0.6,
  };
}
function spawnCoral() {
  return {
    x: 50 + Math.random() * (window.innerWidth - 100),
    branches: 3 + Math.floor(Math.random() * 3),
    hue: 280 + Math.random() * 90,
    sat: 60 + Math.random() * 25,
    light: 55 + Math.random() * 15,
    t: 0,
    height: 70 + Math.random() * 70,
  };
}
function spawnFish() {
  const H = window.innerHeight;
  const palette = ['#ffd86b', '#ff8a5c', '#5cd99a', '#c1ff7e', '#9ff0ff', '#ff6db5'];
  return {
    x: -80, y: H * (0.62 + Math.random() * 0.32),
    speed: 60 + Math.random() * 110,
    scale: 0.75 + Math.random() * 1.4,
    color: palette[Math.floor(Math.random() * palette.length)],
    wiggleT: Math.random() * Math.PI * 2,
  };
}

function drawPlastic(ctx, x, y, kind, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(2.4, 2.4);              // upscale all plastic art so it reads as real objects, not emoji
  if (kind === 'bottle') drawBottle(ctx);
  else if (kind === 'bag') drawBag(ctx);
  else drawCan(ctx);
  ctx.restore();
}
function drawBottle(ctx) {
  // drop-shadow on water
  ctx.save();
  ctx.shadowColor = 'rgba(0,30,60,0.4)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  // body (curved shoulders)
  const bodyG = ctx.createLinearGradient(-9, 0, 9, 0);
  bodyG.addColorStop(0, 'rgba(190, 215, 230, 0.95)');
  bodyG.addColorStop(0.5, 'rgba(230, 245, 252, 0.9)');
  bodyG.addColorStop(1, 'rgba(170, 195, 215, 0.95)');
  ctx.fillStyle = bodyG;
  ctx.strokeStyle = '#3e5460';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-8, -8);              // bottom-left
  ctx.lineTo(-8, 18);
  ctx.quadraticCurveTo(-8, 22, -4, 22);
  ctx.lineTo(4, 22);
  ctx.quadraticCurveTo(8, 22, 8, 18);
  ctx.lineTo(8, -8);
  ctx.quadraticCurveTo(8, -11, 4, -11);   // shoulder right
  ctx.lineTo(-4, -11);
  ctx.quadraticCurveTo(-8, -11, -8, -8);  // shoulder left
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
  // water inside (semi-transparent blue tint)
  ctx.fillStyle = 'rgba(70, 150, 195, 0.55)';
  ctx.beginPath();
  ctx.moveTo(-7, 4);
  ctx.lineTo(-7, 17);
  ctx.quadraticCurveTo(-7, 21, -4, 21);
  ctx.lineTo(4, 21);
  ctx.quadraticCurveTo(7, 21, 7, 17);
  ctx.lineTo(7, 4);
  ctx.closePath();
  ctx.fill();
  // label band
  ctx.fillStyle = '#3aaef8';
  ctx.fillRect(-8, -3, 16, 9);
  // label brand strip
  ctx.fillStyle = '#fff';
  ctx.fillRect(-7, -1, 14, 1.2);
  ctx.fillRect(-7, 2, 14, 0.8);
  ctx.fillRect(-7, 4, 8, 0.6);
  // neck
  ctx.fillStyle = 'rgba(210, 230, 240, 0.95)';
  ctx.strokeStyle = '#3e5460';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.rect(-3.5, -17, 7, 6);
  ctx.fill(); ctx.stroke();
  // cap (with ridges)
  ctx.fillStyle = '#1e2630';
  ctx.fillRect(-4.5, -21, 9, 4);
  ctx.strokeStyle = '#4a5560';
  ctx.lineWidth = 0.3;
  for (let i = -4; i <= 4; i += 1.5) {
    ctx.beginPath(); ctx.moveTo(i, -21); ctx.lineTo(i, -17); ctx.stroke();
  }
  // glass highlight stripe
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-5.5, -7); ctx.lineTo(-5.5, 16);
  ctx.stroke();
}
function drawBag(ctx) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,30,60,0.3)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 2;
  // crumpled fabric — irregular outline using bezier
  const grd = ctx.createLinearGradient(-14, -14, 14, 14);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.5, 'rgba(225, 235, 240, 0.85)');
  grd.addColorStop(1, 'rgba(200, 215, 222, 0.85)');
  ctx.fillStyle = grd;
  ctx.strokeStyle = '#4e5d68';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-14, -10);
  ctx.bezierCurveTo(-18, -3, -14, 6, -11, 14);
  ctx.bezierCurveTo(-8, 18, 0, 19, 3, 17);
  ctx.bezierCurveTo(7, 17, 12, 13, 14, 6);
  ctx.bezierCurveTo(16, -2, 14, -10, 8, -14);
  ctx.bezierCurveTo(2, -16, -6, -16, -14, -10);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
  // handle holes (where bag was carried)
  ctx.strokeStyle = 'rgba(120,140,150,0.65)';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(-6, -11, 4, Math.PI, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(6, -11, 4, Math.PI, Math.PI * 2); ctx.stroke();
  // fabric folds (many subtle lines)
  ctx.strokeStyle = 'rgba(95,115,128,0.45)';
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(-9, -2); ctx.bezierCurveTo(-8, 5, -7, 10, -6, 14); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-3, -4); ctx.bezierCurveTo(-2, 4, -1, 10, 0, 16); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4, -3); ctx.bezierCurveTo(5, 4, 6, 10, 7, 14); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(9, -1); ctx.bezierCurveTo(10, 4, 11, 8, 11, 12); ctx.stroke();
  // brand-strip label (faintly visible)
  ctx.fillStyle = 'rgba(60, 90, 120, 0.5)';
  ctx.font = 'bold 4px sans-serif';
  ctx.fillText('THANK YOU', -8, 3);
}
function drawCan(ctx) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,30,60,0.4)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  // body — gradient gives a cylindrical look
  const g = ctx.createLinearGradient(-9, 0, 9, 0);
  g.addColorStop(0, '#7a2510');
  g.addColorStop(0.25, '#e84a3a');
  g.addColorStop(0.5, '#ff7a55');
  g.addColorStop(0.75, '#e84a3a');
  g.addColorStop(1, '#7a2510');
  ctx.fillStyle = g;
  ctx.fillRect(-9, -12, 18, 26);
  ctx.restore();
  // top rim (silver)
  const topG = ctx.createLinearGradient(-9, -15, -9, -12);
  topG.addColorStop(0, '#e0e0e0');
  topG.addColorStop(1, '#888');
  ctx.fillStyle = topG;
  ctx.fillRect(-9, -15, 18, 3);
  // top rim shadow
  ctx.fillStyle = '#5a5a5a';
  ctx.fillRect(-9, -12, 18, 0.6);
  // bottom rim
  ctx.fillStyle = '#5a5a5a';
  ctx.fillRect(-9, 13, 18, 1);
  // brand band (white horizontal stripe)
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(-9, -3, 18, 6);
  // brand text
  ctx.fillStyle = '#7a2510';
  ctx.font = 'bold 5px sans-serif';
  ctx.fillText('COLA', -7, 2);
  // tab on top
  ctx.fillStyle = '#bababa';
  ctx.beginPath();
  ctx.ellipse(0, -14, 2.5, 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#525252';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.ellipse(0, -14, 2.5, 0.8, 0, 0, Math.PI * 2);
  ctx.stroke();
  // vertical shine stripe
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillRect(-6.5, -12, 1.2, 26);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(6.5, -12, 1.2, 26);
}

function drawFish(ctx, x, y, sc, color, wiggleT) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sc, sc);
  // body
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(0, 0, 18, 9, 0, 0, Math.PI * 2); ctx.fill();
  // body shadow (depth)
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.ellipse(0, 3, 17, 5, 0, 0, Math.PI * 2); ctx.fill();
  // tail (animated)
  const tailFlap = Math.sin(wiggleT * 2) * 0.4;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-16, 0);
  ctx.lineTo(-26, -6 + tailFlap * 3);
  ctx.lineTo(-24, 0);
  ctx.lineTo(-26, 6 - tailFlap * 3);
  ctx.closePath(); ctx.fill();
  // dorsal fin
  ctx.beginPath();
  ctx.moveTo(-4, -8);
  ctx.lineTo(2, -14);
  ctx.lineTo(8, -8);
  ctx.closePath(); ctx.fill();
  // belly fin
  ctx.beginPath();
  ctx.moveTo(-2, 7);
  ctx.lineTo(2, 12);
  ctx.lineTo(6, 7);
  ctx.closePath(); ctx.fill();
  // gill mark
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(4, 0, 6, -Math.PI / 3, Math.PI / 3);
  ctx.stroke();
  // eye
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(10, -1, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(10.5, -1, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(11, -1.5, 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawCoral(ctx, cr, H) {
  const baseY = H - 8;
  const h = cr.height * cr.t;
  const main = `hsl(${cr.hue} ${cr.sat}% ${cr.light}%)`;
  const dark = `hsl(${cr.hue} ${cr.sat}% ${cr.light - 18}%)`;
  ctx.save();
  ctx.translate(cr.x, baseY);
  // shadow on ground
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 2, 18, 4, 0, 0, Math.PI * 2); ctx.fill();
  // main stem
  ctx.lineCap = 'round';
  ctx.strokeStyle = dark;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-3, -h * 0.5, 0, -h);
  ctx.stroke();
  // primary branches
  for (let i = 0; i < cr.branches; i++) {
    const startY = -h * (0.3 + i / cr.branches * 0.6);
    const dir = i % 2 === 0 ? 1 : -1;
    const bLen = h * 0.35;
    ctx.strokeStyle = main;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(0, startY);
    ctx.quadraticCurveTo(dir * bLen * 0.3, startY - bLen * 0.6, dir * bLen, startY - bLen);
    ctx.stroke();
    // secondary tip blob
    ctx.fillStyle = main;
    ctx.beginPath(); ctx.arc(dir * bLen, startY - bLen, 4, 0, Math.PI * 2); ctx.fill();
  }
  // top blob
  ctx.fillStyle = main;
  ctx.beginPath(); ctx.arc(0, -h, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function lerpColor(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}
