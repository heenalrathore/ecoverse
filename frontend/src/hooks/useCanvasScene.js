import { useEffect, useRef } from 'react';

/**
 * Mounts a full-screen Canvas-2D scene and runs the supplied `draw(ctx, w, h, t, dt)`
 * loop at requestAnimationFrame. Handles HiDPI + window resize.
 *
 * `state` is a mutable object the caller updates from gesture handlers; the
 * `draw` callback reads it each frame. Closing over React state via dependency
 * array doesn't work well for high-fps loops, so we use a ref pattern.
 */
export function useCanvasScene(draw) {
  const ref = useRef(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    let raf = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let last = performance.now();

    const resize = () => {
      c.width  = window.innerWidth  * dpr;
      c.height = window.innerHeight * dpr;
      c.style.width  = window.innerWidth  + 'px';
      c.style.height = window.innerHeight + 'px';
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const W = window.innerWidth;
      const H = window.innerHeight;
      ctx.clearRect(0, 0, W, H);
      drawRef.current?.(ctx, W, H, now, dt);
      raf = requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener('resize', resize);
    tick();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return ref;
}
