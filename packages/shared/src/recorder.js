// Records one spoken command from the microphone and returns it as a 16 kHz
// mono WAV (base64). Stops by itself after you stop talking.

const TARGET_RATE = 16000;

function downsample(chunks, inRate) {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const input = new Float32Array(total);
  let o = 0;
  for (const c of chunks) {
    input.set(c, o);
    o += c.length;
  }
  if (inRate === TARGET_RATE) return input;
  const ratio = inRate / TARGET_RATE;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i += 1) {
    const a = Math.floor(i * ratio);
    const b = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = a; j < b; j += 1) sum += input[j];
    out[i] = sum / Math.max(1, b - a);
  }
  return out;
}

/** 16-bit PCM WAV from float samples. */
export function encodeWav(samples, rate = TARGET_RATE) {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const w = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  w(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buf);
}

export function bytesToBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/**
 * Start recording. Resolves `{ stop, done }`:
 *   done: Promise<{ base64, seconds, heard: boolean }>
 *   stop(): finish now
 * @param {{ onLevel?: (0..1) => void, maxSeconds?: number, silenceMs?: number }} opts
 */
export async function recordCommand({ onLevel, maxSeconds = 15, silenceMs = 1300 } = {}) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  const src = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const chunks = [];
  const started = performance.now();
  let heard = false;
  let lastVoice = performance.now();
  let finished = false;
  let resolveDone;
  const done = new Promise((r) => (resolveDone = r));

  const finish = () => {
    if (finished) return;
    finished = true;
    proc.disconnect();
    src.disconnect();
    stream.getTracks().forEach((t) => t.stop());
    const samples = downsample(chunks, ctx.sampleRate);
    ctx.close().catch(() => {});
    resolveDone({ base64: bytesToBase64(encodeWav(samples)), seconds: samples.length / TARGET_RATE, heard });
  };

  proc.onaudioprocess = (e) => {
    const data = e.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(data));
    let sum = 0;
    for (let i = 0; i < data.length; i += 1) sum += data[i] * data[i];
    const rms = Math.sqrt(sum / data.length);
    onLevel?.(Math.min(1, rms * 8));
    const now = performance.now();
    if (rms > 0.02) {
      heard = true;
      lastVoice = now;
    }
    if ((heard && now - lastVoice > silenceMs) || now - started > maxSeconds * 1000 || (!heard && now - started > 6000)) finish();
  };
  src.connect(proc);
  proc.connect(ctx.destination);
  return { stop: finish, done };
}

/** Browser speech recognition (phones / Chrome). Returns null when unavailable. */
export function speechRecognition() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}
