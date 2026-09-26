// The assistant's heartbeat on desktop: every few seconds it samples what you
// are doing, lets the Coach decide whether to speak up, and keeps the tray,
// the phone "presence" line and the activity timeline current.

import { useEffect } from 'react';
import { Coach, runCommand, speak, playSound, storage, timer, visibleTasks, formatHM, remainingPlan, dateKey } from '@lifetracker/shared';
import { useStore } from '../config.js';
import { useAssistant } from './state.js';
import { pushToPhones } from './phone.js';

const TICK_MS = 5000;
const bridge = typeof window !== 'undefined' ? window.desktop : undefined;

function name() {
  const s = useStore.getState();
  return (s.settings.displayName || s.user?.displayName || '').split(' ')[0];
}

function say(text) {
  if (!useStore.getState().settings.voice || !text) return;
  useAssistant.getState().setSpeaking(true);
  speak(text);
  setTimeout(() => useAssistant.getState().setSpeaking(false), Math.min(12000, 1500 + text.length * 55));
}

/** Run a typed/tray/shortcut command and log the exchange. */
export function executeCommand(text, { fromUser = true } = {}) {
  const a = useAssistant.getState();
  if (fromUser) a.addMessage({ from: 'you', text });
  const res = runCommand(text, useStore, { name: name() });
  a.addMessage({ from: 'assistant', text: res.reply, ok: res.ok });
  if (useStore.getState().settings.sounds) playSound(res.ok ? 'tap' : 'nudge');
  say(res.speech || (res.reply.length < 160 ? res.reply : res.reply.split('\n')[0]));
  return res;
}

function handleNudge(n) {
  const s = useStore.getState();
  if (n.kind === 'idle-pause') s.pauseTimerAt(n.taskId, n.pauseAt);
  useAssistant.getState().addMessage({ from: 'assistant', kind: n.kind, text: `${n.title}\n${n.body}`, actions: n.actions || [] });
  s.pushNotification({ kind: n.kind === 'idle-pause' ? 'checkin' : n.kind, title: n.title, body: n.body });
  if (s.settings.sounds) playSound('nudge');
  say(n.speak);
  pushToPhones({ kind: n.kind, title: n.title, body: n.body, tag: n.kind, urgent: n.kind === 'distraction' });
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
    let presenceKey = '';
    let presenceAt = 0;
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
        const nudges = coach.tick({
          tasks: s.tasks,
          today: s.today,
          settings: s.settings,
          activity: bridge ? sample : null,
          now,
          name: name(),
        });
        storage.set(memoKey, coach.m);
        nudges.forEach(handleNudge);

        const running = visibleTasks(s.tasks).find(timer.isRunning);
        // tray
        const left = remainingPlan(s.tasks, s.today, now).length;
        bridge?.updateTray?.({
          running: Boolean(running),
          short: running ? formatHM(timer.elapsedMs(running, now)) : '',
          label: running ? `● ${formatHM(timer.elapsedMs(running, now))}  ${running.title}` : `No timer running · ${left} task${left === 1 ? '' : 's'} left`,
        });
        // presence for the phone (on change, plus a 2-minute heartbeat)
        if (bridge) {
          const idle = sample.idleSec >= 120;
          const p = {
            app: idle ? null : sample.app || null,
            title: s.settings.shareTitles && !idle ? sample.title || null : null,
            idle,
            idleSec: Math.round(sample.idleSec || 0),
            taskId: running?.id || null,
            taskTitle: running?.title || null,
            platform: bridge.platform,
            supported: sample.supported !== false,
          };
          const key = `${p.app}|${p.title}|${p.idle}|${p.taskId}`;
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
      bridge?.onAssistantCommand?.((cmd) => executeCommand(cmd, { fromUser: false })),
    ];
    return () => offs.forEach((off) => typeof off === 'function' && off());
  }, []);
}
