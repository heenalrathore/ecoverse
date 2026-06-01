import { useEffect, useState, useCallback } from 'react';

const KEY = 'ecoverse:score:v1';

const read = () => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* noop */ }
  return { health: 35, oxygen: 0, trees: 0, interactions: 0 };
};

const listeners = new Set();
let state = read();

const broadcast = () => {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* noop */ }
  listeners.forEach((l) => l(state));
};

export function useScore() {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    return () => listeners.delete(setS);
  }, []);

  const bump = useCallback((patch) => {
    state = {
      ...state,
      health:       Math.min(100, Math.max(0, state.health + (patch.health || 0))),
      oxygen:       Math.max(0, state.oxygen + (patch.oxygen || 0)),
      trees:        Math.max(0, state.trees + (patch.trees || 0)),
      interactions: state.interactions + (patch.interactions || 1),
    };
    broadcast();
  }, []);

  const reset = useCallback(() => {
    state = { health: 35, oxygen: 0, trees: 0, interactions: 0 };
    broadcast();
  }, []);

  return { score: s, bump, reset };
}
