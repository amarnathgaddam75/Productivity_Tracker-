// The assistant's heartbeat on the laptop: every few seconds it samples what you
// are doing, lets the Coach decide whether to speak up, fires reminders,
// answers questions asked on the phone, and keeps the tray, the phone
// "presence" line and the activity timeline current.

import { useEffect } from 'react';
import {
  Coach,
  askAssistant,
  pendingForHost,
  brainLabel,
  dueReminders,
  learnProfile,
  fetchWeather,
  canTranscribe,
  buildTranscribeRequest,
  parseTranscribeResponse,
  recordCommand,
  speak,
  stopSpeaking,
  playSound,
  storage,
  timer,
  visibleTasks,
  formatHM,
  remainingPlan,
  dateKey,
  MS_MINUTE,
  MS_HOUR,
} from '@lifetracker/shared';
import { useStore } from '../config.js';
import { useAssistant, appTotals } from './state.js';
import { pushToPhones } from './phone.js';

const TICK_MS = 5000;
const bridge = typeof window !== 'undefined' ? window.desktop : undefined;

function name() {
  const s = useStore.getState();
  return (s.settings.displayName || s.user?.displayName || '').split(' ')[0];
}

function say(text) {
  if (!useStore.getState().settings.voice || !text) return;
  const clean = String(text).split('\n')[0].slice(0, 400);
  useAssistant.getState().setSpeaking(true);
  speak(clean);
  setTimeout(() => useAssistant.getState().setSpeaking(false), Math.min(15000, 1500 + clean.length * 55));
}

function sound(name) {
  if (useStore.getState().settings.sounds) playSound(name);
}

function agentCtx() {
  const a = useAssistant.getState();
  return {
    name: name(),
    profile: a.profile,
    activity: bridge ? { current: a.activity, totals: appTotals(a.segments) } : null,
    system: bridge ? { openUrl: bridge.openUrl, openApp: bridge.openApp } : null,
    weather: (city) => fetchWeather(city),
  };
}

const transport = () => (bridge?.llm ? (req) => bridge.llm(useAssistant.getState().brain.provider, req) : undefined);

/** Button actions attached to reminder messages. */
function internalAction(text) {
  const s = useStore.getState();
  let m;
  if ((m = text.match(/^__snooze:(\w+)$/))) {
    s.snoozeReminder(m[1], 10);
    s.addChat({ role: 'assistant', text: 'Snoozed for 10 minutes.', from: 'desktop' });
    return true;
  }
  return text === '__noop';
}

/** Ask the assistant (typed or spoken on this laptop, or relayed from the phone). */
export async function ask(text, { userMsg, quiet = false } = {}) {
  const input = String(text || '').trim();
  if (!input || internalAction(input)) return null;
  const a = useAssistant.getState();
  stopSpeaking();
  a.setMode('thinking');
  try {
    const res = await askAssistant({
      store: useStore,
      input,
      from: userMsg?.from || 'desktop',
      platform: 'desktop',
      cfg: a.brain,
      transport: transport(),
      ctx: agentCtx(),
      userMsg,
    });
    sound(res.error && !res.actions?.length ? 'nudge' : 'tap');
    if (!quiet && !userMsg) say(res.reply);
    return res;
  } finally {
    if (useAssistant.getState().mode === 'thinking') useAssistant.getState().setMode('idle');
  }
}

/** Quick deterministic command (tray menu, shortcut, nudge buttons) — no AI round trip. */
export function executeCommand(text) {
  if (internalAction(text)) return null;
  const a = useAssistant.getState();
  return askAssistant({ store: useStore, input: text, from: 'desktop', platform: 'desktop', cfg: { provider: 'builtin' }, ctx: agentCtx() }).then((res) => {
    sound(res.actions?.some((x) => x.ok) ? 'tap' : 'nudge');
    if (a.mode !== 'listening') say(res.reply);
    return res;
  });
}

// ---- voice ---------------------------------------------------------------------------------

let recording = null;

