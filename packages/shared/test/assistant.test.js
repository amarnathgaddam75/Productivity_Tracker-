import { describe, it, expect, vi } from 'vitest';
import { buildBriefing, parseCommand, runCommand, remainingPlan, Coach, isDistraction, findTask } from '../src/assistant.js';
import { createTrackerStore } from '../src/store.js';
import { dateKey, MS_HOUR, MS_MINUTE } from '../src/time.js';

const day = (h, m = 0) => new Date(2026, 8, 26, h, m).getTime();
const today = '2026-09-26';
const settings = { dailyGoalHours: 6, workStartHour: 9, workEndHour: 18 };
const task = (id, title, hours, extra = {}) => ({ id, title, estimatedHours: hours, date: today, completed: false, sessions: [], runningSince: null, createdAt: extra.createdAt ?? id.charCodeAt(0), ...extra });

describe('briefing', () => {
  it('projects the finish time and status from the remaining plan', () => {
    const tasks = {
      a: task('a', 'Write report', 2, { runningSince: day(14) }),
      b: task('b', 'Review PRs', 1),
      c: task('c', 'Gym', 1, { completed: true, completedAt: day(12), sessions: [{ start: day(11), end: day(12) }] }),
    };
    const now = day(14, 30);
    const plan = remainingPlan(tasks, today, now);
    expect(plan.map((p) => p.task.id)).toEqual(['a', 'b']);
    expect(plan[0].remainingMs).toBe(1.5 * MS_HOUR);
    const b = buildBriefing({ tasks, today, settings, now, name: 'Advith' });
    expect(b.remainingMs).toBe(2.5 * MS_HOUR);
    expect(b.finishAt).toBe(day(17));
    expect(b.status).toBe('ahead'); // finishes 5 PM, an hour before the 6 PM wrap-up
    expect(b.headline).toBe('2 tasks left · 2h 30m of work');
    expect(b.lines[0]).toContain('Right now: “Write report”');
    expect(b.speech).toContain('Good afternoon, Advith');
  });

  it('flags behind, done and idle days', () => {
    const late = buildBriefing({ tasks: { a: task('a', 'Big', 5) }, today, settings, now: day(15) });
    expect(late.status).toBe('behind');
    const done = buildBriefing({ tasks: { a: task('a', 'X', 1, { completed: true, completedAt: day(10) }) }, today, settings, now: day(15) });
    expect(done.status).toBe('done');
    expect(buildBriefing({ tasks: {}, today, settings, now: day(10) }).status).toBe('idle');
  });
});

describe('commands', () => {
  it('parses natural short commands', () => {
    expect(parseCommand('add write report 2h')).toEqual({ type: 'add', title: 'write report', estimatedHours: 2 });
    expect(parseCommand('new gym for 45 min')).toEqual({ type: 'add', title: 'gym', estimatedHours: 0.75 });
    expect(parseCommand('start report')).toEqual({ type: 'start', query: 'report' });
    expect(parseCommand('pause').type).toBe('pause');
    expect(parseCommand('done').type).toBe('done');
    expect(parseCommand("what's left").type).toBe('left');
    expect(parseCommand('where am i').type).toBe('status');
    expect(parseCommand('give me the report').type).toBe('report');
    expect(parseCommand('dance').type).toBe('unknown');
  });

  it('fuzzy-matches task titles', () => {
    const tasks = { a: task('a', 'Write weekly report', 1), b: task('b', 'Review pull requests', 1) };
    expect(findTask(tasks, 'report').id).toBe('a');
    expect(findTask(tasks, 'pull req').id).toBe('b');
    expect(findTask(tasks, 'zebra')).toBe(null);
  });

  it('runs commands against the store', () => {
    const useStore = createTrackerStore();
    useStore.getState().startSession({ uid: `a${Math.random()}` }, { adapter: { write: async () => 'written' }, subscribe: false });
    let r = runCommand('add Write report 2h', useStore);
    expect(r.ok).toBe(true);
    expect(Object.values(useStore.getState().tasks)[0].estimatedHours).toBe(2);
    r = runCommand('start report', useStore);
    expect(r.reply).toContain('Started “Write report”');
    expect(runCommand('status', useStore).reply).toContain('1 task left');
    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 60000 });
    r = runCommand('done', useStore);
    vi.useRealTimers();
    expect(r.reply).toContain('is done');
    expect(runCommand("what's left", useStore).reply).toContain('Nothing left');
    expect(runCommand('blah', useStore).ok).toBe(false);
  });
});

