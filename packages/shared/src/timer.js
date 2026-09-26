// Pure timer logic. A task's tracked time is stored as a list of closed
// sessions plus an optional open session (`runningSince`). Keeping raw
// sessions (instead of a single counter) lets us attribute time to the
// correct calendar day, which powers the daily reports and midnight reset.

import { MS_HOUR, MS_MINUTE } from './time.js';

const MAX_SESSIONS = 200;
const COMPACT_TO = 100;

export function isRunning(task) {
  return typeof task?.runningSince === 'number';
}

/** Total tracked milliseconds for the task (all days). */
export function elapsedMs(task, now = Date.now()) {
  if (!task) return 0;
  let total = task.baseMs || 0;
  for (const s of task.sessions || []) total += Math.max(0, s.end - s.start);
  if (isRunning(task)) total += Math.max(0, now - task.runningSince);
  return total;
}

export function estimateMs(task) {
  return Math.max(0, Number(task?.estimatedHours) || 0) * MS_HOUR;
}

/** Estimated minus actual. Negative means the task is over its estimate. */
export function remainingMs(task, now = Date.now()) {
  return estimateMs(task) - elapsedMs(task, now);
}

/** 0..1+ progress of actual vs estimate (can exceed 1 when over). */
export function progress(task, now = Date.now()) {
  const est = estimateMs(task);
  if (!est) return 0;
  return elapsedMs(task, now) / est;
}

/** Tracked milliseconds that fall inside [from, to). */
export function msInRange(task, from, to, now = Date.now()) {
  if (!task) return 0;
  const overlap = (a, b) => Math.max(0, Math.min(b, to) - Math.max(a, from));
  let total = 0;
  for (const s of task.sessions || []) total += overlap(s.start, s.end);
  if (isRunning(task)) total += overlap(task.runningSince, now);
  return total;
}

/**
 * Warning threshold for "time is almost up": 1 hour for tasks estimated at more
 * than an hour; for short tasks we warn at 25% remaining (min 5 minutes) so the
 * warning isn't fired the instant the timer starts.
 */
export function warningThresholdMs(task) {
  const est = estimateMs(task);
  if (est > MS_HOUR) return MS_HOUR;
  return Math.max(5 * MS_MINUTE, est * 0.25);
}

// ---- transitions (return new task objects; never mutate) -------------------

export function start(task, now = Date.now()) {
  if (isRunning(task) || task.completed) return task;
  return { ...task, runningSince: now };
}

export function pause(task, now = Date.now()) {
  if (!isRunning(task)) return task;
  const end = Math.max(now, task.runningSince);
  let sessions = [...(task.sessions || [])];
  if (end > task.runningSince) sessions.push({ start: task.runningSince, end });
  let baseMs = task.baseMs || 0;
  if (sessions.length > MAX_SESSIONS) {
    // Fold the oldest sessions into baseMs to bound document size.
    const folded = sessions.slice(0, sessions.length - COMPACT_TO);
    sessions = sessions.slice(sessions.length - COMPACT_TO);
    for (const s of folded) baseMs += s.end - s.start;
  }
  return { ...task, sessions, baseMs, runningSince: null };
}

export function toggle(task, now = Date.now()) {
  return isRunning(task) ? pause(task, now) : start(task, now);
}

/** Clears all tracked time. */
export function reset(task) {
  return { ...task, sessions: [], baseMs: 0, runningSince: null };
}
