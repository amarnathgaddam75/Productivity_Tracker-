// Zustand store shared by the desktop and mobile apps.
//
// Data flow:  UI action -> optimistic state update -> localStorage cache
//             -> SyncQueue (localStorage) -> Firestore (LWW transaction)
//             Firestore listener -> LWW merge -> state
//
// The store is created per app so each platform can inject how "system"
// notifications are delivered (desktop OS notifications vs mobile badges).

import { create } from 'zustand';
import { storage } from './storage.js';
import { SyncQueue } from './sync.js';
import { applyRemoteChanges } from './merge.js';
import { dateKey, MS_MINUTE } from './time.js';
import * as timer from './timer.js';
import { computeDailyReport, summaryDoc, visibleTasks } from './reports.js';
import { evaluateNotifications } from './notifications.js';
import {
  onAuth,
  firestoreAdapter,
  subscribeCollection,
  subscribeDoc,
  signOut as fbSignOut,
} from './firebase.js';

export const DEFAULT_SETTINGS = {
  displayName: '',
  dailyGoalHours: 6,
  summaryHour: 18,
  carryOver: true,
  autoStartNext: false,
  systemNotifications: true,
  // assistant
  assistantName: 'Atlas',
  workStartHour: 9,
  workEndHour: 18,
  checkinMinutes: 60,
  nudgeUntrackedMinutes: 15,
  idlePauseMinutes: 10,
  distractions: 'youtube, netflix, reddit, instagram, facebook, twitter, x.com, tiktok, twitch, prime video, hotstar, 9gag',
  voice: true,
  sounds: true,
  pushToPhone: true,
  shareTitles: false,
  runInBackground: true,
  startAtLogin: false,
  updatedAt: 0,
};

const MAX_NOTIFICATIONS = 50;
const SUMMARY_INTERVAL_MS = 5 * MS_MINUTE;
const TOAST_MS = 6000;

const cacheKey = (uid, name) => `lt:${name}:${uid}`;

function getDeviceId() {
  let id = storage.get('lt:deviceId');
  if (!id) {
    id = Math.random().toString(36).slice(2, 10);
    storage.set('lt:deviceId', id);
  }
  return id;
}

export function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** Firestore rejects `undefined`; strip it recursively-lite (top level is enough for our docs). */
function clean(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out;
}

