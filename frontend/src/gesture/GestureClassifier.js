/**
 * Finger-count gesture classifier.
 *
 * The 5 gestures the experience accepts (kept intentionally simple so they
 * are robust under varied lighting / hand poses / distance):
 *
 *   one_finger     — exactly 1 finger extended (typically the index)
 *   two_fingers    — exactly 2 fingers extended (index + middle)
 *   three_fingers  — exactly 3 fingers extended
 *   five_fingers   — 4 or 5 fingers extended (open palm)
 *   both_hands     — two hands visible at once
 *
 * A gesture only fires after the *same* finger count has been observed for
 * a short stability window (STEADY_FRAMES) and after a per-gesture cooldown
 * (COOLDOWN_MS) has elapsed since the last fire. This prevents spurious
 * triggers as the user transitions between counts.
 *
 * Landmarks are MediaPipe Hands format, normalized 0..1.
 */

const STEADY_FRAMES = 4;       // hand pose must be steady for this many frames
const COOLDOWN_MS   = 850;     // per-gesture cooldown between fires

const COUNT_GESTURE = {
  0: 'fist',                    // closed hand → exit gesture
  1: 'one_finger',
  2: 'two_fingers',
  3: 'three_fingers',
  4: 'five_fingers',            // 4 fingers counts as "open palm" too
  5: 'five_fingers',
};

export class GestureClassifier {
  constructor() {
    this.history = [];           // recent observed counts/states
    this.cooldowns = {};
  }

  // Number of extended fingers, handedness-aware.
  countFingers(landmarks, handLabel = 'Right') {
    let count = 0;
    const isRight = handLabel === 'Right';
    // Thumb (x compare on flipped video)
    if (isRight) {
      if (landmarks[4].x < landmarks[3].x - 0.01) count++;
    } else {
      if (landmarks[4].x > landmarks[3].x + 0.01) count++;
    }
    // Other 4 fingers (tip above pip in image y)
    for (const [tip, pip] of [[8, 6], [12, 10], [16, 14], [20, 18]]) {
      if (landmarks[tip].y < landmarks[pip].y - 0.02) count++;
    }
    return count;
  }

  /** Main per-frame classify. Returns observable state + optional fired gesture. */
  classify({ multiHandLandmarks, multiHandedness, ts = performance.now() }) {
    const out = {
      gesture: null,
      fingers: 0,
      hands: 0,
      landmarks: null,
      allLandmarks: null,
      label: null,
      ts,
    };

    if (!multiHandLandmarks?.length) {
      this._pushState({ key: 'none', ts });
      return out;
    }

    out.hands = multiHandLandmarks.length;
    out.allLandmarks = multiHandLandmarks;

    // Primary hand
    const lm0 = multiHandLandmarks[0];
    const label0 = multiHandedness?.[0]?.label || 'Right';
    out.landmarks = lm0;
    out.label = label0;
    const fingers0 = this.countFingers(lm0, label0);
    out.fingers = fingers0;

    // Two-hand state takes priority
    if (out.hands >= 2) {
      this._pushState({ key: 'both_hands', ts });
      const fired = this._maybeFire('both_hands', ts);
      if (fired) out.gesture = fired;
      return out;
    }

    // Single-hand: state is the finger count bucket
    const bucket = fingers0; // 0..5
    this._pushState({ key: 'c' + bucket, ts });

    const gestureName = COUNT_GESTURE[bucket];
    if (gestureName) {
      const fired = this._maybeFire(gestureName, ts, 'c' + bucket);
      if (fired) out.gesture = fired;
    }
    return out;
  }

  _pushState(s) {
    this.history.push(s);
    if (this.history.length > 12) this.history.shift();
  }

  /**
   * Emit gestureName if:
   *  - the last STEADY_FRAMES history entries all match the targetKey (or
   *    targetKey is omitted: matches any frames keyed identically),
   *  - the per-gesture cooldown has elapsed.
   */
  _maybeFire(gestureName, ts, targetKey) {
    if (this.history.length < STEADY_FRAMES) return null;
    const recent = this.history.slice(-STEADY_FRAMES);
    const key = targetKey || recent[recent.length - 1].key;
    const steady = recent.every((r) => r.key === key);
    if (!steady) return null;

    const last = this.cooldowns[gestureName] || 0;
    if (ts - last < COOLDOWN_MS) return null;
    this.cooldowns[gestureName] = ts;

    if (typeof window !== 'undefined' && window.__ECOVERSE_DEBUG__) {
      // eslint-disable-next-line no-console
      console.log('[Gesture]', gestureName, '@', Math.round(ts));
    }
    return gestureName;
  }
}
