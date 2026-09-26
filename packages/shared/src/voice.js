// Spoken replies via the operating system's own text-to-speech
// (speechSynthesis). Works offline; on Linux it needs speech-dispatcher.

export function voiceAvailable() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.getVoices().length > 0;
}

function pickVoice() {
  const voices = window.speechSynthesis.getVoices();
  const lang = (navigator.language || 'en').slice(0, 2);
  return (
    voices.find((v) => v.lang?.startsWith(lang) && /natural|neural|premium|enhanced/i.test(v.name)) ||
    voices.find((v) => v.lang?.startsWith(lang) && v.localService) ||
    voices.find((v) => v.lang?.startsWith(lang)) ||
    voices[0]
  );
}

/** Speak text aloud (interrupts anything already being said). */
export function speak(text, { rate = 1.02, pitch = 0.95 } = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) return false;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(String(text).replace(/[“”]/g, '').replace(/·/g, ','));
    const v = pickVoice();
    if (v) u.voice = v;
    u.rate = rate;
    u.pitch = pitch;
    synth.speak(u);
    return true;
  } catch {
    return false;
  }
}

export function stopSpeaking() {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}
