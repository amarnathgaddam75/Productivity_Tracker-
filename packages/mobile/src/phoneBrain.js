// The assistant on the phone.
//
// Who answers a question asked here:
//   1. this phone's own AI key, if you added one (Gemini / Groq / Claude), else
//   2. your laptop's brain, when the desktop app is running (relayed through
//      Firestore — the laptop picks the question up and writes the answer), else
//   3. the built-in brain on this phone (tasks, timers, reminders — no AI).

import { create } from 'zustand';
import {
  askAssistant,
  hostOnline,
  fetchTransport,
  fetchWeather,
  learnProfile,
  dueReminders,
  speak,
  stopSpeaking,
  playSound,
  storage,
  PROVIDERS,
  MS_MINUTE,
} from '@lifetracker/shared';
import { useStore } from './config';

const RELAY_WAIT_MS = 45000;
const PICKUP_WAIT_MS = 12000;

export const usePhoneBrain = create((set, get) => ({
  mode: 'idle', // idle | listening | thinking | waiting (for the laptop) | speaking
  heard: '', // live transcript while listening
  cfg: { provider: 'builtin', model: '', apiKey: '', ...(storage.get('lt:phone-brain', {}) || {}) },
  weather: null,
  profile: null,
  setMode: (mode) => set({ mode }),
  setHeard: (heard) => set({ heard }),
  setCfg(patch) {
    const cfg = { ...get().cfg, ...patch };
    storage.set('lt:phone-brain', cfg);
    set({ cfg });
  },
  setWeather: (weather) => set({ weather }),
  setProfile: (profile) => set({ profile }),
}));

/** Providers that can be called straight from a phone browser. */
export const PHONE_PROVIDERS = Object.entries(PROVIDERS).filter(([id, p]) => id === 'builtin' || p.browser);

function firstName() {
  const s = useStore.getState();
  return (s.settings.displayName || s.user?.displayName || '').split(' ')[0];
}

export function say(text) {
  if (!useStore.getState().settings.voice || !text) return;
  const line = String(text).split('\n')[0].slice(0, 400);
  usePhoneBrain.getState().setMode('speaking');
  speak(line);
  setTimeout(() => usePhoneBrain.getState().mode === 'speaking' && usePhoneBrain.getState().setMode('idle'), Math.min(15000, 1500 + line.length * 55));
}

function ctx() {
  const b = usePhoneBrain.getState();
  return { name: firstName(), profile: b.profile, weather: (city) => fetchWeather(city) };
}

const ownBrain = (cfg) => cfg.provider !== 'builtin' && (!PROVIDERS[cfg.provider]?.needsKey || cfg.apiKey);

/**
 * Wait for the laptop to answer a relayed question. Gives up after 12 s if the
 * laptop never picks it up, or after 45 s if it did but is still thinking.
 */
function waitForReply(msgId) {
  return new Promise((resolve) => {
    const find = (chat) => Object.values(chat).find((m) => m.role === 'assistant' && m.replyTo === msgId);
    const hit = find(useStore.getState().chat);
    if (hit) {
      resolve(hit);
      return;
    }
    const started = Date.now();
    let off = () => {};
    const check = () => {
      const s = useStore.getState();
      const r = find(s.chat);
      const picked = s.chat[msgId]?.status === 'working';
      const waited = Date.now() - started;
      if (r || waited > RELAY_WAIT_MS || (!picked && waited > PICKUP_WAIT_MS)) {
        clearInterval(timer);
        off();
        resolve(r || null);
      }
    };
    const timer = setInterval(check, 500);
    off = useStore.subscribe(check);
  });
}

export async function askFromPhone(text) {
  const input = String(text || '').trim();
  if (!input) return null;
  const b = usePhoneBrain.getState();
  const s = useStore.getState();
  stopSpeaking();
  try {
    if (ownBrain(b.cfg)) {
      b.setMode('thinking');
      const res = await askAssistant({ store: useStore, input, from: 'phone', platform: 'phone', cfg: b.cfg, transport: (req) => fetchTransport(req), ctx: ctx() });
      done(res.reply, res.error && !res.actions?.length);
      return res;
    }
    if (hostOnline(s.presence)) {
      b.setMode('waiting');
      const q = s.addChat({ role: 'user', text: input, from: 'phone', status: 'pending' });
      const reply = await waitForReply(q.id);
      if (reply) {
        done(reply.text, reply.status === 'error');
        return { reply: reply.text };
      }
      // laptop didn't answer in time: answer here with the built-in brain
      const cur = useStore.getState().chat[q.id];
      if (cur?.status === 'working') {
        done('Your laptop is still working on that — the answer will appear here.', true);
        return null;
      }
      b.setMode('thinking');
      const res = await askAssistant({ store: useStore, input, from: 'phone', platform: 'phone', cfg: { provider: 'builtin' }, ctx: ctx(), userMsg: cur || q });
      done(res.reply, !res.actions?.length);
      return res;
    }
    b.setMode('thinking');
    const res = await askAssistant({ store: useStore, input, from: 'phone', platform: 'phone', cfg: { provider: 'builtin' }, ctx: ctx() });
    done(res.reply, res.understood === false);
    return res;
  } catch (e) {
    usePhoneBrain.getState().setMode('idle');
    useStore.getState().addChat({ role: 'assistant', text: `Something went wrong: ${e?.message || e}`, from: 'phone', status: 'error' });
    return null;
  }
}

function done(reply, failed) {
  usePhoneBrain.getState().setMode('idle');
  if (useStore.getState().settings.sounds) playSound(failed ? 'nudge' : 'tap');
  say(reply);
}

/** Phone-side heartbeat: habits, weather, and reminders when the laptop is off. */
export function phoneTick(now = Date.now()) {
  const s = useStore.getState();
  if (s.status !== 'ready') return;
  const b = usePhoneBrain.getState();
  if (!b.profile || now - (b.profile.at || 0) > 10 * MS_MINUTE) b.setProfile({ ...learnProfile(s.tasks, { now, goalHours: s.settings.dailyGoalHours }), at: now });
  if (s.settings.city && (!b.weather || now - b.weather.at > 30 * MS_MINUTE || b.weather.city !== s.settings.city)) {
    b.setWeather({ at: now, city: s.settings.city, data: b.weather?.data || null });
    fetchWeather(s.settings.city)
      .then((data) => usePhoneBrain.getState().setWeather({ at: now, city: s.settings.city, data }))
      .catch(() => {});
  }
  // The laptop fires reminders (and pushes them here). If it's off, do it here.
  if (!hostOnline(s.presence, now)) {
    for (const r of dueReminders(s.reminders, now)) {
      s.completeReminder(r.id);
      if (now - r.at > 6 * 60 * MS_MINUTE) continue;
      s.pushNotification({ kind: 'reminder', title: 'Reminder', body: r.text });
      s.addChat({ role: 'assistant', text: `⏰ ${r.text}`, from: 'phone' });
      say(`Reminder: ${r.text}`);
    }
  }
}
