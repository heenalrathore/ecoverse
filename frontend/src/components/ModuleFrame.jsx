import { motion, AnimatePresence } from 'framer-motion';

/**
 * Shared layout chrome for every interactive module page.
 * Renders the title, gesture cheatsheet, an optional stats row and a toast.
 * The actual scene canvas is the page's responsibility (passed as children).
 *
 * Light theme: HUD cards use frosted-white glass with dark text — they float
 * cleanly on top of the dark canvas scenes inside each module.
 */
export default function ModuleFrame({
  theme, title, tagline, gestures = [], stats = [], toast, children,
}) {
  return (
    <section className={`relative min-h-screen overflow-hidden bg-gradient-to-b ${theme.gradient}`}>
      {/* Scene canvas / 3D content lives behind everything */}
      <div className="absolute inset-0">
        {children}
      </div>

      {/* Soft vignette — much lighter than before so the canvas stays visible */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_60%,rgba(10,42,31,0.25)_100%)]" />

      {/* HUD */}
      <div className="relative z-10 pt-28 px-6 max-w-6xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="font-display text-4xl md:text-5xl font-extrabold tracking-tight drop-shadow-lg"
          style={{ color: theme.color, textShadow: `0 2px 18px rgba(255,255,255,.7), 0 0 24px ${theme.color}55` }}
        >
          {title}
        </motion.h2>
        {tagline && (
          <motion.p
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
            className="mt-3 max-w-xl text-eco-ink font-medium drop-shadow"
            style={{ textShadow: '0 2px 10px rgba(255,255,255,.7)' }}
          >
            {tagline}
          </motion.p>
        )}

        <div className="mt-6 flex flex-wrap gap-4 items-stretch">
          {stats.map((s) => (
            <div key={s.label} className="glass-strong rounded-2xl p-4 min-w-[170px]">
              <div className="text-[10px] uppercase tracking-widest text-eco-ink2">{s.label}</div>
              <div className="font-display text-3xl tabular-nums font-extrabold" style={{ color: s.color || theme.color }}>
                {s.value}
              </div>
              {s.sub && <div className="text-[11px] text-eco-ink2 mt-0.5">{s.sub}</div>}
            </div>
          ))}

          <div className="glass rounded-2xl p-4 text-xs leading-relaxed text-eco-ink">
            <div className="text-[10px] uppercase tracking-widest text-eco-ink2 mb-2">Gestures</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              {gestures.map((g, i) => (
                <div key={i} className={g.wide ? 'col-span-2' : ''}>
                  <span className="font-bold" style={{ color: theme.color }}>{g.label}</span> · {g.does}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast}
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            className="fixed left-1/2 -translate-x-1/2 top-24 z-20 px-5 py-2.5 rounded-full glass-strong font-bold"
            style={{ color: theme.color, boxShadow: `0 8px 28px ${theme.color}44` }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
