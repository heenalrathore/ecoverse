import { useEffect, useRef, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { FaSmog, FaTree, FaWater, FaBolt } from 'react-icons/fa';
import EarthOrb from '../three/EarthOrb';
import RealisticEarth from '../three/RealisticEarth';
import ParticleField from '../three/ParticleField';
import ModuleCard from '../components/ModuleCard';
import { MODULE_THEMES } from '../utils/colors';
import { useGesture } from '../hooks/useGesture';

// Laid out as a 2×2 grid (see the grid classes below): the array order is row-major,
// so column 2 is [forest, ocean] → Ocean Cleanup sits directly under Plant vs. Carbon Monster.
const MODULES = [
  { key: 'pollution', to: '/pollution-cleaner', tagline: 'Wipe smog, restore the city skyline.', Icon: FaSmog,            color: MODULE_THEMES.pollution.color },
  { key: 'forest',    to: '/plant-future',      tagline: 'Battle the carbon monster, then grow a forest.', Icon: FaTree,  color: MODULE_THEMES.forest.color    },
  { key: 'energy',    to: '/energy-generator',  tagline: 'Power the city with wind, sun and water.', Icon: FaBolt,        color: MODULE_THEMES.energy.color    },
  { key: 'ocean',     to: '/ocean-cleanup',     tagline: 'Pull plastic from the deep, let the reef glow.', Icon: FaWater, color: MODULE_THEMES.ocean.color     },
];

export default function Home() {
  const titleRef = useRef(null);
  const navigate = useNavigate();

  // 5 fingers (open palm) = Start → jumps to first module
  useGesture((g) => { if (g === 'five_fingers') navigate('/pollution-cleaner'); });

  useEffect(() => {
    if (!titleRef.current) return;
    const letters = titleRef.current.querySelectorAll('[data-l]');
    gsap.from(letters, {
      y: 60, opacity: 0, rotateX: -60, stagger: 0.04, duration: 0.8, ease: 'power3.out', delay: 0.2,
    });
  }, []);

  const title = 'EcoVerse';

  return (
    <section className="relative min-h-screen pt-24 pb-12 overflow-hidden">
      {/* Background Three.js layer */}
      <div className="absolute inset-0 z-0">
        <Canvas dpr={[1, 1.6]} camera={{ position: [0, 0, 7], fov: 55 }}>
          <ambientLight intensity={0.55} color="#cce8ff" />
          <directionalLight position={[6, 4, 5]} intensity={1.4} color="#ffffff" />
          <directionalLight position={[-4, -2, -3]} intensity={0.3} color="#a4d8ff" />
          <Stars radius={50} depth={30} count={2000} factor={2.5} fade speed={1} />
          <ParticleField count={900}  color="#3fc290" />
          <ParticleField count={600}  color="#5cc8ff" radius={10} />
          <group position={[3.6, 0.4, 0]}>
            <Suspense fallback={<EarthOrb size={1.85} />}>
              <RealisticEarth size={1.85} />
            </Suspense>
          </group>
        </Canvas>
      </div>

      {/* Soft sky tint over the 3D layer — keeps the canvas readable on light page bg */}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_top,rgba(58,174,248,0.10),transparent_60%)]" />

      {/* HERO copy */}
      <div className="relative z-10 mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-[11px] uppercase tracking-[0.22em] text-eco-ink"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-eco-green animate-pulse" />
          A <b className="font-display tracking-wider text-eco-forest">Digital Hammerr</b> Installation · Environment Day Edition
        </motion.div>

        <h1
          ref={titleRef}
          className="mt-6 font-display font-extrabold text-[clamp(48px,9vw,124px)] leading-[0.95] tracking-tight"
        >
          {title.split('').map((c, i) => (
            <span key={i} data-l className="inline-block gradient-text">{c}</span>
          ))}
        </h1>

        <p className="mt-5 max-w-xl text-lg text-eco-ink leading-relaxed font-medium">
          A cinematic, touchless environmental experience. Raise your hand and
          become an <span className="text-eco-forest font-bold">Earth Guardian</span> —
          plant forests, clear oceans, defeat the carbon monster.
        </p>

        <div className="mt-7 flex items-center gap-4">
          <Link
            to="/pollution-cleaner"
            className="group relative inline-flex items-center gap-3 px-6 py-3 rounded-full font-bold tracking-wide
                       bg-gradient-to-r from-eco-green to-eco-cyan text-white
                       shadow-glow hover:shadow-glow-cyan transition-shadow"
          >
            Start Experience
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </Link>
          <span className="text-xs text-eco-ink2 max-w-[18ch] leading-snug">
            or show <b className="text-eco-forest">🖐 5 fingers</b> to begin
          </span>
        </div>

        {/* Module grid — 2×2 for symmetry (Ocean sits under Plant vs. Carbon Monster) */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl">
          {MODULES.map((m, i) => (
            <ModuleCard
              key={m.key}
              to={m.to}
              title={MODULE_THEMES[m.key].label}
              tagline={m.tagline}
              color={m.color}
              Icon={m.Icon}
              index={i}
            />
          ))}
        </div>

        <div className="mt-12 text-center">
          <div className="text-[11px] uppercase tracking-[0.3em] text-eco-ink2">
            Touchless · MediaPipe · React · Three.js
          </div>
          <div className="mt-2 text-[10px] uppercase tracking-[0.32em] text-eco-ink2">
            Crafted by <span className="text-eco-forest font-display tracking-[0.18em] font-bold">Digital Hammerr</span>
          </div>
        </div>
      </div>
    </section>
  );
}
