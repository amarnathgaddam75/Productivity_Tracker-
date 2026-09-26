// Tiny synthesized UI sounds (Web Audio, no audio files). Soft sine chimes
// so they stay pleasant when they repeat.

let ctx = null;
function audio() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq, start, length, gain = 0.08, type = 'sine') {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + start;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + length);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + length + 0.05);
}

const SOUNDS = {
  start: () => { tone(523.25, 0, 0.18); tone(783.99, 0.07, 0.25); },
  pause: () => { tone(659.25, 0, 0.18); tone(440, 0.08, 0.28); },
  complete: () => { tone(523.25, 0, 0.2); tone(659.25, 0.08, 0.22); tone(783.99, 0.16, 0.35); tone(1046.5, 0.24, 0.5, 0.05); },
  nudge: () => { tone(880, 0, 0.25, 0.06); tone(1174.66, 0.12, 0.35, 0.05); },
  goal: () => [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, i * 0.09, 0.6, 0.05)),
  tap: () => tone(1200, 0, 0.06, 0.03, 'triangle'),
};

/** Play a named UI sound: start | pause | complete | nudge | goal | tap */
export function playSound(name) {
  try {
    SOUNDS[name]?.();
  } catch {
    /* audio unavailable */
  }
}