/** Push-to-talk: record until you stop speaking, transcribe with the brain, then ask. */
export async function listen() {
  const a = useAssistant.getState();
  if (recording) {
    recording.stop();
    return;
  }
  stopSpeaking();
  const s = useStore.getState();
  if (!canTranscribe(a.brain)) {
    const msg = 'Voice input needs a brain with speech-to-text — choose Gemini or Groq (both free) in Settings → Brain. You can always type, or talk to me from your phone.';
    s.addChat({ role: 'assistant', text: msg, from: 'desktop', status: 'error' });
    say(msg);
    return;
  }
  try {
    if (bridge?.micAccess && !(await bridge.micAccess())) throw new Error('Microphone access was denied.');
    a.setMode('listening');
    sound('start');
    recording = await recordCommand({ onLevel: (l) => useAssistant.getState().setLevel(l) });
    const clip = await recording.done;
    recording = null;
    if (!clip.heard || clip.seconds < 0.4) {
      a.setMode('idle');
      return;
    }
    a.setMode('thinking');
    const req = buildTranscribeRequest(a.brain, { audioBase64: clip.base64 });
    const json = await (bridge?.llm ? bridge.llm(a.brain.provider, req) : Promise.reject(new Error('Voice needs the desktop app.')));
    const heard = parseTranscribeResponse(a.brain, json);
    if (!heard) {
      a.setMode('idle');
      s.addChat({ role: 'assistant', text: "Sorry, I didn't catch that.", from: 'desktop' });
      say("Sorry, I didn't catch that.");
      return;
    }
    await ask(heard);
  } catch (e) {
    recording = null;
    useAssistant.getState().setMode('idle');
    const msg = `Voice failed: ${e?.message || e}`;
    useStore.getState().addChat({ role: 'assistant', text: msg, from: 'desktop', status: 'error' });
    sound('nudge');
  }
}

// ---- proactive ---------------------------------------------------------------------------------

function handleNudge(n) {
  const s = useStore.getState();
  if (n.kind === 'idle-pause') s.pauseTimerAt(n.taskId, n.pauseAt);
  s.addChat({ role: 'assistant', text: `${n.title}\n${n.body}`, from: 'desktop', actions: (n.actions || []).map((x) => `${x.label}|${x.command}`) });
  s.pushNotification({ kind: n.kind === 'idle-pause' ? 'checkin' : n.kind, title: n.title, body: n.body });
  sound('nudge');
  say(n.speak);
  pushToPhones({ kind: n.kind, title: n.title, body: n.body, tag: n.kind, urgent: n.kind === 'distraction' });
}

function fireReminders(now) {
  const s = useStore.getState();
  for (const r of dueReminders(s.reminders, now)) {
    s.completeReminder(r.id);
    const missed = now - r.at > 6 * MS_HOUR;
    const text = missed ? `⏰ Missed reminder: ${r.text}` : `⏰ ${r.text}`;
    s.addChat({ role: 'assistant', text, from: 'desktop', actions: missed ? [] : [`Snooze 10 min|__snooze:${r.id}`] });
    if (missed) continue;
    s.pushNotification({ kind: 'reminder', title: 'Reminder', body: r.text });
    sound('nudge');
    say(`${name() ? `${name()}, ` : ''}reminder: ${r.text}`);
    pushToPhones({ kind: 'reminder', title: '⏰ Reminder', body: r.text, tag: `reminder-${r.id}`, urgent: true });
  }
}

function browserSample() {
  // Plain browser build: no window tracking, approximate "away" by tab visibility.
  return { app: null, title: null, supported: false, idleSec: document.hidden ? 600 : 0, at: Date.now() };
}

