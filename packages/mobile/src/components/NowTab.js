import { useMemo, useState } from 'react';
import { Pause, Play, Check, Plus, Timer as TimerIcon } from 'lucide-react';
import { timer, clockParts, formatHM, formatDuration, useNow, visibleTasks, sortTasks } from '@lifetracker/shared';
import { useStore } from '../config';

function TimerCard({ task, nextUp, now }) {
  const { toggleTimer, toggleComplete, startTimer } = useStore.getState();

  if (!task) {
    return (
      <div className="card flex flex-col items-center p-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-300"><TimerIcon className="h-7 w-7" /></span>
        <div className="mt-3 font-semibold">No timer running</div>
        <div className="mt-1 text-sm text-slate-500">{nextUp ? `Next up: ${nextUp.title}` : 'Add a task below to get started.'}</div>
        {nextUp && (
          <button className="btn-primary mt-4 w-full py-4 text-base" onClick={() => startTimer(nextUp.id)}>
            <Play className="h-5 w-5" /> Start “{nextUp.title}”
          </button>
        )}
      </div>
    );
  }

  const running = timer.isRunning(task);
  const elapsed = timer.elapsedMs(task, now);
  const est = timer.estimateMs(task);
  const remaining = est - elapsed;
  const over = est > 0 && remaining < 0;
  const { h, m, s } = clockParts(elapsed);
  const pct = est ? Math.min(1, elapsed / est) : 0;

  return (
    <div className={`card overflow-hidden p-6 ${running ? 'border-brand-300 dark:border-brand-500/40' : ''}`}>
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
        <span>{running ? 'Now tracking' : 'Paused'}</span>
        {running && <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Live</span>}
      </div>
      <div className="mt-1 line-clamp-2 text-lg font-semibold">{task.title}</div>
      <div className="mt-4 text-center font-mono tabular">
        <span className="text-6xl font-semibold tracking-tight">{h}:{m}</span>
        <span className="ml-1 text-2xl text-slate-400">{s}</span>
      </div>
      {est > 0 && (
        <>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div className={`h-full rounded-full transition-all ${over ? 'bg-rose-500' : pct > 0.85 ? 'bg-amber-500' : 'bg-brand-500'}`} style={{ width: `${pct * 100}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-xs tabular text-slate-500">
            <span>Estimate {formatDuration(est)}</span>
            <span className={over ? 'font-semibold text-rose-600' : ''}>{over ? `${formatHM(-remaining)} over` : `${formatHM(remaining)} left`}</span>
          </div>
        </>
      )}
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={() => toggleTimer(task.id)}
          className={`flex h-16 flex-1 items-center justify-center gap-2 rounded-2xl text-lg font-semibold text-white shadow-lg transition active:scale-[.97] ${running ? 'bg-amber-500 shadow-amber-500/30' : 'bg-brand-600 shadow-brand-500/30'}`}
        >
          {running ? <><Pause className="h-6 w-6" /> Pause</> : <><Play className="h-6 w-6" /> Resume</>}
        </button>
        <button onClick={() => toggleComplete(task.id)} className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 active:scale-[.97] dark:text-emerald-400" aria-label="Complete task">
          <Check className="h-7 w-7" />
        </button>
      </div>
    </div>
  );
}

function QuickAdd() {
  const addTask = useStore((s) => s.addTask);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [hours, setHours] = useState(1);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 py-3 text-sm font-medium text-slate-500 active:bg-slate-100 dark:border-slate-700 dark:active:bg-slate-900">
        <Plus className="h-4 w-4" /> Add task
      </button>
    );
  }
  return (
    <form
      className="card animate-slide-down space-y-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        addTask({ title, estimatedHours: hours });
        setTitle('');
        setOpen(false);
      }}
    >
      <input className="input" autoFocus placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} aria-label="Task title" />
      <div className="flex gap-2">
        {[0.5, 1, 2, 3].map((h) => (
          <button type="button" key={h} onClick={() => setHours(h)} className={`flex-1 rounded-xl py-2 text-sm font-medium ${hours === h ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
            {h < 1 ? '30m' : `${h}h`}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn-soft flex-1" onClick={() => setOpen(false)}>Cancel</button>
        <button type="submit" className="btn-primary flex-1">Add</button>
      </div>
    </form>
  );
}

function TaskItem({ task, now }) {
  const { toggleTimer, toggleComplete } = useStore.getState();
  const running = timer.isRunning(task);
  const elapsed = timer.elapsedMs(task, now);
  return (
    <li className={`flex items-center gap-3 rounded-2xl px-3 py-3 ${running ? 'bg-brand-50 dark:bg-brand-500/10' : ''}`}>
      <button
        onClick={() => toggleComplete(task.id)}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${task.completed ? 'animate-pop border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600'}`}
        aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
      >
        {task.completed && <Check className="h-4 w-4" strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1">
        <div className={`truncate font-medium ${task.completed ? 'text-slate-400 line-through' : ''}`}>{task.title}</div>
        <div className="text-xs tabular text-slate-500">
          {formatHM(elapsed)} / {task.estimatedHours ? formatDuration(timer.estimateMs(task)) : '—'}
        </div>
      </div>
      {!task.completed && (
        <button
          onClick={() => toggleTimer(task.id)}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:scale-95 ${running ? 'bg-amber-500 text-white' : 'bg-brand-500/10 text-brand-600 dark:text-brand-300'}`}
          aria-label={running ? 'Pause timer' : 'Start timer'}
        >
          {running ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
        </button>
      )}
    </li>
  );
}

export default function NowTab() {
  const now = useNow(1000);
  const tasks = useStore((s) => s.tasks);
  const today = useStore((s) => s.today);

  const { active, list, nextUp } = useMemo(() => {
    const all = visibleTasks(tasks);
    const todays = sortTasks(all.filter((t) => t.date === today || timer.isRunning(t)));
    const running = all.find(timer.isRunning);
    const lastWorked = all
      .filter((t) => !t.completed && t.sessions?.length)
      .sort((a, b) => (b.sessions[b.sessions.length - 1]?.end || 0) - (a.sessions[a.sessions.length - 1]?.end || 0))[0];
    return { active: running || lastWorked, list: todays, nextUp: todays.find((t) => !t.completed) };
  }, [tasks, today]);

  const open = list.filter((t) => !t.completed);
  const done = list.filter((t) => t.completed);

  return (
    <div className="space-y-5">
      <TimerCard task={active} nextUp={nextUp} now={now} />
      <section>
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="font-semibold">Active tasks</h2>
          <span className="text-xs tabular text-slate-500">{done.length}/{list.length} done</span>
        </div>
        {open.length > 0 && (
          <ul className="card divide-y divide-slate-100 p-1 dark:divide-slate-800">
            {open.map((t) => <TaskItem key={t.id} task={t} now={now} />)}
          </ul>
        )}
        <div className="mt-3"><QuickAdd /></div>
      </section>
      {done.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 font-semibold text-slate-500">Completed</h2>
          <ul className="card divide-y divide-slate-100 p-1 dark:divide-slate-800">
            {done.map((t) => <TaskItem key={t.id} task={t} now={now} />)}
          </ul>
        </section>
      )}
    </div>
  );
}
