import { useEffect, useRef } from 'react';

export default function CursorGlow({ color = 'rgba(122,245,152,0.55)' }) {
  const ref = useRef(null);

  useEffect(() => {
    document.body.classList.add('cinematic');
    const el = ref.current;
    const move = (e) => {
      if (!el) return;
      el.style.transform = `translate3d(${e.clientX - 80}px, ${e.clientY - 80}px, 0)`;
    };
    window.addEventListener('mousemove', move);
    return () => {
      window.removeEventListener('mousemove', move);
      document.body.classList.remove('cinematic');
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed z-[9999] h-40 w-40 rounded-full mix-blend-screen will-change-transform"
      style={{
        background: `radial-gradient(circle, ${color} 0%, transparent 60%)`,
        filter: 'blur(8px)',
        transform: 'translate3d(-200px,-200px,0)',
        transition: 'transform 50ms linear',
      }}
    />
  );
}
