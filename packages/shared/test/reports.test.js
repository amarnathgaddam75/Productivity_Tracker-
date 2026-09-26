import { describe, it, expect } from 'vitest';
import { computeDailyReport, reportWithMessage } from '../src/reports.js';
import { dayBounds, MS_HOUR } from '../src/time.js';
import { MESSAGES } from '../src/messages.js';

const [dayStart] = dayBounds('2026-09-26');
const at = (h) => dayStart + h * MS_HOUR;

describe('daily report', () => {
  const tasks = {
    a: { id: 'a', title: 'Write', estimatedHours: 2, date: '2026-09-26', completed: true, completedAt: at(11), sessions: [{ start: at(9), end: at(10) }] },
    b: { id: 'b', title: 'Review', estimatedHours: 1, date: '2026-09-26', completed: true, completedAt: at(13), sessions: [{ start: at(11), end: at(13) }] },
    c: { id: 'c', title: 'Plan', estimatedHours: 1, date: '2026-09-26', completed: false, sessions: [] },
    d: { id: 'd', title: 'Deleted', estimatedHours: 1, date: '2026-09-26', deleted: true, sessions: [{ start: at(14), end: at(15) }] },
    e: { id: 'e', title: 'Other day', estimatedHours: 1, date: '2026-09-25', sessions: [] },
  };

  it('counts tasks, hours, score and efficiency', () => {
    const r = computeDailyReport(tasks, '2026-09-26', { goalHours: 3, now: at(16) });
    expect(r.totalTasks).toBe(3);
    expect(r.completedTasks).toBe(2);
    expect(r.hoursWorked).toBe(3);
    expect(r.productivityScore).toBe(67);
    // estimated 3h for finished tasks, actual 3h => 100%
    expect(r.efficiency).toBe(100);
    expect(r.goalReached).toBe(true);
    expect(r.goalProgress).toBe(1);
  });

  it('includes running time and has null efficiency with nothing finished', () => {
    const r = computeDailyReport(
      { x: { id: 'x', title: 'X', estimatedHours: 1, date: '2026-09-26', sessions: [], runningSince: at(9) } },
      '2026-09-26',
      { now: at(9.5) },
    );
    expect(r.hoursWorked).toBe(0.5);
    expect(r.efficiency).toBe(null);
    expect(r.productivityScore).toBe(0);
  });

  it('attaches a stable motivational message', () => {
    const r = reportWithMessage(computeDailyReport(tasks, '2026-09-26', { now: at(16) }));
    expect(MESSAGES.progress).toContain(r.message.text);
    expect(reportWithMessage(r).message.text).toBe(r.message.text);
    const empty = reportWithMessage(computeDailyReport({}, '2026-09-26'));
    expect(empty.message.category).toBe('start');
  });
});
