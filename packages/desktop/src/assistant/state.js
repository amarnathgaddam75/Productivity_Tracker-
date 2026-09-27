// Local (per-device) assistant state: brain settings, voice/thinking mode, latest activity sample
// and today's activity timeline. Activity never leaves this computer except
// for the short "now doing" presence line the phone shows.

import { create } from 'zustand';
import { storage, dateKey, DEFAULT_BRAIN } from '@lifetracker/shared';

const MAX_SEGMENTS = 3000;
const JOIN_GAP_MS = 20000;
export const AWAY = 'Away';

const segKey = (uid, day) => `lt:activity:${uid}:${day}`;

let seq = 0;

export const useAssistant = create((set, get) => ({
  uid: null,
  day: dateKey(),
  activity: null,
  segments: [],
  commandOpen: false,
  speaking: false,
  mode: 'idle', // 'idle' | 'listening' | 'thinking' | 'speaking'
  level: 0, // microphone level while listening
  brain: { ...DEFAULT_BRAIN, ...(storage.get('lt:brain', {}) || {}) },
  keys: {}, // providers with a saved API key
  weather: null,
  profile: null,

  load(uid) {
    const day = dateKey();
    set({ uid, day, segments: storage.get(segKey(uid, day), []) || [] });
  },

  /** Record one activity sample into today's timeline. */
  record(sample) {
    const { uid } = get();
    let { day, segments } = get();
    const today = dateKey(sample.at);
    if (today !== day) {
      day = today;
      segments = storage.get(segKey(uid, day), []) || [];
    }
    const away = sample.idleSec >= 120;
    const app = away ? AWAY : sample.app || (sample.supported === false ? null : 'Unknown');
    if (!app) {
      set({ activity: sample, day, segments });
      return;
    }
    const title = away ? '' : sample.title || '';
    const last = segments[segments.length - 1];
    let next;
    if (last && last.app === app && last.title === title && sample.at - last.end <= JOIN_GAP_MS) {
      next = [...segments.slice(0, -1), { ...last, end: sample.at }];
    } else {
      const start = away ? sample.at - sample.idleSec * 1000 : last && sample.at - last.end <= JOIN_GAP_MS ? last.end : sample.at - 5000;
      next = [...segments, { app, title, start: Math.max(start, last?.end ?? start), end: sample.at }].slice(-MAX_SEGMENTS);
    }
    set({ activity: sample, day, segments: next });
    if (uid) storage.set(segKey(uid, day), next);
  },

  setCommandOpen(open) {
    set({ commandOpen: open });
  },

  setSpeaking(speaking) {
    set({ speaking, mode: speaking ? 'speaking' : get().mode === 'speaking' ? 'idle' : get().mode });
  },

  setMode(mode) {
    set({ mode, ...(mode !== 'listening' ? { level: 0 } : {}) });
  },

  setLevel(level) {
    set({ level });
  },

  /** Brain settings are per laptop (the API key itself lives in the main process). */
  setBrain(patch) {
    const brain = { ...get().brain, ...patch };
    storage.set('lt:brain', brain);
    set({ brain });
  },

  setKeys(keys) {
    set({ keys: keys || {} });
  },

  setWeather(weather) {
    set({ weather });
  },

  setProfile(profile) {
    set({ profile });
  },
}));

/** Totals per app for a list of segments (excluding time away). */
export function appTotals(segments) {
  const totals = new Map();
  for (const s of segments) {
    if (s.app === AWAY) continue;
    totals.set(s.app, (totals.get(s.app) || 0) + Math.max(0, s.end - s.start));
  }
  return [...totals.entries()].map(([app, ms]) => ({ app, ms })).sort((a, b) => b.ms - a.ms);
}
