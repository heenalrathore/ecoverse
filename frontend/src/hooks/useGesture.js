import { useEffect, useRef } from 'react';
import { useGestureContext } from '../gesture/GestureContext';

/**
 * Subscribe to gesture events. The callback fires once per distinct gesture event
 * (de-duped on the underlying ts), not on every frame.
 *
 *   useGesture((g, frame) => { if (g === 'swipe_left') ... }, []);
 *
 * Returns the live `frame` object so components can also read raw landmarks etc.
 */
export function useGesture(callback) {
  const { frame, lastGestureRef } = useGestureContext();
  const lastSeenTsRef = useRef(0);
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    const lg = lastGestureRef.current;
    if (!lg.name) return;
    if (lg.ts === lastSeenTsRef.current) return;
    lastSeenTsRef.current = lg.ts;
    cbRef.current?.(lg.name, frame);
  }, [frame, lastGestureRef]);

  return frame;
}
