import { useMemo, useState } from 'react';
import { Pause, Play, Check, Plus } from 'lucide-react';
import { timer, clockParts, formatHM, formatDuration, useNow, visibleTasks, sortTasks, timerOrbState } from '@lifetracker/shared';
import { useStore } from '../config';
import Orb from './Orb';

function TimerCard({ task, nextUp, now }) {
  const { toggleTimer, toggleComplete, startTimer } = useStore.getState();
  const running = timer.isRunning(task);
  const elapsed = task ? timer.elapsedMs(task, now) : 0;
  const est = task ? timer.estimateMs(task) : 0;
  const remaining = est - elapsed;
  const over = est > 0 && remaining < 0;
  const warn = est > 0 && !over && remaining <= timer.warningThresholdMs(task);
  const orbState = timerOrbState({ running, warn, over, hasTask: Boolean(task) });
  const accent = over ? 'text-rose-300' : warn ? 'text-amber-300' : 'text-brand-300';
  const { h, m, s } = clockParts(elapsed);
  const pct = est ? Math.min(1, elapsed / est) : 0;

  return (
    <div className="card relative overflow-hidden">
      <Orb state={orbState} className="absolute inset-x-0 top-0 h-72" />
      <div className="relative px-5 pb-5 pt-5">
        {!task ? (
          <>
            <p className="caps text-slate-400"><span className="mr-2 text-brand-300">{'//00'}</span>Timer / idle</p>
            <h2 className="font-display mt-44 text-5xl leading-[0.9]">Ready<br />to focus</h2>
            <p className="mt-3 text-sm text-slate-400">{nextUp ? <>Next up: <span className="text-slate-100">{nextUp.title}</span></> : 'Add a task below to get started.'}</p>
            {nextUp && (
              <button className="btn-primary mt-5 w-full py-4" onClick={() => startTimer(nextUp.id)}>
                <Play className="h-4 w-4" /> Start
              </button>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="caps text-slate-400"><span className={`mr-2 ${accent}`}>{'//'}{running ? '01' : '00'}</span>{running ? 'Now tracking' : 'Paused'}</p>
              {running && <span className={`caps flex items-center gap-1.5 ${accent}`}><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" /> Live</span>}
            </div>
            <div className="mt-44">
              <div className="line-clamp-2 text-base text-slate-200">{task.title}</div>
              <div className="font-display mt-1 flex items-baseline tabular">
                <span className="text-7xl leading-none">{h}:{m}</span>
                <span className="ml-2 text-2xl text-slate-500">{s}</span>
              </div>
            </div>
            {est > 0 && (
              <>
                <div className="mt-5 h-px bg-white/10">
                  <div className={`h-full transition-all ${over ? 'bg-rose-400' : pct > 0.85 ? 'bg-amber-300' : 'bg-brand-300'}`} style={{ width: `${pct * 100}%` }} />
                </div>
                <div className="caps mt-2.5 flex justify-between tabular text-slate-500">
                  <span>Estimate {formatDuration(est)}</span>
                  <span className={over || warn ? accent : ''}>{over ? `${formatHM(-remaining)} over` : `${formatHM(remaining)} left`}</span>
                </div>
              </>
            )}
            <div className="mt-6 flex items-center gap-3">
              <button onClick={() => toggleTimer(task.id)} className={`flex-1 py-4 ${running ? 'btn-soft' : 'btn-primary'}`}>
                {running ? <><Pause className="h-4 w-4" /> Pause</> : <><Play className="h-4 w-4" /> Resume</>}
              </button>
              <button onClick={() => toggleComplete(task.id)} className="flex h-[52px] w-[52px] items-center justify-center rounded-full border border-emerald-300/40 text-emerald-300 active:scale-[.97]" aria-label="Complete task">
                <Check className="h-5 w-5" />
              </button>
            </div>
          </>
        )}
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
      <button onClick={() => setOpen(true)} className="caps flex w-full items-center justify-center gap-2 rounded-full border border-dashed border-white/20 py-4 text-slate-400 active:bg-white/5">
        <Plus className="h-3.5 w-3.5" /> Add task
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
          <button type="button" key={h} onClick={() => setHours(h)} className={`caps flex-1 rounded-full border py-2.5 ${hours === h ? 'border-slate-50 bg-slate-50 text-slate-950' : 'border-white/15 text-slate-400'}`}>
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
    <li className={`flex items-center gap-3 rounded-2xl px-3 py-3 ${running ? 'bg-brand-400/[0.07]' : ''}`}>
      <button
        onClick={() => toggleComplete(task.id)}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${task.completed ? 'animate-pop border-emerald-300 bg-emerald-300 text-slate-950' : 'border-white/20'}`}
        aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
      >
        {task.completed && <Check className="h-4 w-4" strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1">
        <div className={`truncate font-medium ${task.completed ? 'text-slate-400 line-through' : ''}`}>{task.title}</div>
        <div className="caps mt-1 tabular text-slate-500">
          <span className={running ? 'text-brand-200' : ''}>{formatHM(elapsed)}</span> / {task.estimatedHours ? formatDuration(timer.estimateMs(task)) : '—'}
        </div>
      </div>
      {!task.completed && (
        <button
          onClick={() => toggleTimer(task.id)}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:scale-95 ${running ? 'bg-slate-50 text-slate-950' : 'border border-white/15 text-slate-200'}`}
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
          <h2 className="caps text-slate-300"><span className="mr-2 text-brand-300">{'//02'}</span>Active tasks</h2>
          <span className="caps tabular text-slate-500">{done.length}/{list.length} done</span>
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
          <h2 className="caps mb-2 px-1 text-slate-500"><span className="mr-2 text-emerald-300">{'//03'}</span>Completed</h2>
          <ul className="card divide-y divide-slate-100 p-1 dark:divide-slate-800">
            {done.map((t) => <TaskItem key={t.id} task={t} now={now} />)}
          </ul>
        </section>
      )}
    </div>
  );
}
