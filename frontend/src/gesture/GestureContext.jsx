import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { HandTracker } from './HandTracker';
import { GestureClassifier } from './GestureClassifier';

const Ctx = createContext(null);

export function GestureProvider({ children }) {
  const videoRef = useRef(null);
  const trackerRef = useRef(null);
  const classifierRef = useRef(new GestureClassifier());

  const [status, setStatus] = useState('booting'); // booting | running | error | denied
  const [error, setError] = useState(null);
  const [frame, setFrame] = useState({
    gesture: null, fingers: 0, hands: 0,
    landmarks: null, allLandmarks: null, label: null, ts: 0,
  });
  // Stable reference to the latest gesture event subscribers can read
  const lastGestureRef = useRef({ name: null, ts: 0 });

  useEffect(() => {
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.style.display = 'none';
    document.body.appendChild(video);
    videoRef.current = video;

    const tracker = new HandTracker({
      videoEl: video,
      onResults: (results) => {
        const ts = performance.now();
        const classified = classifierRef.current.classify({
          multiHandLandmarks: results.multiHandLandmarks,
          multiHandedness: results.multiHandedness,
          ts,
        });
        if (classified.gesture) {
          lastGestureRef.current = { name: classified.gesture, ts };
        }
        setFrame({
          gesture: classified.gesture,
          fingers: classified.fingers,
          hands: classified.hands,
          landmarks: classified.landmarks,
          allLandmarks: results.multiHandLandmarks || null,
          label: classified.label,
          ts,
        });
      },
    });
    trackerRef.current = tracker;

    tracker.start()
      .then(() => setStatus('running'))
      .catch((err) => {
        console.error('[Gesture]', err);
        setError(err.message || String(err));
        setStatus(err?.name === 'NotAllowedError' ? 'denied' : 'error');
      });

    return () => {
      tracker.stop();
      try { document.body.removeChild(video); } catch { /* noop */ }
    };
  }, []);

  const value = useMemo(() => ({
    status,
    error,
    video: videoRef.current,
    frame,
    lastGestureRef,
  }), [status, error, frame]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGestureContext() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useGestureContext must be inside <GestureProvider>');
  return v;
}
