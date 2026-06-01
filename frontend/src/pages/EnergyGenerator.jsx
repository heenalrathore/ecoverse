import { useEffect, useRef, useState } from 'react';
import ModuleFrame from '../components/ModuleFrame';
import { useCanvasScene } from '../hooks/useCanvasScene';
import { useGesture } from '../hooks/useGesture';
import { useScore } from '../hooks/useScore';
import { useSound } from '../hooks/useSound';
import { MODULE_THEMES } from '../utils/colors';

const THEME = MODULE_THEMES.energy;

export default function EnergyGenerator() {
  const stateRef = useRef({
    buildings: spawnBuildings(),
    turbines: [
      // foreground large turbines
      { x: 0.08, baseY: 0.82, height: 160, on: false, spin: 0, scale: 1 },
      { x: 0.92, baseY: 0.81, height: 150, on: false, spin: 0, scale: 1 },
      // mid-distance medium turbines
      { x: 0.20, baseY: 0.78, height: 110, on: false, spin: 0, scale: 0.75 },
      { x: 0.82, baseY: 0.77, height: 105, on: false, spin: 0, scale: 0.72 },
      // far small turbines
      { x: 0.32, baseY: 0.74, height: 70,  on: false, spin: 0, scale: 0.5 },
    ],
    solar: false,
    powerLevel: 0,        // 0..1
    arcs: [],
    pulse: 0,
  });
  const [toast, setToast] = useState(null);
  const [lit, setLit] = useState(0);
  const toastTimer = useRef(null);
  const { bump } = useScore();
  const { play, preload } = useSound();

  useEffect(() => { preload(['power', 'whoosh', 'chime', 'pop']); }, [preload]);
  const flashToast = (m) => {
    setToast(m); clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1500);
  };

  useGesture((g) => {
    const s = stateRef.current;
    switch (g) {
      case 'one_finger': {
        // light one building
        const i = s.buildings.findIndex((b) => !b.lit);
        if (i >= 0) {
          s.buildings[i].lit = true; s.buildings[i].litAt = performance.now();
          setLit((n) => n + 1);
          s.powerLevel = Math.min(1, s.powerLevel + 0.08);
          bump({ health: 2, oxygen: 20 });
          play('pop');
          flashToast('☝ Building energized');
        }
        break;
      }
      case 'two_fingers':
        // wind turbines on
        s.turbines.forEach((tu) => (tu.on = true));
        s.powerLevel = Math.min(1, s.powerLevel + 0.15);
        bump({ health: 4, oxygen: 50 });
        play('whoosh');
        flashToast('✌ Wind turbines online');
        break;
      case 'three_fingers':
        s.solar = true;
        s.powerLevel = Math.min(1, s.powerLevel + 0.18);
        bump({ health: 5, oxygen: 70 });
        play('chime');
        flashToast('🤟 Solar farm online');
        break;
      case 'five_fingers': {
        // light all
        s.buildings.forEach((b) => { if (!b.lit) { b.lit = true; b.litAt = performance.now(); } });
        s.turbines.forEach((tu) => (tu.on = true));
        s.solar = true;
        s.powerLevel = 1;
        setLit(s.buildings.length);
        bump({ health: 12, oxygen: 320 });
        play('power');
        flashToast('🖐 City fully powered');
        break;
      }
      case 'both_hands':
        s.powerLevel = 1;
        s.pulse = 1;
        for (let i = 0; i < 18; i++) s.arcs.push(spawnArc());
        bump({ health: 20, oxygen: 600 });
        play('power');
        flashToast('🙌 Energy core OVERLOAD');
        break;
      default: break;
    }
  });

  const canvasRef = useCanvasScene((ctx, W, H, t, dt) => {
    const s = stateRef.current;
    // Sky — gets brighter as power rises
    const p = s.powerLevel;
    const skyTop = `rgb(${10 + p * 14}, ${15 + p * 30}, ${30 + p * 50})`;
    const skyBot = `rgb(${30 + p * 60}, ${24 + p * 30}, ${50 + p * 10})`;
    const grd = ctx.createLinearGradient(0, 0, 0, H * 0.85);
    grd.addColorStop(0, skyTop); grd.addColorStop(1, skyBot);
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H * 0.85);

    // Solar farm strip on left (visible when solar on)
    if (s.solar) {
      for (let i = 0; i < 5; i++) {
        const x = 20 + i * 60;
        const y = H * 0.68;
        ctx.save();
        ctx.translate(x, y); ctx.rotate(-0.35);
        const g = ctx.createLinearGradient(0, -22, 0, 22);
        g.addColorStop(0, '#3c8bff'); g.addColorStop(1, '#1f4a8a');
        ctx.fillStyle = g; ctx.fillRect(-30, -22, 60, 44);
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
        for (let r = -22; r <= 22; r += 11) { ctx.beginPath(); ctx.moveTo(-30, r); ctx.lineTo(30, r); ctx.stroke(); }
        ctx.restore();
      }
    }

    // Ground band
    ctx.fillStyle = '#0c1a1a'; ctx.fillRect(0, H * 0.85, W, H * 0.15);

    // Buildings (detailed façades)
    for (const b of s.buildings) {
      const x = b.x * W;
      const bx = x - b.w / 2;
      const by = H * 0.85 - b.h;
      // Façade base with vertical gradient
      const facadeG = ctx.createLinearGradient(bx, by, bx + b.w, by + b.h);
      facadeG.addColorStop(0, b.lit ? '#1d2c3c' : '#0c1418');
      facadeG.addColorStop(1, b.lit ? '#15212d' : '#06090d');
      ctx.fillStyle = facadeG;
      ctx.fillRect(bx, by, b.w, b.h);
      // Side shadow strip
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(bx + b.w - 3, by, 3, b.h);
      // Horizontal floor-divider lines (subtle architecture detail)
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 0.5;
      for (let r = 0; r <= b.rows; r++) {
        const y = by + 6 + r * (b.h - 12) / b.rows;
        ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(bx + b.w, y); ctx.stroke();
      }
      // Window grid
      for (let r = 0; r < b.rows; r++) {
        for (let c = 0; c < b.cols; c++) {
          const wx = bx + 5 + c * (b.w - 10) / b.cols;
          const wy = by + 8 + r * (b.h - 16) / b.rows;
          const ww = (b.w - 10) / b.cols - 3;
          const wh = (b.h - 16) / b.rows - 3;
          const on = b.lit && (((r * 7 + c * 3 + b.seed) % 5) > 1);
          if (on) {
            // Warm window — interior gradient
            const wG = ctx.createLinearGradient(wx, wy, wx, wy + wh);
            wG.addColorStop(0, 'rgba(255, 234, 130, 0.95)');
            wG.addColorStop(1, 'rgba(255, 195, 80, 0.85)');
            ctx.fillStyle = wG;
            ctx.shadowColor = '#ffec6d';
            ctx.shadowBlur = 6;
            ctx.fillRect(wx, wy, ww, wh);
            ctx.shadowBlur = 0;
            // window cross-bar
            ctx.strokeStyle = 'rgba(0,0,0,0.4)';
            ctx.lineWidth = 0.4;
            ctx.beginPath(); ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.stroke();
          } else {
            ctx.fillStyle = b.lit ? 'rgba(60,80,100,0.35)' : 'rgba(35,50,65,0.55)';
            ctx.fillRect(wx, wy, ww, wh);
          }
        }
      }
      // Roof detail — pitched roof, antenna, or water tank
      if (b.roof === 'antenna') {
        ctx.strokeStyle = '#cfd6df'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x, by); ctx.lineTo(x, by - 20); ctx.stroke();
        ctx.fillStyle = b.lit ? '#ff6d6d' : '#3a1a1a';
        ctx.beginPath(); ctx.arc(x, by - 22, 2.4, 0, Math.PI * 2); ctx.fill();
      } else if (b.roof === 'tank') {
        ctx.fillStyle = '#3a4047';
        ctx.fillRect(x - 8, by - 12, 16, 12);
        ctx.fillStyle = '#52595f';
        ctx.beginPath(); ctx.ellipse(x, by - 12, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
      } else if (b.roof === 'pitch') {
        ctx.fillStyle = '#2a323d';
        ctx.beginPath();
        ctx.moveTo(bx - 2, by);
        ctx.lineTo(x, by - 14);
        ctx.lineTo(bx + b.w + 2, by);
        ctx.closePath(); ctx.fill();
      }
    }

    // Street level with sidewalk + parked cars
    ctx.fillStyle = '#2a2e34';
    ctx.fillRect(0, H * 0.85, W, H * 0.07);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.setLineDash([12, 18]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, H * 0.885); ctx.lineTo(W, H * 0.885); ctx.stroke();
    ctx.setLineDash([]);
    // Parked silhouette cars
    const carPositions = [W * 0.18, W * 0.36, W * 0.58, W * 0.72];
    for (const cx of carPositions) {
      const cy = H * 0.88;
      ctx.fillStyle = '#0e1216';
      ctx.beginPath();
      ctx.roundRect(cx - 18, cy - 8, 36, 8, 2);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(cx - 13, cy - 14, 26, 7, [4, 4, 1, 1]);
      ctx.fill();
      // headlight glow if power up
      if (p > 0.5) {
        ctx.fillStyle = `rgba(255,236,130,${0.6 * p})`;
        ctx.beginPath(); ctx.arc(cx + 18, cy - 4, 8, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Wind turbines — tapered mast + 3 blades, scaled for parallax depth
    for (const tu of s.turbines) {
      const x = tu.x * W; const y = H * tu.baseY;
      const sc = tu.scale ?? 1;
      // Tapered mast
      const baseW = 5 * sc, topW = 2.5 * sc;
      ctx.fillStyle = '#cfd6df';
      ctx.beginPath();
      ctx.moveTo(x - baseW, y);
      ctx.lineTo(x - topW, y - tu.height);
      ctx.lineTo(x + topW, y - tu.height);
      ctx.lineTo(x + baseW, y);
      ctx.closePath(); ctx.fill();
      // mast shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.moveTo(x + topW * 0.5, y - tu.height);
      ctx.lineTo(x + baseW, y);
      ctx.lineTo(x + baseW - 2, y);
      ctx.lineTo(x + topW * 0.5 - 0.5, y - tu.height);
      ctx.closePath(); ctx.fill();

      // Spin
      if (tu.on) tu.spin += dt * 4 * (1.5 - sc * 0.5);  // smaller turbines spin faster (perceived)
      ctx.save();
      ctx.translate(x, y - tu.height);
      ctx.rotate(tu.spin);
      // Hub
      ctx.fillStyle = '#9aa6b0';
      ctx.beginPath(); ctx.arc(0, 0, 5 * sc, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5a6168';
      ctx.beginPath(); ctx.arc(0, 0, 2 * sc, 0, Math.PI * 2); ctx.fill();
      // 3 tapered blades
      ctx.fillStyle = '#f0f4f9';
      for (let i = 0; i < 3; i++) {
        ctx.save(); ctx.rotate((i * Math.PI * 2) / 3);
        const len = 44 * sc;
        ctx.beginPath();
        ctx.moveTo(0, -2 * sc);
        ctx.quadraticCurveTo(-3 * sc, -len * 0.6, -1 * sc, -len);
        ctx.lineTo(1 * sc, -len);
        ctx.quadraticCurveTo(3 * sc, -len * 0.6, 0, -2 * sc);
        ctx.closePath();
        ctx.fill();
        // blade highlight
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 0.5 * sc;
        ctx.beginPath();
        ctx.moveTo(0, -4 * sc);
        ctx.quadraticCurveTo(-1.5 * sc, -len * 0.6, -0.5 * sc, -len);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    // Energy core (city skyline center)
    const cx = W / 2, cy = H * 0.42;
    const coreR = 30 + p * 24 + s.pulse * 50;
    const coreG = ctx.createRadialGradient(cx, cy, 4, cx, cy, coreR);
    coreG.addColorStop(0, `rgba(255, 236, 109, ${0.7 + p * 0.3})`);
    coreG.addColorStop(0.5, `rgba(255, 180, 80, ${0.4 * p})`);
    coreG.addColorStop(1, 'rgba(255, 180, 80, 0)');
    ctx.fillStyle = coreG;
    ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, Math.PI * 2); ctx.fill();
    if (s.pulse > 0) s.pulse = Math.max(0, s.pulse - dt * 0.6);

    // Electric arcs
    for (let i = s.arcs.length - 1; i >= 0; i--) {
      const a = s.arcs[i];
      a.life -= dt;
      if (a.life <= 0) { s.arcs.splice(i, 1); continue; }
      ctx.strokeStyle = `rgba(255, 240, 140, ${a.life * 2})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const ax = a.x0, ay = a.y0;
      ctx.moveTo(ax, ay);
      let nx = ax, ny = ay;
      for (let s2 = 0; s2 < 8; s2++) {
        nx += (a.x1 - ax) / 8 + (Math.random() - 0.5) * 16;
        ny += (a.y1 - ay) / 8 + (Math.random() - 0.5) * 16;
        ctx.lineTo(nx, ny);
      }
      ctx.stroke();
    }

    // Faint stars when power is low
    if (p < 0.7) {
      ctx.fillStyle = `rgba(255,255,255,${0.5 - p * 0.5})`;
      for (let i = 0; i < 70; i++) {
        const sx = (i * 97 + (t * 0.01) | 0) % W;
        const sy = (i * 53) % (H * 0.5);
        ctx.fillRect(sx, sy, 1.4, 1.4);
      }
    }
  });

  return (
    <ModuleFrame
      theme={THEME}
      title="Human Energy Generator"
      tagline="A dark city. Bring it back online — fully on clean power."
      stats={[
        { label: 'Buildings lit', value: lit },
        { label: 'Power level',   value: Math.round(stateRef.current.powerLevel * 100) + '%' },
      ]}
      gestures={[
        { label: '☝ 1 finger',    does: 'Light one building' },
        { label: '✌ 2 fingers',   does: 'Wind turbines on' },
        { label: '🤟 3 fingers',  does: 'Solar farm on' },
        { label: '🖐 5 fingers',  does: 'Power entire city' },
        { label: '🙌 Both hands', does: 'Energy core OVERLOAD', wide: true },
      ]}
      toast={toast}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
    </ModuleFrame>
  );
}

function spawnBuildings() {
  // Skyline of varied buildings — wide low-rises to narrow towers
  const out = [];
  const roofTypes = ['flat', 'flat', 'antenna', 'tank', 'pitch'];   // weighted to flat
  let xCursor = 0.16;
  while (xCursor < 0.87) {
    const isTower = Math.random() < 0.35;
    const w = isTower ? 32 + Math.random() * 30 : 55 + Math.random() * 80;
    const h = isTower ? 220 + Math.random() * 200 : 130 + Math.random() * 140;
    out.push({
      x: xCursor,
      w, h,
      rows: Math.max(4, Math.floor(h / 30)),
      cols: Math.max(2, Math.floor(w / 22)),
      seed: Math.floor(Math.random() * 100),
      roof: roofTypes[Math.floor(Math.random() * roofTypes.length)],
      lit: false,
    });
    xCursor += w / window.innerWidth + 0.005;
  }
  return out;
}
function spawnArc() {
  const W = window.innerWidth, H = window.innerHeight;
  return {
    x0: W / 2, y0: H * 0.42,
    x1: 100 + Math.random() * (W - 200),
    y1: 100 + Math.random() * (H - 300),
    life: 0.4 + Math.random() * 0.3,
  };
}
