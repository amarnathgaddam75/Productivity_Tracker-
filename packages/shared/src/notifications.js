// Rule engine for in-app notifications. Pure: given the current state it
// returns the notifications that should fire now; `seen` (a Set of dedupe
// keys, reset daily) guarantees each one fires only once.

import { MS_MINUTE, formatDuration } from './time.js';
import { isRunning, remainingMs, warningThresholdMs, estimateMs, elapsedMs } from './timer.js';

const RECENT_COMPLETION_MS = 10 * MS_MINUTE;

export function evaluateNotifications({ tasks, report, settings, now = Date.now(), seen }) {
  const out = [];
  const fire = (key, n) => {
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ key, ...n });
  };

  for (const t of Object.values(tasks || {})) {
    if (!t || t.deleted) continue;

    if (t.completed && t.completedAt && now - t.completedAt < RECENT_COMPLETION_MS) {
      fire(`done:${t.id}:${t.completedAt}`, {
        kind: 'completed',
        title: 'Task completed ✓',
        body: `“${t.title}” is done in ${formatDuration(elapsedMs(t, now))}.`,
      });
    }

    if (!t.completed && isRunning(t) && estimateMs(t) > 0) {
      const left = remainingMs(t, now);
      if (left <= 0) {
        fire(`over:${t.id}`, {
          kind: 'overtime',
          title: 'Estimate reached ⏰',
          body: `“${t.title}” has used its ${formatDuration(estimateMs(t))} estimate.`,
        });
      } else if (left <= warningThresholdMs(t)) {
        fire(`warn:${t.id}`, {
          kind: 'warning',
          title: `${formatDuration(left)} remaining`,
          body: `“${t.title}” is close to its estimated time.`,
        });
      }
    }
  }

  if (report) {
    if (report.goalReached) {
      fire('goal', {
        kind: 'goal',
        title: 'Daily goal reached! 🎉',
        body: `You worked ${formatDuration(report.hoursWorked * 60 * MS_MINUTE)} today. Amazing effort!`,
      });
    }
    if (report.totalTasks > 0 && report.completedTasks === report.totalTasks) {
      fire('alldone', {
        kind: 'goal',
        title: 'All tasks complete! 🏆',
        body: `You finished all ${report.totalTasks} task${report.totalTasks === 1 ? '' : 's'} planned for today.`,
      });
    }
    const hour = new Date(now).getHours();
    if (hour >= (settings?.summaryHour ?? 18) && (report.totalTasks > 0 || report.hoursWorked > 0)) {
      fire('summary', {
        kind: 'summary',
        title: 'Daily summary',
        body:
          `${report.completedTasks}/${report.totalTasks} tasks done · ` +
          `${formatDuration(report.hoursWorked * 60 * MS_MINUTE)} worked · ` +
          `score ${report.productivityScore}%` +
          (report.efficiency != null ? ` · efficiency ${report.efficiency}%` : ''),
      });
    }
  }
  return out;
}
