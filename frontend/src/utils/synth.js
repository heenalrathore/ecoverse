/**
 * Procedural sound synthesis via Web Audio API.
 *
 * Why this exists: no real mp3 files ship with the repo, so the Howler pipeline
 * was silently no-op'ing. This module synthesizes recognizable sound effects
 * on the fly so every gesture has audible feedback — no asset downloads.
 *
 * Browser autoplay policy: AudioContext can only be resumed after a user
 * interaction. We register one-shot unlock listeners on first ensure().
 */

let ctx = null;
let unlockedListenersAttached = false;

function maybeAttachUnlock() {
  if (unlockedListenersAttached) return;
  const handler = () => {
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    window.removeEventListener('click', handler);
    window.removeEventListener('keydown', handler);
    window.removeEventListener('touchstart', handler);
  };
  window.addEventListener('click', handler);
  window.addEventListener('keydown', handler);
  window.addEventListener('touchstart', handler);
  unlockedListenersAttached = true;
}

function ensure() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  maybeAttachUnlock();
  return ctx;
}

/* ------------------------------------------------------------------
   Sound bank: each entry is `(ac, t) => void` that schedules a sound
   starting at audio-time `t`.
------------------------------------------------------------------- */

const BANK = {
  /* Two-oscillator bell-like chime — for wind, generic positive cues */
  chime(ac, t) {
    const o1 = ac.createOscillator(); o1.type = 'sine'; o1.frequency.value = 880;
    const o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.value = 1320;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    o1.connect(g); o2.connect(g); g.connect(ac.destination);
    o1.start(t); o2.start(t);
    o1.stop(t + 1.1); o2.stop(t + 1.1);
  },

  /* Soft band-passed noise — wind chime / breath */
  wind(ac, t) {
    const len = ac.sampleRate * 1.4;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.7;
    const src = ac.createBufferSource(); src.buffer = buf;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 2.2;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    src.connect(f); f.connect(g); g.connect(ac.destination);
    src.start(t);
  },

  /* Quick chirps — birds chorus */
  birds(ac, t) {
    for (let i = 0; i < 6; i++) {
      const ts = t + i * 0.10 + Math.random() * 0.04;
      const o = ac.createOscillator(); o.type = 'sine';
      const f0 = 1600 + Math.random() * 1400;
      o.frequency.setValueAtTime(f0, ts);
      o.frequency.exponentialRampToValueAtTime(f0 * (1.2 + Math.random() * 0.4), ts + 0.07);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, ts);
      g.gain.exponentialRampToValueAtTime(0.16, ts + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ts + 0.12);
      o.connect(g); g.connect(ac.destination);
      o.start(ts); o.stop(ts + 0.14);
    }
  },

  /* High-passed noise — rainfall */
  rain(ac, t) {
    const len = ac.sampleRate * 2.2;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    const src = ac.createBufferSource(); src.buffer = buf;
    const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1100;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.14, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.0);
    src.connect(f); f.connect(g); g.connect(ac.destination);
    src.start(t);
  },

  /* Major chord burst — orchestra (C4 E4 G4 C5) */
  chord(ac, t) {
    const notes = [261.63, 329.63, 392.00, 523.25];
    for (const n of notes) {
      const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = n;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.10, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      o.connect(g); g.connect(ac.destination);
      o.start(t); o.stop(t + 1.7);
    }
  },

  /* Brown noise with filter sweep — thunder */
  thunder(ac, t) {
    const len = ac.sampleRate * 1.8;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    // Integrated noise = brown-ish
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = (Math.random() * 2 - 1);
      last = (last + w * 0.15) / 1.05;
      data[i] = last * 3.5;
    }
    const src = ac.createBufferSource(); src.buffer = buf;
    const f = ac.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(1800, t);
    f.frequency.exponentialRampToValueAtTime(180, t + 0.6);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.42, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    src.connect(f); f.connect(g); g.connect(ac.destination);
    src.start(t);
  },

  /* Quick downward pitch + decay — soft pop / seed-plant */
  pop(ac, t) {
    const o = ac.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(700, t);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.12);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    o.connect(g); g.connect(ac.destination);
    o.start(t); o.stop(t + 0.16);
  },

  /* Filtered noise sweep — whoosh / swipe */
  whoosh(ac, t) {
    const len = ac.sampleRate * 0.55;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    const src = ac.createBufferSource(); src.buffer = buf;
    const f = ac.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.setValueAtTime(500, t);
    f.frequency.exponentialRampToValueAtTime(2400, t + 0.4);
    f.Q.value = 1.5;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    src.connect(f); f.connect(g); g.connect(ac.destination);
    src.start(t);
  },

  /* Rising saw + sub kick — power-up / energy strike */
  power(ac, t) {
    const o1 = ac.createOscillator(); o1.type = 'sawtooth';
    o1.frequency.setValueAtTime(120, t);
    o1.frequency.exponentialRampToValueAtTime(880, t + 0.6);
    const o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.value = 55;
    const g1 = ac.createGain();
    g1.gain.setValueAtTime(0.0001, t);
    g1.gain.exponentialRampToValueAtTime(0.14, t + 0.08);
    g1.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
    const g2 = ac.createGain();
    g2.gain.setValueAtTime(0.28, t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o1.connect(g1); o2.connect(g2);
    g1.connect(ac.destination); g2.connect(ac.destination);
    o1.start(t); o1.stop(t + 0.95);
    o2.start(t); o2.stop(t + 0.55);
  },
};

/* Map the sound-names the pages currently call to synth presets. */
const ALIAS = {
  forest:  'wind',
  ocean:   'wind',
  wind:    'wind',
  rain:    'rain',
  thunder: 'thunder',
  birds:   'birds',
  whoosh:  'whoosh',
  chime:   'chime',
  chord:   'chord',
  pop:     'pop',
  power:   'power',
};

export function playSynth(name) {
  const ac = ensure();
  if (!ac) return;
  const preset = ALIAS[name] || name;
  const fn = BANK[preset];
  if (!fn) return;
  try { fn(ac, ac.currentTime); } catch { /* noop */ }
}

export function stopSynth() {
  // BufferSource/Oscillator can't be globally stopped without a registry,
  // but they self-terminate after their scheduled stop times — fine for our use.
}
