// Holographic UI sound effects, synthesized live with the Web Audio API (no audio files).
// iPhone Safari only allows audio after a user tap, so unlock() is called from a tap handler.
let ctx: AudioContext | null = null;
let enabled = true;

export function setSfxEnabled(on: boolean) { enabled = on; }

export function unlockAudio(): AudioContext {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** The shared AudioContext (created on first tap). Used for HOLLOW's voice playback too. */
export function audioContext(): AudioContext { return unlockAudio(); }

function tone(freq: number, endFreq: number, dur: number, type: OscillatorType, vol: number, delay = 0) {
  if (!enabled || !ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const sfx = {
  tap() { tone(1800, 1200, 0.06, 'sine', 0.08); },
  boot() {
    tone(80, 600, 1.4, 'sawtooth', 0.04);
    tone(220, 1760, 1.6, 'sine', 0.06, 0.1);
    [0, 0.25, 0.5, 0.75].forEach((d, i) => tone(900 + i * 300, 900 + i * 300, 0.08, 'square', 0.025, 0.4 + d));
    tone(1320, 1320, 0.5, 'sine', 0.07, 1.5);
    tone(1980, 1980, 0.6, 'sine', 0.04, 1.5);
  },
  online() { tone(660, 990, 0.15, 'sine', 0.07); tone(990, 1320, 0.2, 'sine', 0.06, 0.12); },
  error() { tone(300, 180, 0.35, 'square', 0.05); },
  listen() { tone(880, 1320, 0.12, 'sine', 0.06); },
  heard() { tone(1320, 880, 0.12, 'sine', 0.05); },
};
