import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTilt } from '../hooks/useTilt';
import { hexToRgba } from '../utils/colors';

export default function ModuleCard({ to, title, tagline, color, Icon, index = 0 }) {
  const { ref, onMouseMove, onMouseLeave } = useTilt({ max: 10 });

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + index * 0.08, duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
      className="relative"
    >
      <Link
        to={to}
        ref={ref}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        className="group relative block h-full rounded-3xl p-6 overflow-hidden glass text-eco-ink transition-shadow duration-500 hover:shadow-2xl"
        style={{
          background: `
            radial-gradient(circle at var(--mx, 50%) var(--my, 50%), ${hexToRgba(color, 0.32)} 0%, transparent 55%),
            linear-gradient(160deg, rgba(255,255,255,0.78), rgba(255,255,255,0.55))
          `,
          boxShadow: `0 6px 22px rgba(10,42,31,0.10), 0 0 0 1px ${hexToRgba(color, 0.35)}`,
          willChange: 'transform',
        }}
      >
        {/* glow ring */}
        <div
          className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: `linear-gradient(140deg, ${hexToRgba(color, 0.5)}, transparent 60%)`,
            mask: 'linear-gradient(#000, #000) content-box, linear-gradient(#000, #000)',
            WebkitMask: 'linear-gradient(#000, #000) content-box, linear-gradient(#000, #000)',
            padding: 1,
          }}
        />

        {/* Icon */}
        <div
          className="relative w-14 h-14 rounded-2xl grid place-items-center mb-5 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6"
          style={{
            background: hexToRgba(color, 0.16),
            boxShadow: `0 0 28px ${hexToRgba(color, 0.45)}`,
          }}
        >
          {Icon ? <Icon size={28} style={{ color }} /> : null}
        </div>

        <h3 className="text-xl font-display font-bold tracking-tight text-eco-ink">{title}</h3>
        <p className="mt-2 text-sm text-eco-ink2 leading-relaxed">{tagline}</p>

        <div className="mt-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
             style={{ color }}>
          Enter <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">→</span>
        </div>

        {/* corner glow particles */}
        <span
          className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-50 group-hover:opacity-80 transition-opacity"
          style={{ background: hexToRgba(color, 0.35) }}
        />
      </Link>
    </motion.div>
  );
}
