import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import EarthOrb from '../three/EarthOrb';
import RealisticEarth from '../three/RealisticEarth';
import ParticleField from '../three/ParticleField';
import { useScore } from '../hooks/useScore';

export default function Ending() {
  const { score } = useScore();

  return (
    <section className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0">
        <Canvas dpr={[1, 1.6]} camera={{ position: [0, 0, 7], fov: 55 }}>
          <ambientLight intensity={0.6} color="#cce8ff" />
          <directionalLight position={[5, 4, 5]} intensity={1.5} color="#ffffff" />
          <directionalLight position={[-4, -2, -3]} intensity={0.35} color="#a4d8ff" />
          <Stars radius={50} depth={30} count={2500} factor={2.5} fade speed={1.4} />
          <ParticleField count={1800} color="#3fc290" />
          <ParticleField count={1200} color="#5cc8ff" radius={11} />
          <Suspense fallback={<EarthOrb size={2.4} />}>
            <RealisticEarth size={2.4} />
          </Suspense>
        </Canvas>
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(58,174,248,0.10),transparent_60%)]" />

      <div className="relative z-10 min-h-screen grid place-items-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.4, ease: 'easeOut' }}
          className="text-center"
        >
          <div className="font-display text-[clamp(36px,6vw,80px)] font-extrabold leading-[1.05] tracking-tight gradient-text">
            The Future Of Earth<br />Is In Your Hands
          </div>
          <p className="mt-6 text-eco-ink font-medium max-w-xl mx-auto" style={{ textShadow: '0 2px 10px rgba(255,255,255,.7)' }}>
            You restored <span className="text-eco-forest font-bold">{score.trees.toLocaleString()}</span> trees and{' '}
            <span className="text-eco-ocean font-bold">{score.oxygen.toLocaleString()}</span> ppm of oxygen.
            Earth health: <span className="text-eco-forest font-bold">{Math.round(score.health)}%</span>.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-3 px-6 py-3 rounded-full font-bold tracking-wide
                         bg-gradient-to-r from-eco-green to-eco-cyan text-white shadow-glow hover:shadow-glow-cyan transition-shadow"
            >
              Begin Again →
            </Link>
          </div>
          <div className="mt-12 uppercase tracking-[0.32em] text-[11px] text-eco-ink2 font-bold">
            EARTH GUARDIAN · ACTIVATED
          </div>
          <div className="mt-2 text-[10px] uppercase tracking-[0.28em] text-eco-ink2">
            by <span className="text-eco-forest font-bold">Digital Hammerr</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
