import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTrackerStore } from '../src/store.js';
import { dateKey, shiftDateKey, MS_HOUR } from '../src/time.js';
import { elapsedMs } from '../src/timer.js';

function setup() {
  const writes = [];
  const delivered = [];
  const useStore = createTrackerStore({ deliver: (n) => delivered.push(n) });
  const adapter = { write: async (path, data) => { writes.push({ path, data }); return 'written'; } };
  useStore.getState().startSession({ uid: `u${Math.random()}`, email: 'a@b.c' }, { adapter, subscribe: false });
  return { useStore, writes, delivered, s: () => useStore.getState() };
}

describe('tracker store', () => {
  beforeEach(() => vi.useRealTimers());

  it('adds, edits, completes and deletes tasks (optimistic + queued)', async () => {
    const { s, writes } = setup();
    const t = s().addTask({ title: '  Write report ', estimatedHours: 2 });
    expect(s().tasks[t.id].title).toBe('Write report');
    expect(s().tasks[t.id].date).toBe(dateKey());
    s().updateTask(t.id, { title: 'Write final report', estimatedHours: '3' });
    expect(s().tasks[t.id].estimatedHours).toBe(3);
    s().toggleComplete(t.id);
    expect(s().tasks[t.id].completed).toBe(true);
    s().deleteTask(t.id);
    expect(s().tasks[t.id].deleted).toBe(true);
    await s().syncNow();
    expect(writes.at(-1).path).toBe(`tasks/${t.id}`);
    expect(writes.at(-1).data.deleted).toBe(true);
    expect(s().sync.pending).toBe(0);
  });

  it('runs one timer at a time and pauses on completion', () => {
    const { s } = setup();
    const a = s().addTask({ title: 'A', estimatedHours: 1 });
    const b = s().addTask({ title: 'B', estimatedHours: 1 });
    s().startTimer(a.id);
    expect(s().tasks[a.id].runningSince).toBeTruthy();
    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 60000 });
    s().startTimer(b.id);
    expect(s().tasks[a.id].runningSince).toBeNull();
    expect(s().tasks[b.id].runningSince).toBeTruthy();
    vi.setSystemTime(Date.now() + 60000);
    s().toggleComplete(b.id);
    expect(s().tasks[b.id].runningSince).toBeNull();
    expect(s().tasks[b.id].sessions.length).toBe(1);
  });

  it('auto-starts the next task when enabled', () => {
    const { s } = setup();
    s().updateSettings({ autoStartNext: true });
    const a = s().addTask({ title: 'A', estimatedHours: 1 });
    const b = s().addTask({ title: 'B', estimatedHours: 1 });
    s().startTimer(a.id);
    s().toggleComplete(a.id);
    expect(s().tasks[b.id].runningSince).toBeTruthy();
  });

  it('fires completion, warning and goal notifications once', () => {
    const { s, delivered } = setup();
    s().updateSettings({ dailyGoalHours: 1, summaryHour: 24 });
    const a = s().addTask({ title: 'Long', estimatedHours: 2 });
    const now = Date.now();
    // Simulate 1.5h of tracked time on a running task (remaining 30m < 1h).
    useTaskPatch(s, a.id, { runningSince: now - 1.5 * MS_HOUR });
    s().tick(now);
    s().tick(now + 1000);
    const kinds = delivered.map((n) => n.kind);
    expect(kinds.filter((k) => k === 'warning')).toHaveLength(1);
    expect(kinds).toContain('goal');
    s().toggleComplete(a.id);
    expect(delivered.map((n) => n.kind)).toContain('completed');
    expect(s().notifications.length).toBe(delivered.length);
    s().markAllRead();
    expect(s().notifications.every((n) => n.read)).toBe(true);
  });

  it('carries unfinished tasks over at midnight', () => {
    const { s, useStore } = setup();
    const yesterday = shiftDateKey(dateKey(), -1);
    const a = s().addTask({ title: 'Unfinished', estimatedHours: 1, date: yesterday });
    const b = s().addTask({ title: 'Done', estimatedHours: 1, date: yesterday });
    s().toggleComplete(b.id);
    // Pretend the app has been open since yesterday; the next tick crosses midnight.
    useStore.setState({ today: yesterday });
    s().tick(Date.now());
    expect(s().today).toBe(dateKey());
    expect(s().tasks[a.id].date).toBe(dateKey());
    expect(s().tasks[b.id].date).toBe(yesterday);
    expect(s().summaries[yesterday].completedTasks).toBe(1);
  });

  it('rolls over on session start', () => {
    const { s, useStore } = setup();
    const a = s().addTask({ title: 'Old', estimatedHours: 1, date: shiftDateKey(dateKey(), -1) });
    const user = s().user;
    useStore.setState({ status: 'loading' });
    s().startSession(user, { adapter: { write: async () => 'written' }, subscribe: false });
    expect(s().tasks[a.id].date).toBe(dateKey());
    expect(s().tasks[a.id].carriedFrom).toBe(shiftDateKey(dateKey(), -1));
  });

});

function useTaskPatch(s, id, patch) {
  s().updateTask(id, patch);
}
