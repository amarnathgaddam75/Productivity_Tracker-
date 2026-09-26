// Daily report calculations (pure functions over the task list).

import { dayBounds, MS_HOUR } from './time.js';
import { elapsedMs, estimateMs, msInRange } from './timer.js';
import { pickMessage } from './messages.js';

export const visibleTasks = (tasks) =>
  Object.values(tasks || {}).filter((t) => t && !t.deleted);

/** Tasks that belong to the given day: planned for it, or worked on during it. */
export function tasksForDay(tasks, key, now = Date.now()) {
  const [from, to] = dayBounds(key);
  return visibleTasks(tasks).filter(
    (t) =>
      t.date === key ||
      (t.completedAt && t.completedAt >= from && t.completedAt < to) ||
      msInRange(t, from, to, now) > 0,
  );
}

/**
 * @returns {{
 *   date: string, totalTasks: number, completedTasks: number,
 *   hoursWorked: number, estimatedHours: number, productivityScore: number,
 *   efficiency: number|null, goalHours: number, goalProgress: number,
 *   goalReached: boolean, perTask: Array
 * }}
 */
export function computeDailyReport(tasks, key, { goalHours = 6, now = Date.now() } = {}) {
  const [from, to] = dayBounds(key);
  const dayTasks = tasksForDay(tasks, key, now);
  const done = dayTasks.filter((t) => t.completed);

  let workedMs = 0;
  for (const t of visibleTasks(tasks)) workedMs += msInRange(t, from, to, now);

  // Efficiency compares estimates with actual time for finished tasks only:
  // 100% = exactly on estimate, >100% = faster than planned.
  let estDone = 0;
  let actualDone = 0;
  for (const t of done) {
    const actual = elapsedMs(t, now);
    if (actual > 0 && estimateMs(t) > 0) {
      estDone += estimateMs(t);
      actualDone += actual;
    }
  }

  const hoursWorked = workedMs / MS_HOUR;
  const report = {
    date: key,
    totalTasks: dayTasks.length,
    completedTasks: done.length,
    hoursWorked,
    estimatedHours: dayTasks.reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), 0),
    productivityScore: dayTasks.length ? Math.round((done.length / dayTasks.length) * 100) : 0,
    efficiency: actualDone ? Math.round((estDone / actualDone) * 100) : null,
    goalHours,
    goalProgress: goalHours > 0 ? Math.min(1, hoursWorked / goalHours) : 0,
    goalReached: goalHours > 0 && hoursWorked >= goalHours,
    perTask: dayTasks
      .map((t) => ({
        id: t.id,
        title: t.title,
        completed: Boolean(t.completed),
        estimatedHours: Number(t.estimatedHours) || 0,
        actualHours: elapsedMs(t, now) / MS_HOUR,
        todayHours: msInRange(t, from, to, now) / MS_HOUR,
      }))
      .sort((a, b) => b.actualHours - a.actualHours),
  };
  return report;
}

export function reportWithMessage(report, seed) {
  return { ...report, message: pickMessage(report, seed ?? report.date) };
}

/** Compact version of a report that is stored in Firestore for history. */
export function summaryDoc(report, now = Date.now()) {
  return {
    date: report.date,
    totalTasks: report.totalTasks,
    completedTasks: report.completedTasks,
    hoursWorked: Math.round(report.hoursWorked * 100) / 100,
    estimatedHours: Math.round(report.estimatedHours * 100) / 100,
    productivityScore: report.productivityScore,
    efficiency: report.efficiency,
    goalHours: report.goalHours,
    goalReached: report.goalReached,
    updatedAt: now,
  };
}

export function scoreLabel(score) {
  if (score >= 90) return 'Outstanding';
  if (score >= 70) return 'Great';
  if (score >= 40) return 'Steady';
  if (score > 0) return 'Warming up';
  return 'Just starting';
}

export function efficiencyLabel(eff) {
  if (eff == null) return 'No finished tasks with tracked time yet';
  if (eff >= 110) return 'Faster than estimated';
  if (eff >= 90) return 'Right on estimate';
  return 'Taking longer than estimated';
}
