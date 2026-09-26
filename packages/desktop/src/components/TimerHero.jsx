import { Pause, Play, Check, RotateCcw } from 'lucide-react';
import { activeTimer, clockParts, formatDuration, formatHM, useNow } from '@lifetracker/shared';
import { useStore } from '../config.js';
import { ProgressBar } from './ui.jsx';

/**
 * The running (or last worked-on) task as big floating type. The particle
 * clock itself is the full-screen <Scene> behind the page.
 */
export default function TimerHero() {
  const now = useNow(1000);
  const tasks = useStore((s) => s.tasks);
  const today = useStore((s) => s.today);
  const { toggleTimer, toggleComplete, resetTimer, startTimer } = useStore.getState();
  const { task, running, elapsed, est, remaining, over, warn, nextUp } = activeTimer(tasks, today, now);
  const { h, m, s } = clockParts(elapsed);
  const shadow = { textShadow: '0 0 30px rgba(7,5,13,.85)' };

  if (!task) {
    return (
      <section className="min-h-[300px] max-w-xl">
        <p className="caps text-slate-400">
          <span className="mr-2 text-[var(--accent)]">{'//00'}</span>Timer / idle
        </p>
        <h2 className="font-display mt-4 text-7xl leading-[0.9]" style={shadow}>
          Ready<br />when you are
        </h2>
        <p className="mt-6 max-w-sm text-slate-400" style={shadow}>
          {nextUp ? <>Next up: <span className="text-slate-100">{nextUp.title}</span></> : 'Add a task below and press play to start tracking.'}
        </p>
        {nextUp && (
          <button className="btn-primary mt-8" onClick={() => startTimer(nextUp.id)}>
            <Play className="h-3.5 w-3.5" /> Start next task
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="max-w-xl">
      <div className="flex items-center gap-3">
        <p className="caps text-slate-400">
          <span className="mr-2 text-[var(--accent)]">{running ? '//01' : '//00'}</span>
          {running ? 'Now tracking' : 'Paused'}
        </p>
        {running && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />}
      </div>
      <div className="mt-4 truncate text-xl text-slate-100" title={task.title} style={shadow}>
        {task.title}
      </div>
      <div className="font-display flex items-baseline tabular" aria-live="off" style={shadow}>
        <span className="text-[150px] leading-[1]">{h}:{m}</span>
        <span className="ml-4 text-5xl text-slate-500">{s}</span>
      </div>
      <div className="mt-2 max-w-md">
        <ProgressBar value={est ? elapsed / est : 0} over={over} />
        <div className="caps mt-3 flex justify-between tabular">
          <span className="text-slate-500">Estimate {est ? formatDuration(est) : '—'}</span>
          {est > 0 && <span className={over || warn ? 'text-[var(--accent)]' : 'text-slate-400'}>{over ? `${formatHM(-remaining)} over` : `${formatHM(remaining)} left`}</span>}
        </div>
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button onClick={() => toggleTimer(task.id)} className={running ? 'btn-outline' : 'btn-primary'} aria-label={running ? 'Pause timer' : 'Resume timer'}>
          {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {running ? 'Pause' : 'Resume'}
        </button>
        <button className="btn-outline" onClick={() => toggleComplete(task.id)}>
          <Check className="h-3.5 w-3.5" /> Complete
        </button>
        <button className="btn-ghost" onClick={() => window.confirm('Reset tracked time for this task?') && resetTimer(task.id)}>
          <RotateCcw className="h-3 w-3" /> Reset
        </button>
      </div>
    </section>
  );
}
