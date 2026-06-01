/**
 * Audio loader — now backed by procedural Web Audio synthesis.
 *
 * The original Howler-based path silently no-op'd because no mp3 files ship
 * with the repo. We keep the same export surface (playSound / loadSound /
 * stopSound) so existing call sites don't change, but every sound name is
 * synthesized via /utils/synth.js.
 */

import { playSynth } from './synth';

export function loadSound() {
  // No-op: synth has no preload step. Returned object is unused.
  return null;
}

export function playSound(name /* , opts */) {
  playSynth(name);
  return null;
}

export function stopSound(/* name */) {
  // synth voices self-terminate at their scheduled stop time
}
