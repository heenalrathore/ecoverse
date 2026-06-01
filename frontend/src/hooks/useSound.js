import { useCallback, useEffect, useRef } from 'react';
import { playSound, stopSound, loadSound } from '../utils/audioLoader';

/**
 * Plays/loops a named sound. Files live in /public/sounds/<name>.mp3.
 * Falls back silently when missing — see /src/sounds/README.md.
 */
export function useSound() {
  const playingRef = useRef(new Set());

  const play = useCallback((name, opts = {}) => {
    playingRef.current.add(name);
    return playSound(name, opts);
  }, []);

  const stop = useCallback((name) => {
    playingRef.current.delete(name);
    stopSound(name);
  }, []);

  const preload = useCallback((names) => {
    names.forEach((n) => loadSound(n));
  }, []);

  useEffect(() => () => {
    playingRef.current.forEach(stopSound);
    playingRef.current.clear();
  }, []);

  return { play, stop, preload };
}
