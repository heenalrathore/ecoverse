import { motion } from 'framer-motion';
import { useScore } from '../hooks/useScore';

export default function EcoMeter({ compact = false }) {
  const { score } = useScore();
  const pct = Math.round(score.health);

  return (
    <div className={`glass rounded-2xl px-5 py-3 flex items-center gap-4 ${compact ? 'text-xs' : 'text-sm'} text-eco-ink`}>
      <div>
        <div className="uppercase tracking-widest text-eco-forest text-[10px] font-bold">Earth Health</div>
        <div className="flex items-center gap-2">
          <div className="relative h-2 w-40 bg-eco-ink/15 rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                background: 'linear-gradient(90deg, #e84a4a 0%, #ffd86b 40%, #3fc290 100%)',
                boxShadow: '0 0 10px rgba(63,194,144,.45)',
              }}
              animate={{ width: `${pct}%` }}
              transition={{ type: 'spring', stiffness: 80, damping: 20 }}
            />
          </div>
          <span className="tabular-nums font-bold text-eco-ink">{pct}%</span>
        </div>
      </div>
      <div className="h-8 w-px bg-eco-ink/15" />
      <div>
        <div className="uppercase tracking-widest text-[10px] text-eco-ocean font-bold">Oxygen</div>
        <div className="tabular-nums font-bold text-eco-ink">{score.oxygen.toLocaleString()} ppm</div>
      </div>
      <div>
        <div className="uppercase tracking-widest text-[10px] text-mod-forest font-bold">Trees</div>
        <div className="tabular-nums font-bold text-eco-ink">{score.trees.toLocaleString()}</div>
      </div>
    </div>
  );
}
