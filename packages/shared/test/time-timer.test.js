import { describe, it, expect } from 'vitest';
import { dateKey, dayBounds, shiftDateKey, formatHM, clockParts, formatDuration, MS_HOUR, MS_MINUTE } from '../src/time.js';
import * as timer from '../src/timer.js';

describe('time helpers', () => {
  it('builds local day keys and bounds', () => {
    const ts = new Date(2026, 8, 26, 15, 30).getTime();
    expect(dateKey(ts)).toBe('2026-09-26');
    const [start, end] = dayBounds('2026-09-26');
    expect(start).toBe(new Date(2026, 8, 26).getTime());
    expect(end).toBe(new Date(2026, 8, 27).getTime());
    expect(shiftDateKey('2026-09-01', -1)).toBe('2026-08-31');
  });

  it('formats durations', () => {
    expect(formatHM(65 * MS_MINUTE)).toBe('1:05');
    expect(formatHM(-30 * MS_MINUTE)).toBe('-0:30');
    expect(clockParts(3723000)).toEqual({ h: '01', m: '02', s: '03' });
    expect(formatDuration(135 * MS_MINUTE)).toBe('2h 15m');
    expect(formatDuration(0)).toBe('0m');
  });
});

describe('timer', () => {
  const base = { id: 'a', title: 'A', estimatedHours: 2, sessions: [], runningSince: null };

  it('starts, pauses and accumulates time', () => {
    let t = timer.start(base, 1000);
    expect(timer.isRunning(t)).toBe(true);
    expect(timer.elapsedMs(t, 61000)).toBe(60000);
    t = timer.pause(t, 61000);
    expect(timer.isRunning(t)).toBe(false);
    expect(t.sessions).toEqual([{ start: 1000, end: 61000 }]);
    t = timer.pause(timer.start(t, 100000), 160000);
    expect(timer.elapsedMs(t, 999999)).toBe(120000);
  });

  it('does not start completed tasks', () => {
    const t = timer.start({ ...base, completed: true }, 5);
    expect(timer.isRunning(t)).toBe(false);
  });

  it('computes remaining time and progress', () => {
    const t = timer.start(base, 0);
    expect(timer.remainingMs(t, MS_HOUR)).toBe(MS_HOUR);
    expect(timer.progress(t, MS_HOUR)).toBe(0.5);
    expect(timer.remainingMs(t, 3 * MS_HOUR)).toBe(-MS_HOUR);
  });

  it('splits time across midnight', () => {
    const [start, end] = dayBounds('2026-09-26');
    const t = { ...base, sessions: [{ start: end - MS_HOUR, end: end + 2 * MS_HOUR }] };
    expect(timer.msInRange(t, start, end)).toBe(MS_HOUR);
    const [s2, e2] = dayBounds('2026-09-27');
    expect(timer.msInRange(t, s2, e2)).toBe(2 * MS_HOUR);
  });

  it('compacts long session histories without losing time', () => {
    let t = base;
    for (let i = 0; i < 250; i++) t = timer.pause(timer.start(t, i * 10), i * 10 + 5);
    expect(t.sessions.length).toBeLessThanOrEqual(200);
    expect(timer.elapsedMs(t)).toBe(250 * 5);
  });

  it('uses a 1 hour warning for long tasks and a proportional one for short tasks', () => {
    expect(timer.warningThresholdMs({ estimatedHours: 3 })).toBe(MS_HOUR);
    expect(timer.warningThresholdMs({ estimatedHours: 1 })).toBe(15 * MS_MINUTE);
    expect(timer.warningThresholdMs({ estimatedHours: 0.1 })).toBe(5 * MS_MINUTE);
  });
});
