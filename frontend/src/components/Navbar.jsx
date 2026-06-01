import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useGesture } from '../hooks/useGesture';
import EcoMeter from './EcoMeter';

export default function Navbar() {
  const navigate = useNavigate();
  const loc = useLocation();
  const [exitFlash, setExitFlash] = useState(false);
  const exitTimer = useRef(null);

  // Fist gesture (0 fingers) on any module page → exit to home.
  // The classifier's 4-frame steady window plus 850ms cooldown prevent
  // accidental triggers as the hand transitions through 0 fingers.
  useGesture((g) => {
    if (g !== 'fist') return;
    if (loc.pathname === '/') return;
    // Show a brief banner so the user understands what happened
    setExitFlash(true);
    clearTimeout(exitTimer.current);
    exitTimer.current = setTimeout(() => setExitFlash(false), 1200);
    navigate('/');
  });

  useEffect(() => () => clearTimeout(exitTimer.current), []);

  return (
    <>
      <motion.header
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0,   opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
        className="fixed top-0 inset-x-0 z-30 flex items-center justify-between px-6 py-4 pointer-events-none"
      >
        <Link
          to="/"
          className="pointer-events-auto group flex items-center gap-3"
        >
          <span className="relative grid place-items-center w-10 h-10 rounded-full bg-gradient-to-br from-eco-green to-eco-cyan border border-white/60 shadow-glow">
            <span className="text-lg">🌿</span>
          </span>
          <div className="leading-tight">
            <div className="font-display text-base font-bold tracking-tight gradient-text">
              EcoVerse
            </div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-eco-ink2">
              by <span className="text-eco-forest font-bold">Digital Hammerr</span>
            </div>
          </div>
        </Link>

        <div className="pointer-events-auto hidden md:block">
          <EcoMeter />
        </div>
      </motion.header>

      <AnimatePresence>
        {exitFlash && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-40 px-5 py-2.5 rounded-full glass-strong text-eco-ink font-bold"
            style={{ boxShadow: '0 8px 28px rgba(63,194,144,0.35)' }}
          >
            ✊ Fist detected — returning home
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
