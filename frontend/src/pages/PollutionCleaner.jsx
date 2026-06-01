import { useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';
import CityScene from '../three/CityScene';
import { useGesture } from '../hooks/useGesture';
import { useScore } from '../hooks/useScore';
import { useSound } from '../hooks/useSound';
import { MODULE_THEMES } from '../utils/colors';

const THEME = MODULE_THEMES.pollution;

const AQI = (cleanliness) => {
  if (cleanliness < 0.2) return { label: 'Hazardous', color: '#ff5757' };
  if (cleanliness < 0.4) return { label: 'Unhealthy', color: '#ff9a3c' };
  if (cleanliness < 0.6) return { label: 'Moderate',  color: '#ffe24d' };
  if (cleanliness < 0.85) return { label: 'Good',     color: '#9bff5a' };
  return                       { label: 'Pristine',   color: '#7af598' };
};

export default function PollutionCleaner() {
  const [cleanliness, setCleanliness] = useState(0);
  const [smokeKill, setSmokeKill] = useState(0);
  const [factoriesOn, setFactoriesOn] = useState(true);
  const [birdsActive, setBirdsActive] = useState(false);
  const [toast, setToast] = useState(null);
  const { bump } = useScore();
  const { play, preload } = useSound();
  const toastTimer = useRef(null);

  useEffect(() => {
    preload(['whoosh', 'wind', 'birds', 'pop']);
  }, [preload]);

  const flashToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1600);
  };

  useGesture((g) => {
    switch (g) {
      case 'one_finger':
        setSmokeKill((s) => Math.min(1, s + 0.28));
        bump({ health: 4, oxygen: 80 });
        play('whoosh');
        flashToast('☝ Smoke cleared');
        break;
      case 'two_fingers':
        setCleanliness((c) => Math.min(1, c + 0.22));
        bump({ health: 4, oxygen: 60 });
        play('whoosh');
        flashToast('✌ River cleansed');
        break;
      case 'three_fingers':
        setFactoriesOn((on) => !on);
        bump({ health: 6, oxygen: 50 });
        play('pop');
        flashToast('🤟 Factories toggled');
        break;
      case 'five_fingers':
        // Restoration timeline — sky → blue, birds arrive
        gsap.to({}, {
          duration: 2.4, onUpdate: function () {
            const t = this.progress();
            setCleanliness((c) => Math.max(c, t));
          },
        });
        setBirdsActive(true);
        bump({ health: 12, oxygen: 320 });
        play('birds');
        flashToast('🖐 Restoration begins');
        break;
      case 'both_hands':
        // Ultimate clean: lock to full, smoke gone, birds fly, all lights dim
        gsap.to({}, {
          duration: 1.5, onUpdate: function () {
            const t = this.progress();
            setCleanliness(Math.max(0.95, t));
            setSmokeKill(Math.max(0.95, t));
          },
        });
        setBirdsActive(true);
        setFactoriesOn(false);
        bump({ health: 20, oxygen: 600 });
        play('birds');
        flashToast('🙌 Earth restored!');
        break;
      default: break;
    }
  });

  const aqi = AQI(cleanliness);

  return (
    <section className={`relative min-h-screen bg-gradient-to-b ${THEME.gradient} overflow-hidden`}>
      {/* 3D scene */}
      <div className="absolute inset-0">
        <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.4, 6.2], fov: 55 }}>
          <CityScene
            cleanliness={cleanliness}
            smokeKill={smokeKill}
            factoriesOn={factoriesOn}
            birdsActive={birdsActive}
          />
        </Canvas>
      </div>

      {/* Soft vignette */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(10,42,31,0.30)_100%)]" />

      {/* HUD */}
      <div className="relative z-10 pt-28 px-6 max-w-6xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="font-display text-4xl md:text-5xl font-extrabold tracking-tight"
          style={{ color: THEME.color, textShadow: `0 2px 18px rgba(255,255,255,.7), 0 0 24px ${THEME.color}55` }}
        >
          Pollution Cleaner
        </motion.h2>
        <p className="mt-3 text-eco-ink font-medium max-w-xl" style={{ textShadow: '0 2px 10px rgba(255,255,255,.7)' }}>
          Clear the smoke, restore the river, halt the factories, bring back the birds.
        </p>

        <div className="mt-6 flex flex-wrap gap-4 items-stretch">
          {/* AQI gauge */}
          <div className="glass-strong rounded-2xl p-4 min-w-[240px]">
            <div className="text-[10px] uppercase tracking-widest text-eco-ink2">AQI</div>
            <div className="font-display text-3xl tabular-nums font-extrabold" style={{ color: aqi.color }}>
              {aqi.label}
            </div>
            <div className="mt-2 h-2 rounded-full bg-eco-ink/15 overflow-hidden">
              <motion.div
                className="h-full"
                style={{ background: aqi.color, boxShadow: `0 0 12px ${aqi.color}99` }}
                animate={{ width: `${Math.round(cleanliness * 100)}%` }}
                transition={{ type: 'spring', stiffness: 70, damping: 18 }}
              />
            </div>
          </div>

          {/* Gesture cheatsheet */}
          <div className="glass rounded-2xl p-4 text-xs leading-relaxed text-eco-ink">
            <div className="text-[10px] uppercase tracking-widest text-eco-ink2 mb-2">Gestures</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              <div><span className="font-bold text-mod-pollution">☝ 1 finger</span> · Clear smoke</div>
              <div><span className="font-bold text-mod-pollution">✌ 2 fingers</span> · Clean river</div>
              <div><span className="font-bold text-mod-pollution">🤟 3 fingers</span> · Toggle factories</div>
              <div><span className="font-bold text-mod-pollution">🖐 5 fingers</span> · Start restoration</div>
              <div className="col-span-2"><span className="font-bold text-mod-pollution">🙌 Both hands</span> · Full restoration</div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast}
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            className="fixed left-1/2 -translate-x-1/2 top-24 z-20 px-5 py-2.5 rounded-full glass-strong font-bold"
            style={{ color: THEME.color, boxShadow: `0 8px 28px ${THEME.color}44` }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