/** Sort: running first, then incomplete (oldest first), then completed (newest first). */
export function sortTasks(list) {
  return [...list].sort((a, b) => {
    if (timer.isRunning(a) !== timer.isRunning(b)) return timer.isRunning(a) ? -1 : 1;
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.completed) return (b.completedAt || 0) - (a.completedAt || 0);
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
}

/**
 * @param {object} [opts]
 * @param {(n: {kind, title, body}) => void} [opts.deliver] platform hook for OS-level notifications
 * @param {(count: number) => void} [opts.onBadge] unread-count hook (dock badge / app badge)
 */
export function createTrackerStore({ deliver, onBadge } = {}) {
  let queue = null;
  let unsubs = [];
  let seen = new Set();
  let seenDate = null;
  let lastSummaryAt = 0;
  let lastSummaryJson = '';
  let toastSeq = 0;
  const deviceId = getDeviceId();

  const useStore = create((set, get) => {
    // ---- persistence helpers ------------------------------------------------
    const uid = () => get().user?.uid;
    const saveCache = (name, value) => uid() && storage.set(cacheKey(uid(), name), value);

    const saveSeen = () => uid() && storage.set(cacheKey(uid(), 'seen'), { date: seenDate, keys: [...seen] });
    const loadSeen = (today) => {
      const s = storage.get(cacheKey(uid(), 'seen'));
      seenDate = today;
      seen = new Set(s && s.date === today ? s.keys : []);
    };

    const badge = () => onBadge?.(get().notifications.filter((n) => !n.read).length);

    /** Optimistically write a task and queue it for sync. */
    const writeTask = (task, now = Date.now()) => {
      const next = clean({ ...task, updatedAt: Math.max(now, (task.updatedAt || 0) + 1), deviceId });
      set((s) => ({ tasks: { ...s.tasks, [next.id]: next } }));
      saveCache('tasks', get().tasks);
      queue?.enqueue(`tasks/${next.id}`, next);
      return next;
    };

    const pauseOthers = (exceptId, now) => {
      for (const t of Object.values(get().tasks)) {
        if (t.id !== exceptId && timer.isRunning(t)) writeTask(timer.pause(t, now), now);
      }
    };

    const nextTaskToStart = (afterId) =>
      sortTasks(
        visibleTasks(get().tasks).filter((t) => !t.completed && t.id !== afterId && t.date === get().today),
      )[0];

    // ---- remote -> local ----------------------------------------------------
    const applyTaskChanges = (changes) => {
      const next = applyRemoteChanges(get().tasks, changes, (id) => queue?.pendingUpdatedAt(`tasks/${id}`));
      if (next !== get().tasks) {
        set({ tasks: next });
        saveCache('tasks', next);
      }
    };

    const applySettings = (remote) => {
      if (!remote) return;
      const pending = queue?.pendingUpdatedAt('meta/settings');
      if (pending != null && pending > (remote.updatedAt || 0)) return;
      const settings = { ...DEFAULT_SETTINGS, ...remote };
      set({ settings });
      saveCache('settings', settings);
    };

    const applySummaryChanges = (changes) => {
      const summaries = { ...get().summaries };
      for (const c of changes) {
        if (c.type === 'removed') delete summaries[c.id];
        else summaries[c.id] = c.data;
      }
      set({ summaries });
      saveCache('summaries', summaries);
    };

    const applyDeviceChanges = (changes) => {
      const devices = { ...get().devices };
      for (const c of changes) {
        if (c.type === 'removed' || c.data?.deleted) delete devices[c.id];
        else devices[c.id] = { ...c.data, id: c.id };
      }
      set({ devices });
    };

    // ---- daily rollover ------------------------------------------------------
    const rollover = (today, now) => {
      if (get().settings.carryOver) {
        for (const t of visibleTasks(get().tasks)) {
          if (!t.completed && t.date && t.date < today) writeTask({ ...t, date: today, carriedFrom: t.date }, now);
        }
      }
    };

    const saveSummary = (key, now, force = false) => {
      if (!queue) return;
      const report = computeDailyReport(get().tasks, key, { goalHours: get().settings.dailyGoalHours, now });
      if (!report.totalTasks && !report.hoursWorked) return;
      const docData = summaryDoc(report, now);
      const json = JSON.stringify({ ...docData, updatedAt: 0 });
      if (!force && json === lastSummaryJson) return;
      lastSummaryJson = json;
      set((s) => ({ summaries: { ...s.summaries, [key]: docData } }));
      queue.enqueue(`summaries/${key}`, docData);
    };

    return {
      status: 'loading', // 'loading' | 'signedOut' | 'ready'
      user: null,
      tasks: {},
      settings: { ...DEFAULT_SETTINGS },
      summaries: {},
      devices: {},
      pushKeys: null,
      pushKeysLoaded: false,
      presence: null,
      notifications: [],
      toasts: [],
      sync: { status: 'synced', pending: 0 },
      online: typeof navigator === 'undefined' || navigator.onLine !== false,
      today: dateKey(),

      // ---- session lifecycle -------------------------------------------------
      /** Wire Firebase auth to the store. Returns an unsubscribe function. */
      bindAuth() {
        const onOnline = () => get().setOnline(true);
        const onOffline = () => get().setOnline(false);
        if (typeof window !== 'undefined') {
          window.addEventListener('online', onOnline);
          window.addEventListener('offline', onOffline);
        }
        const unsubAuth = onAuth((user) => {
          if (user) get().startSession(user);
          else get().endSession();
        });
        return () => {
          unsubAuth();
          if (typeof window !== 'undefined') {
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
          }
        };
      },

      startSession(fbUser, { adapter, subscribe = true } = {}) {
        if (get().user?.uid === fbUser.uid && get().status === 'ready') return;
        get().endSession({ keepStatus: true });
        const user = { uid: fbUser.uid, email: fbUser.email, displayName: fbUser.displayName || '' };
        const today = dateKey();
        set({
          user,
          today,
          tasks: storage.get(cacheKey(user.uid, 'tasks'), {}) || {},
          settings: { ...DEFAULT_SETTINGS, ...(storage.get(cacheKey(user.uid, 'settings'), {}) || {}) },
          summaries: storage.get(cacheKey(user.uid, 'summaries'), {}) || {},
          notifications: storage.get(cacheKey(user.uid, 'notifications'), []) || [],
          toasts: [],
          status: 'ready',
        });
        loadSeen(today);
        lastSummaryJson = '';
        queue = new SyncQueue({
          uid: user.uid,
          adapter: adapter || firestoreAdapter(user.uid),
          onStatus: (sync) => set({ sync }),
        });
        if (subscribe) {
          const onErr = (err) => set({ sync: { ...get().sync, status: 'error', error: err?.message } });
          unsubs = [
            subscribeCollection(user.uid, 'tasks', applyTaskChanges, onErr),
            subscribeDoc(user.uid, 'meta/settings', applySettings, onErr),
            subscribeCollection(user.uid, 'summaries', applySummaryChanges, onErr, { max: 30 }),
            subscribeCollection(user.uid, 'devices', applyDeviceChanges, onErr),
            subscribeDoc(user.uid, 'meta/push', (d) => set({ pushKeys: d, pushKeysLoaded: true }), onErr),
            subscribeDoc(user.uid, 'meta/presence', (d) => set({ presence: d }), onErr),
          ];
        }
        rollover(today, Date.now());
        queue.flush();
        badge();
      },

      endSession({ keepStatus = false } = {}) {
        unsubs.forEach((u) => u?.());
        unsubs = [];
        queue?.stop();
        queue = null;
        set({
          user: null,
          tasks: {},
          summaries: {},
          devices: {},
          pushKeys: null,
          pushKeysLoaded: false,
          presence: null,
          notifications: [],
          toasts: [],
          settings: { ...DEFAULT_SETTINGS },
          sync: { status: 'synced', pending: 0 },
          ...(keepStatus ? {} : { status: 'signedOut' }),
        });
      },

      async signOut() {
        // Stop any running timer so time isn't tracked while signed out.
        const now = Date.now();
        pauseOthers(null, now);
        await queue?.flush().catch(() => {});
        await fbSignOut();
      },

      setOnline(online) {
        set({ online });
        if (online) queue?.flush();
        else if (queue) set({ sync: { ...get().sync, status: queue.pending ? 'offline' : 'synced' } });
      },

      syncNow() {
        return queue?.flush();
      },

      // ---- tasks ---------------------------------------------------------------
      addTask({ title, estimatedHours, date }) {
        const now = Date.now();
        const t = title?.trim();
        if (!t) return null;
        return writeTask(
          {
            id: newId(),
            title: t.slice(0, 200),
            estimatedHours: Math.max(0, Math.min(24, Number(estimatedHours) || 0)),
            completed: false,
            completedAt: null,
            date: date || get().today,
            sessions: [],
            baseMs: 0,
            runningSince: null,
            createdAt: now,
            deleted: false,
          },
          now,
        );
      },

      updateTask(id, patch) {
        const t = get().tasks[id];
        if (!t) return;
        const next = { ...t, ...patch };
        if (patch.title != null) next.title = String(patch.title).trim().slice(0, 200) || t.title;
        if (patch.estimatedHours != null)
          next.estimatedHours = Math.max(0, Math.min(24, Number(patch.estimatedHours) || 0));
        writeTask(next);
      },

      deleteTask(id) {
        const t = get().tasks[id];
        if (!t) return;
        // Tombstone instead of hard delete so the deletion itself syncs with LWW.
        writeTask({ ...timer.pause(t), deleted: true });
      },

      toggleComplete(id) {
        const now = Date.now();
        const t = get().tasks[id];
        if (!t) return;
        if (t.completed) {
          writeTask({ ...t, completed: false, completedAt: null }, now);
          return;
        }
        const wasRunning = timer.isRunning(t);
        writeTask({ ...timer.pause(t, now), completed: true, completedAt: now }, now);
        get().checkNotifications(now);
        if (wasRunning && get().settings.autoStartNext) {
          const next = nextTaskToStart(id);
          if (next) get().startTimer(next.id);
        }
      },

      startTimer(id) {
        const now = Date.now();
        const t = get().tasks[id];
        if (!t || t.completed || timer.isRunning(t)) return;
        pauseOthers(id, now); // only one task is timed at a time
        writeTask(timer.start(t, now), now);
      },

      pauseTimer(id) {
        const now = Date.now();
        const t = get().tasks[id];
        if (!t || !timer.isRunning(t)) return;
        writeTask(timer.pause(t, now), now);
      },

      /** Pause at a past moment (e.g. when you walked away from the computer). */
      pauseTimerAt(id, at) {
        const t = get().tasks[id];
        if (!t || !timer.isRunning(t)) return;
        const when = Math.min(Date.now(), Math.max(t.runningSince, at));
        writeTask(timer.pause(t, when));
      },

      toggleTimer(id) {
        const t = get().tasks[id];
        if (!t) return;
        if (timer.isRunning(t)) get().pauseTimer(id);
        else get().startTimer(id);
      },

      resetTimer(id) {
        const t = get().tasks[id];
        if (t) writeTask(timer.reset(t));
      },

      // ---- settings ------------------------------------------------------------
      updateSettings(patch) {
        const now = Date.now();
        const settings = clean({ ...get().settings, ...patch, updatedAt: now });
        set({ settings });
        saveCache('settings', settings);
        queue?.enqueue('meta/settings', settings);
      },

      // ---- phone push + presence -------------------------------------------------
      /** Store the web-push key pair shared by this user's desktops (owner-only doc). */
      savePushKeys(keys) {
        const doc = { ...keys, updatedAt: Date.now() };
        set({ pushKeys: doc });
        queue?.enqueue('meta/push', doc);
      },

      /** Register this phone's push subscription. */
      saveDevice(id, sub) {
        const now = Date.now();
        const doc = clean({ id, ...sub, deleted: false, createdAt: get().devices[id]?.createdAt || now, updatedAt: now });
        set((s) => ({ devices: { ...s.devices, [id]: doc } }));
        queue?.enqueue(`devices/${id}`, doc);
      },

      removeDevice(id) {
        const d = get().devices[id];
        if (!d) return;
        const doc = { ...d, deleted: true, updatedAt: Date.now() };
        set((s) => {
          const devices = { ...s.devices };
          delete devices[id];
          return { devices };
        });
        queue?.enqueue(`devices/${id}`, doc);
      },

      /** What the desktop is doing right now (shown on the phone). */
      setPresence(p) {
        const doc = clean({ ...p, updatedAt: Date.now() });
        set({ presence: doc });
        queue?.enqueue('meta/presence', doc);
      },

      // ---- notifications -------------------------------------------------------
      pushNotification(n) {
        const now = Date.now();
        const item = { id: `${now}-${++toastSeq}`, at: now, read: false, ...n };
        const notifications = [item, ...get().notifications].slice(0, MAX_NOTIFICATIONS);
        set((s) => ({ notifications, toasts: [...s.toasts, item].slice(-4) }));
        saveCache('notifications', notifications);
        badge();
        if (get().settings.systemNotifications) deliver?.(item);
        setTimeout(() => get().dismissToast(item.id), TOAST_MS);
      },

      dismissToast(id) {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      },

      markAllRead() {
        const notifications = get().notifications.map((n) => ({ ...n, read: true }));
        set({ notifications });
        saveCache('notifications', notifications);
        badge();
      },

      clearNotifications() {
        set({ notifications: [] });
        saveCache('notifications', []);
        badge();
      },

      checkNotifications(now = Date.now()) {
        const { tasks, settings, today } = get();
        if (seenDate !== today) loadSeen(today);
        const report = computeDailyReport(tasks, today, { goalHours: settings.dailyGoalHours, now });
        const fired = evaluateNotifications({ tasks, report, settings, now, seen });
        if (fired.length) {
          saveSeen();
          fired.forEach((n) => get().pushNotification(n));
        }
      },

      /** Heartbeat: call about once a second while the app is open. */
      tick(now = Date.now()) {
        if (get().status !== 'ready') return;
        const today = dateKey(now);
        if (today !== get().today) {
          const yesterday = get().today;
          saveSummary(yesterday, now, true); // freeze yesterday's final numbers
          set({ today });
          rollover(today, now);
        }
        get().checkNotifications(now);
        if (now - lastSummaryAt >= SUMMARY_INTERVAL_MS) {
          lastSummaryAt = now;
          saveSummary(today, now);
        }
      },
    };
  });

  return useStore;
}