export function useAssistantRuntime() {
  const uid = useStore((s) => s.user?.uid);

  // heartbeat
  useEffect(() => {
    if (!uid) return undefined;
    const memoKey = `lt:coach:${uid}`;
    const coach = new Coach(storage.get(memoKey, {}) || {});
    useAssistant.getState().load(uid);
    bridge?.brainKeyStatus?.().then((k) => useAssistant.getState().setKeys(k)).catch(() => {});
    let presenceKey = '';
    let presenceAt = 0;
    let profileAt = 0;
    let weatherAt = 0;
    let weatherCity = '';
    let busy = false;

    const tick = async () => {
      if (busy) return;
      busy = true;
      try {
        const s = useStore.getState();
        if (s.status !== 'ready') return;
        const sample = bridge?.sampleActivity ? await bridge.sampleActivity().catch(browserSample) : browserSample();
        useAssistant.getState().record(sample);
        const now = Date.now();
        const nudges = coach.tick({ tasks: s.tasks, today: s.today, settings: s.settings, activity: bridge ? sample : null, now, name: name() });
        storage.set(memoKey, coach.m);
        nudges.forEach(handleNudge);
        fireReminders(now);

        // learned habits (every 10 min) and weather (every 30 min)
        if (now - profileAt > 10 * MS_MINUTE) {
          profileAt = now;
          useAssistant.getState().setProfile(learnProfile(s.tasks, { now, goalHours: s.settings.dailyGoalHours }));
        }
        if (s.settings.city && (now - weatherAt > 30 * MS_MINUTE || weatherCity !== s.settings.city)) {
          weatherAt = now;
          weatherCity = s.settings.city;
          fetchWeather(s.settings.city).then((w) => useAssistant.getState().setWeather(w)).catch(() => useAssistant.getState().setWeather(null));
        }

        const running = visibleTasks(s.tasks).find(timer.isRunning);
        const left = remainingPlan(s.tasks, s.today, now).length;
        bridge?.updateTray?.({
          running: Boolean(running),
          short: running ? formatHM(timer.elapsedMs(running, now)) : '',
          label: running ? `● ${formatHM(timer.elapsedMs(running, now))}  ${running.title}` : `No timer running · ${left} task${left === 1 ? '' : 's'} left`,
        });
        // presence for the phone (on change, plus a 2-minute heartbeat)
        if (bridge) {
          const idle = sample.idleSec >= 120;
          const brain = useAssistant.getState().brain;
          const p = {
            app: idle ? null : sample.app || null,
            title: s.settings.shareTitles && !idle ? sample.title || null : null,
            idle,
            idleSec: Math.round(sample.idleSec || 0),
            taskId: running?.id || null,
            taskTitle: running?.title || null,
            platform: bridge.platform,
            supported: sample.supported !== false,
            answers: brain.answerPhone !== false,
            brain: brainLabel(brain).slice(0, 80),
          };
          const key = `${p.app}|${p.title}|${p.idle}|${p.taskId}|${p.answers}|${p.brain}`;
          if (key !== presenceKey || now - presenceAt > 120000) {
            presenceKey = key;
            presenceAt = now;
            s.setPresence(p);
          }
        }
      } finally {
        busy = false;
      }
    };
    tick();
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [uid]);

  // answer questions asked on the phone
  useEffect(() => {
    if (!uid || !bridge) return undefined;
    const handled = new Set();
    let working = false;
    const drain = async () => {
      if (working || useAssistant.getState().brain.answerPhone === false) return;
      const next = pendingForHost(useStore.getState().chat).find((m) => !handled.has(m.id));
      if (!next) return;
      working = true;
      handled.add(next.id);
      try {
        await ask(next.text, { userMsg: next });
      } finally {
        working = false;
        drain();
      }
    };
    drain();
    return useStore.subscribe((s, prev) => {
      if (s.chat !== prev.chat) drain();
    });
  }, [uid]);

  // sounds for timer changes (also when they come from the phone)
  useEffect(() => {
    if (!uid) return undefined;
    const snapshot = (s) => ({
      running: visibleTasks(s.tasks).find(timer.isRunning)?.id || null,
      done: visibleTasks(s.tasks).filter((t) => t.completed && t.date === dateKey()).length,
    });
    let prev = snapshot(useStore.getState());
    return useStore.subscribe((s) => {
      const cur = snapshot(s);
      if (s.settings.sounds) {
        if (cur.done > prev.done) playSound('complete');
        else if (cur.running && cur.running !== prev.running) playSound('start');
        else if (!cur.running && prev.running) playSound('pause');
      }
      prev = cur;
    });
  }, [uid]);

  // background / autostart preferences -> main process
  const runInBackground = useStore((s) => s.settings.runInBackground);
  const startAtLogin = useStore((s) => s.settings.startAtLogin);
  useEffect(() => {
    bridge?.setPrefs?.({ runInBackground: runInBackground !== false, startAtLogin: Boolean(startAtLogin) });
  }, [runInBackground, startAtLogin]);

  // tray menu + global shortcuts
  useEffect(() => {
    const offs = [
      bridge?.onCommandBar?.(() => useAssistant.getState().setCommandOpen(true)),
      bridge?.onAssistantCommand?.((cmd) => executeCommand(cmd)),
      bridge?.onVoice?.(() => listen()),
    ];
    return () => offs.forEach((off) => typeof off === 'function' && off());
  }, []);
}
