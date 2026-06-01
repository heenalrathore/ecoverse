/**
 * Thin wrapper around MediaPipe Hands (loaded via CDN script tag in index.html).
 * Falls back to a no-op if globals aren't present yet (e.g., before scripts load).
 */

export class HandTracker {
  constructor({ onResults, videoEl }) {
    this.onResults = onResults;
    this.videoEl = videoEl;
    this.hands = null;
    this.camera = null;
    this.started = false;
  }

  async start() {
    if (this.started) return;
    if (typeof window === 'undefined') return;
    // Wait for CDN globals (Hands, Camera) — retry briefly if not ready
    const waitFor = (pred, timeout = 6000) =>
      new Promise((resolve, reject) => {
        const t0 = performance.now();
        const tick = () => {
          if (pred()) return resolve();
          if (performance.now() - t0 > timeout) return reject(new Error('mediapipe globals not loaded'));
          setTimeout(tick, 80);
        };
        tick();
      });
    await waitFor(() => !!(window.Hands && window.Camera));

    const Hands = window.Hands;
    const Camera = window.Camera;

    this.hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });
    this.hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });
    this.hands.onResults((r) => this.onResults?.(r));

    this.camera = new Camera(this.videoEl, {
      onFrame: async () => { await this.hands.send({ image: this.videoEl }); },
      width: 640, height: 480,
    });
    await this.camera.start();
    this.started = true;
  }

  stop() {
    try { this.camera?.stop?.(); } catch { /* noop */ }
    try { this.hands?.close?.(); } catch { /* noop */ }
    this.started = false;
  }
}
