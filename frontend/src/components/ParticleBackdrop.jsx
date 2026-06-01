import { useEffect, useRef } from 'react';
import { rand } from '../utils/math';

/**
 * Lightweight 2D particle layer using a single full-screen canvas.
 * Adapts particle count to viewport so projector + laptop both look good.
 */
export default function ParticleBackdrop({ color = '#7af598', density = 1, speed = 1 }) {
  const ref = useRef(null);

  useEffect(() => {
    const c = ref.current;
    const ctx = c.getContext('2d');
    let raf = 0;
    let particles = [];
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      c.width  = window.innerWidth  * dpr;
      c.height = window.innerHeight * dpr;
      c.style.width  = window.innerWidth  + 'px';
      c.style.height = window.innerHeight + 'px';
      const targetCount = Math.round((window.innerWidth * window.innerHeight) / 24000 * density);
      particles = Array.from({ length: targetCount }).map(() => spawn());
    };

    const spawn = (fromBottom = false) => ({
      x: rand(0, c.width),
      y: fromBottom ? c.height + rand(0, 40) : rand(0, c.height),
      r: rand(0.6, 2.2) * dpr,
      vx: rand(-0.15, 0.15) * speed,
      vy: rand(-0.4, -0.05) * speed,
      a: rand(0.25, 0.75),
    });

    const tick = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.fillStyle = color;
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.y < -20) { Object.assign(p, spawn(true)); continue; }
        if (p.x < 0) p.x = c.width; if (p.x > c.width) p.x = 0;
        ctx.globalAlpha = p.a;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener('resize', resize);
    tick();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [color, density, speed]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 mix-blend-screen opacity-70"
    />
  );
}