describe('coach', () => {
  const base = { today, settings: { ...settings, nudgeUntrackedMinutes: 15, idlePauseMinutes: 10, checkinMinutes: 60 } };

  it('briefs once in the morning', () => {
    const c = new Coach();
    const first = c.tick({ ...base, tasks: { a: task('a', 'Plan', 1) }, activity: { app: 'Code', idleSec: 0 }, now: day(9, 5) });
    expect(first.map((n) => n.kind)).toContain('briefing');
    const again = c.tick({ ...base, tasks: {}, activity: { app: 'Code', idleSec: 0 }, now: day(9, 6) });
    expect(again.map((n) => n.kind)).not.toContain('briefing');
  });

  it('nudges when working without a timer', () => {
    const c = new Coach({ briefed: today });
    const tasks = { a: task('a', 'Write report', 1) };
    expect(c.tick({ ...base, tasks, activity: { app: 'Code', idleSec: 0 }, now: day(10) })).toHaveLength(0);
    const n = c.tick({ ...base, tasks, activity: { app: 'Code', idleSec: 0 }, now: day(10, 16) });
    expect(n[0].title).toBe('No timer running');
    expect(n[0].actions[0].command).toBe('start Write report');
  });

  it('auto-pauses when idle and welcomes you back', () => {
    const c = new Coach({ briefed: today, lastCheckin: day(23) });
    const tasks = { a: task('a', 'Write report', 2, { runningSince: day(10) }) };
    const idle = c.tick({ ...base, tasks, activity: { app: 'Code', idleSec: 11 * 60 }, now: day(10, 30) });
    const pause = idle.find((n) => n.kind === 'idle-pause');
    expect(pause.taskId).toBe('a');
    expect(pause.pauseAt).toBe(day(10, 19));
    const back = c.tick({ ...base, tasks: { a: { ...tasks.a, runningSince: null } }, activity: { app: 'Code', idleSec: 2 }, now: day(10, 45) });
    expect(back[0].title).toContain('Welcome back');
  });

  it('calls out distractions after 5 minutes', () => {
    expect(isDistraction({ app: 'Firefox', title: 'Funny cats - YouTube' })).toBe('youtube');
    const c = new Coach({ briefed: today, lastCheckin: day(23) });
    const tasks = { a: task('a', 'Write report', 2, { runningSince: day(10) }) };
    const yt = { app: 'Chrome', title: 'YouTube', idleSec: 0 };
    expect(c.tick({ ...base, tasks, activity: yt, now: day(10, 10) })).toHaveLength(0);
    const n = c.tick({ ...base, tasks, activity: yt, now: day(10, 16) });
    expect(n.find((x) => x.kind === 'distraction').title).toBe('Youtube for 6m');
  });

  it('wraps up the day once', () => {
    const c = new Coach({ briefed: today });
    const n = c.tick({ ...base, tasks: { a: task('a', 'X', 1) }, activity: null, now: day(18, 5) });
    expect(n.find((x) => x.kind === 'report').title).toBe('End of day report');
    expect(c.tick({ ...base, tasks: {}, activity: null, now: day(18, 10) }).find((x) => x.kind === 'report')).toBeUndefined();
  });
});

describe('store extras', () => {
  it('pauses at a past moment', () => {
    const useStore = createTrackerStore();
    useStore.getState().startSession({ uid: `p${Math.random()}` }, { adapter: { write: async () => 'written' }, subscribe: false });
    const t = useStore.getState().addTask({ title: 'X', estimatedHours: 1, date: dateKey() });
    useStore.getState().updateTask(t.id, { runningSince: Date.now() - 30 * MS_MINUTE });
    useStore.getState().pauseTimerAt(t.id, Date.now() - 20 * MS_MINUTE);
    const s = useStore.getState().tasks[t.id].sessions[0];
    expect(Math.round((s.end - s.start) / MS_MINUTE)).toBe(10);
  });
});
