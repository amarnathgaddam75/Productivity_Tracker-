import { describe, it, expect } from 'vitest';
import { activeTimer, sceneOrbState } from '../src/scene.js';
import { MS_HOUR } from '../src/time.js';

const today = '2026-09-26';
const now = 10 * MS_HOUR;

describe('scene', () => {
  it('prefers the running task and flags warnings/overtime', () => {
    const tasks = {
      a: { id: 'a', title: 'A', estimatedHours: 2, date: today, sessions: [], runningSince: now - 1.5 * MS_HOUR },
      b: { id: 'b', title: 'B', estimatedHours: 1, date: today, sessions: [], createdAt: 1 },
    };
    const info = activeTimer(tasks, today, now);
    expect(info.task.id).toBe('a');
    expect(info.running).toBe(true);
    expect(info.warn).toBe(true);
    expect(info.nextUp.id).toBe('b');
    expect(sceneOrbState('tasks', info)).toMatchObject({ shape: 'ring', color: '#fbbf24' });
    const over = activeTimer({ a: { ...tasks.a, runningSince: now - 3 * MS_HOUR } }, today, now);
    expect(over.over).toBe(true);
    expect(sceneOrbState('tasks', over).color).toBe('#fb7185');
  });

  it('maps idle and other views to calm shapes', () => {
    const idle = activeTimer({}, today, now);
    expect(idle.task).toBe(null);
    expect(sceneOrbState('tasks', idle).shape).toBe('cube');
    expect(sceneOrbState('reports', idle).shape).toBe('galaxy');
    expect(sceneOrbState('settings', idle).shape).toBe('twin');
  });
});
