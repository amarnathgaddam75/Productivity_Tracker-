import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Check, RotateCcw } from 'lucide-react';
import { timer, clockParts, formatDuration, formatHM, useNow, visibleTasks, sortTasks, timerOrbState } from '@lifetracker/shared';
import { useStore } from '../config.js';
import { Orb, ProgressBar } from './ui.jsx';

/** Prominent timer for the running task (or the most recently worked-on one). */
export default function TimerHero() {
  const now = useNow(1000);
  const tasks = useStore((s) => s.tasks);
  const today = useStore((s) => s.today);
  const { toggleTimer, toggleComplete, resetTimer, startTimer } = useStore.getState();
  const [burst, setBurst] = useState(0);

  const list = visibleTasks(tasks);
  const running = list.find(timer.isRunning);
  const lastWorked = list
    .filter((t) => !t.completed && t.sessions?.length)
    .sort((a, b) => (b.sessions.at(-1)?.end || 0) - (a.sessions.at(-1)?.end || 0))[0];
  const nextUp = sortTasks(list.filter((t) => !t.completed && t.date === today))[0];
  const task = running || lastWorked;

  const isRunning = timer.isRunning(task);
  const elapsed = task ? timer.elapsedMs(task, now) : 0;
  const est = task ? timer.estimateMs(task) : 0;
  const remaining = est - elapsed;
  const over = est > 0 && remaining < 0;
  const warn = est > 0 && !over && remaining <= timer.warningThresholdMs(task);
  const orbState = timerOrbState({ running: isRunning, warn, over, hasTask: Boolean(task) });

  // Kick the particles when the tracked task gets completed.
  const lastDone = useRef(null);
  useEffect(() => {
    const done = list.filter((t) => t.completed).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))[0];
    if (done && lastDone.current && done.completedAt !== lastDone.current) setBurst((n) => n + 1);
    lastDone.current = done?.completedAt || lastDone.current || 0;
  }, [list]);

  const accent = over ? 'text-rose-300' : warn ? 'text-amber-300' : 'text-brand-300';
  const { h, m, s } = clockParts(elapsed);

  return (
    <div className="card relative overflow-hidden">
      <Orb state={orbState} burstKey={burst} scale={0.78} className="absolute inset-y-0 right-0 w-[46%]" />
      <div className="relative z-10 flex min-h-[340px] flex-col justify-between p-8 pr-[42%]">
        {!task ? (
          <>
            <p className="caps text-slate-400">
              <span className="mr-2 text-brand-300">{'//00'}</span>Timer / idle
            </p>
            <div>
              <h2 className="font-display text-6xl leading-[0.9]">Ready<br />when you are</h2>
              <p className="mt-5 max-w-sm text-sm text-slate-400">
                {nextUp ? <>Next up: <span className="text-slate-100">{nextUp.title}</span></> : 'Add a task below and press play to start tracking.'}
              </p>
            </div>
            <div>
              {nextUp && (
                <button className="btn-primary" onClick={() => startTimer(nextUp.id)}>
                  <Play className="h-3.5 w-3.5" /> Start {nextUp.title.length > 24 ? 'next task' : nextUp.title}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <p className="caps text-slate-400">
                <span className={`mr-2 ${accent}`}>{'//'}{isRunning ? '01' : '00'}</span>
                {isRunning ? 'Now tracking' : 'Paused'}
              </p>
              {isRunning && <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${over ? 'bg-rose-400' : warn ? 'bg-amber-300' : 'bg-brand-300'}`} />}
            </div>

            <div className="mt-6">
              <div className="truncate text-lg text-slate-200" title={task.title}>{task.title}</div>
              <div className="font-display mt-2 flex items-baseline tabular" aria-live="off">
                <span className="text-[112px] leading-none">{h}:{m}</span>
                <span className="ml-3 text-4xl text-slate-500">{s}</span>
              </div>
              <div className="mt-6 max-w-md">
                <ProgressBar value={est ? elapsed / est : 0} over={over} />
                <div className="caps mt-3 flex justify-between tabular">
                  <span className="text-slate-500">Estimate {est ? formatDuration(est) : '—'}</span>
                  {est > 0 && <span className={over || warn ? accent : 'text-slate-400'}>{over ? `${formatHM(-remaining)} over` : `${formatHM(remaining)} left`}</span>}
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button onClick={() => toggleTimer(task.id)} className={isRunning ? 'btn-outline' : 'btn-primary'} aria-label={isRunning ? 'Pause timer' : 'Resume timer'}>
                {isRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {isRunning ? 'Pause' : 'Resume'}
              </button>
              <button className="btn-outline" onClick={() => toggleComplete(task.id)}>
                <Check className="h-3.5 w-3.5" /> Complete
              </button>
              <button className="btn-ghost" onClick={() => window.confirm('Reset tracked time for this task?') && resetTimer(task.id)}>
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
