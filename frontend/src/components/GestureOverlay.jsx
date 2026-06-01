import { useEffect, useRef, useState } from 'react';
import { useGestureContext } from '../gesture/GestureContext';
import { AnimatePresence, motion } from 'framer-motion';

const CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],
  [0,17],
];

export default function GestureOverlay({ accent = '#7af598' }) {
  const { video, frame, status, error } = useGestureContext();
  const previewVideoRef = useRef(null);
  const canvasRef = useRef(null);
  const [debug, setDebug] = useState(false);

  // Toggle debug HUD with `d` key
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'd' || e.key === 'D') {
        const next = !debug;
        setDebug(next);
        window.__ECOVERSE_DEBUG__ = next;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [debug]);

  // Attach the (hidden) tracker video as the visible preview's source.
  useEffect(() => {
    const v = previewVideoRef.current;
    if (!v || !video) return;
    const sync = () => {
      if (video.srcObject && v.srcObject !== video.srcObject) {
        v.srcObject = video.srcObject;
        v.play?.().catch(() => {});
      }
    };
    sync();
    video.addEventListener('loadedmetadata', sync);
    // poll briefly in case MediaPipe attaches srcObject after our listener
    const id = setInterval(sync, 300);
    setTimeout(() => clearInterval(id), 4000);
    return () => { video.removeEventListener('loadedmetadata', sync); clearInterval(id); };
  }, [video]);

  // Draw skeleton each frame
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h);
    const all = frame.allLandmarks;
    if (!all || !all.length) return;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = accent;
    for (const lm of all) {
      ctx.beginPath();
      for (const [a, b] of CONNECTIONS) {
        const pa = lm[a], pb = lm[b];
        ctx.moveTo(pa.x * w, pa.y * h);
        ctx.lineTo(pb.x * w, pb.y * h);
      }
      ctx.stroke();
      for (const p of lm) {
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [frame, accent]);

  const statusLabel = {
    booting: 'Loading',
    running: 'Live',
    denied:  'No camera',
    error:   'Error',
  }[status] || status;

  return (
    <>
      {/* Bottom-left preview */}
      <div className="fixed bottom-4 left-4 z-40 select-none">
        <div className="relative w-[240px] aspect-[4/3] rounded-2xl overflow-hidden glass-dark">
          <video
            ref={previewVideoRef}
            autoPlay playsInline muted
            className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
          />
          <canvas
            ref={canvasRef}
            width={320} height={240}
            className="absolute inset-0 w-full h-full scale-x-[-1]"
          />
          <div className="absolute top-2 left-2 right-2 flex items-center justify-between text-[11px] uppercase tracking-wider">
            <span className={`px-2 py-0.5 rounded-full border border-white/15 ${
              status === 'running' ? 'bg-emerald-500/30 text-emerald-100' :
              status === 'denied'  ? 'bg-rose-500/30 text-rose-100' :
              status === 'error'   ? 'bg-rose-500/30 text-rose-100' :
                                     'bg-black/45 text-white/80'
            }`}>
              {statusLabel}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-black/45 border border-white/15 tabular-nums">
              {frame.hands} hand{frame.hands === 1 ? '' : 's'}
            </span>
          </div>

          {/* Big finger count overlay — instant visual feedback */}
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span
              className="font-display font-extrabold text-[64px] leading-none transition-opacity"
              style={{
                color: '#ffffff',
                opacity: frame.hands > 0 ? 0.85 : 0,
                textShadow: `0 0 24px ${accent}cc, 0 4px 0 rgba(0,0,0,0.35)`,
              }}
            >
              {frame.fingers}
            </span>
          </div>

          <AnimatePresence>
            {frame.gesture && (
              <motion.div
                key={frame.gesture + frame.ts}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="absolute bottom-2 left-2 right-2 text-center text-xs font-semibold rounded-full px-3 py-1.5"
                style={{
                  background: 'rgba(0,0,0,0.6)',
                  color: accent,
                  border: `1px solid ${accent}66`,
                }}
              >
                {prettyGesture(frame.gesture)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-2 text-[11px] text-eco-ink2 max-w-[240px] leading-snug font-medium">
          Show your hand to the camera. Press <b className="text-eco-ink">D</b> for debug.
        </div>

        {status === 'denied' && (
          <div className="mt-2 max-w-[240px] text-[11px] text-rose-300 leading-snug">
            Camera permission denied. Click the camera icon in the browser address bar and allow access.
          </div>
        )}
        {status === 'error' && (
          <div className="mt-2 max-w-[240px] text-[11px] text-rose-300 leading-snug">
            Gesture system error: {error}
          </div>
        )}
      </div>

      {/* Center-top last-gesture banner — appears briefly on any detected gesture */}
      <AnimatePresence>
        {frame.gesture && (
          <motion.div
            key={`big-${frame.gesture}-${frame.ts}`}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.32 }}
            className="pointer-events-none fixed top-20 left-1/2 -translate-x-1/2 z-30 px-6 py-2.5 rounded-full glass-strong"
          >
            <span className="font-display text-lg font-bold tracking-wide" style={{ color: accent, textShadow: `0 0 16px ${accent}99` }}>
              {prettyGesture(frame.gesture)}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Debug HUD — toggled with D */}
      {debug && (
        <div className="fixed bottom-4 right-4 z-50 glass-strong rounded-xl p-3 text-[11px] font-mono leading-tight text-emerald-200 max-w-[260px]">
          <div className="text-eco-neon font-bold mb-1">EcoVerse Debug</div>
          <div>status: <span className="text-white">{status}</span></div>
          <div>hands: <span className="text-white">{frame.hands}</span> · fingers: <span className="text-white">{frame.fingers}</span></div>
          <div>label: <span className="text-white">{frame.label || '—'}</span></div>
          <div>gesture: <span className="text-white">{frame.gesture || '—'}</span></div>
          <div>ts: <span className="text-white">{Math.round(frame.ts || 0)}</span></div>
          <div className="mt-1 opacity-70">window.Hands: {String(typeof window !== 'undefined' && !!window.Hands)}</div>
          <div className="opacity-70">window.Camera: {String(typeof window !== 'undefined' && !!window.Camera)}</div>
        </div>
      )}
    </>
  );
}

function prettyGesture(g) {
  switch (g) {
    case 'fist':          return '✊ Fist · Exit';
    case 'one_finger':    return '☝ One Finger';
    case 'two_fingers':   return '✌ Two Fingers';
    case 'three_fingers': return '🤟 Three Fingers';
    case 'five_fingers':  return '🖐 Open Palm';
    case 'both_hands':    return '🙌 Both Hands';
    default: return g;
  }
}
