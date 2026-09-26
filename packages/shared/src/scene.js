// What the app is doing right now, and how the background orb should look.
// Shared by the desktop shell, the desktop timer and the mobile app so the
// particle "scene" always matches the timer.

import * as timer from './timer.js';
import { visibleTasks } from './reports.js';

function sortForNext(list) {
  return [...list].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

/** The task the timer UI should show: the running one, else the last one worked on. */
export function activeTimer(tasks, today, now = Date.now()) {
  const list = visibleTasks(tasks);
  const running = list.find(timer.isRunning);
  const lastWorked = list
    .filter((t) => !t.completed && t.sessions?.length)
    .sort((a, b) => (b.sessions[b.sessions.length - 1]?.end || 0) - (a.sessions[a.sessions.length - 1]?.end || 0))[0];
  const nextUp = sortForNext(list.filter((t) => !t.completed && t.date === today && !timer.isRunning(t)))[0];
  const task = running || lastWorked || null;
  const isRunning = timer.isRunning(task);
  const elapsed = task ? timer.elapsedMs(task, now) : 0;
  const est = task ? timer.estimateMs(task) : 0;
  const remaining = est - elapsed;
  const over = est > 0 && remaining < 0;
  const warn = est > 0 && !over && remaining <= timer.warningThresholdMs(task);
  return { task, running: isRunning, elapsed, est, remaining, over, warn, nextUp };
}

/** Accent colour for the current timer state. */
export function timerAccent({ over, warn }) {
  if (over) return '#fb7185';
  if (warn) return '#fbbf24';
  return '#a78bfa';
}

/**
 * Orb look for a screen of the app.
 * @param {'tasks'|'reports'|'settings'|'alerts'|'auth'} view
 * @param {ReturnType<typeof activeTimer>} info
 */
export function sceneOrbState(view, info, extra = {}) {
  switch (view) {
    case 'assistant': {
      const color = { ahead: '#6ee7b7', done: '#6ee7b7', behind: '#fbbf24', idle: '#a78bfa' }[extra.status] || '#a78bfa';
      return extra.speaking
        ? { shape: 'sphere', color, energy: 1.2, brightness: 1.3 }
        : { shape: 'sphere', color, energy: 0.55, brightness: 1 };
    }
    case 'reports':
      return { shape: 'galaxy', color: '#fbbf24', energy: 0.4, brightness: 0.9 };
    case 'settings':
    case 'alerts':
      return { shape: 'twin', color: '#7dd3fc', energy: 0.35, brightness: 0.85 };
    case 'auth':
      return { shape: 'sphere', color: '#a78bfa', energy: 0.45, brightness: 1 };
    default:
      if (info?.running) return { shape: 'ring', color: timerAccent(info), energy: info.over ? 1 : 0.85, brightness: 1.05 };
      if (info?.task) return { shape: 'sphere', color: '#c7d2fe', energy: 0.15, brightness: 0.7 };
      return { shape: 'cube', color: '#c7d2fe', energy: 0.3, brightness: 0.85 };
  }
}
