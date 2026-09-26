import { Pause, Play, Check, RotateCcw, Timer as TimerIcon } from 'lucide-react';
import { timer, clockParts, formatDuration, formatHM, useNow, visibleTasks, sortTasks } from '@lifetracker/shared';
import { useStore } from '../config.js';
import { ProgressBar } from './ui.jsx';

/** Prominent timer for the running task (or the most recently worked-on one). */
export default function TimerHero() {
  const now = useNow(1000);
  const tasks = useStore((s) => s.tasks);
  const today = useStore((s) => s.today);
  const { toggleTimer, toggleComplete, resetTimer, startTimer } = useStore.getState();

  const list = visibleTasks(tasks);
  const running = list.find(timer.isRunning);
  const lastWorked = list
    .filter((t) => !t.completed && t.sessions?.length)
    .sort((a, b) => (b.sessions.at(-1)?.end || 0) - (a.sessions.at(-1)?.end || 0))[0];
  const nextUp = sortTasks(list.filter((t) => !t.completed && t.date === today))[0];
  const task = running || lastWorked;

  if (!task) {
    return (
      <div className="card flex items-center justify-between gap-6 bg-gradient-to-br from-white to-brand-50/60 p-8 dark:from-slate-900 dark:to-brand-950/40">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
            <TimerIcon className="h-7 w-7" />
          </span>
          <div>
            <div className="text-lg font-semibold">No timer running</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {nextUp ? <>Next up: <span className="font-medium text-slate-700 dark:text-slate-200">{nextUp.title}</span></> : 'Add a task below and press play to start tracking.'}
            </div>
          </div>
        </div>
        {nextUp && (
          <button className="btn-primary px-5 py-3 text-base" onClick={() => startTimer(nextUp.id)}>
            <Play className="h-5 w-5" /> Start
          </button>
        )}
      </div>
    );
  }

  const isRunning = timer.isRunning(task);
  const elapsed = timer.elapsedMs(task, now);
  const est = timer.estimateMs(task);
  const remaining = est - elapsed;
  const over = est > 0 && remaining < 0;
  const warn = est > 0 && !over && remaining <= timer.warningThresholdMs(task);
  const { h, m, s } = clockParts(elapsed);

  return (
    <div
      className={`card relative overflow-hidden p-8 transition ${
        isRunning ? 'border-brand-300 bg-gradient-to-br from-white via-white to-brand-50 dark:border-brand-500/40 dark:from-slate-900 dark:via-slate-900 dark:to-brand-950/50' : ''
      }`}
    >
      {isRunning && <span className="absolute right-6 top-6 flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" /></span>}
      <div className="flex flex-wrap items-center justify-between gap-8">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {isRunning ? 'Now tracking' : 'Paused'}
          </div>
          <div className="mt-1 truncate text-xl font-semibold" title={task.title}>{task.title}</div>
          <div className="mt-4 flex items-baseline font-mono tabular" aria-live="off">
            <span className="text-7xl font-semibold tracking-tight">{h}:{m}</span>
            <span className="ml-2 text-3xl text-slate-400">{s}</span>
          </div>
          <div className="mt-4 max-w-lg">
            <ProgressBar value={est ? elapsed / est : 0} over={over} />
            <div className="mt-2 flex justify-between text-sm tabular">
              <span className="text-slate-500 dark:text-slate-400">Estimate {est ? formatDuration(est) : '—'}</span>
              {est > 0 && (
                <span className={over ? 'font-medium text-rose-600 dark:text-rose-400' : warn ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}>
                  {over ? `${formatHM(-remaining)} over estimate` : `${formatHM(remaining)} remaining`}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => toggleTimer(task.id)}
            className={`flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg transition active:scale-95 ${
              isRunning ? 'bg-amber-500 shadow-amber-500/30 hover:bg-amber-400' : 'bg-brand-600 shadow-brand-500/30 hover:bg-brand-500'
            }`}
            aria-label={isRunning ? 'Pause timer' : 'Resume timer'}
          >
            {isRunning ? <Pause className="h-9 w-9" /> : <Play className="ml-1 h-9 w-9" />}
          </button>
          <div className="flex flex-col gap-2">
            <button className="btn-outline" onClick={() => toggleComplete(task.id)}>
              <Check className="h-4 w-4" /> Complete
            </button>
            <button
              className="btn-ghost text-xs"
              onClick={() => window.confirm('Reset tracked time for this task?') && resetTimer(task.id)}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
