import { useState } from 'react';
import { Play, Pause, Pencil, Trash2, Check, X, CalendarArrowUp } from 'lucide-react';
import { timer, formatHM, formatDuration, formatDayLabel, useNow } from '@lifetracker/shared';
import { useStore } from '../config.js';
import { ProgressBar } from './ui.jsx';

function StatusChip({ task, now }) {
  const chip = 'caps rounded-full border px-2 py-0.5 text-[9px]';
  if (task.completed) return <span className={`${chip} border-emerald-300/30 text-emerald-300`}>Done</span>;
  if (timer.isRunning(task)) return <span className={`${chip} border-brand-300/40 text-brand-200`}>● Running</span>;
  const est = timer.estimateMs(task);
  if (est && timer.elapsedMs(task, now) > est) return <span className={`${chip} border-rose-300/40 text-rose-300`}>Over</span>;
  if (timer.elapsedMs(task, now) > 0) return <span className={`${chip} border-amber-300/30 text-amber-300`}>Paused</span>;
  return <span className={`${chip} border-white/10 text-slate-500`}>To do</span>;
}

export default function TaskRow({ task, showDate }) {
  const running = timer.isRunning(task);
  const now = useNow(running ? 1000 : 60000);
  const today = useStore((s) => s.today);
  const { toggleComplete, toggleTimer, updateTask, deleteTask } = useStore.getState();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [hours, setHours] = useState(String(task.estimatedHours));

  const elapsed = timer.elapsedMs(task, now);
  const est = timer.estimateMs(task);

  function save(e) {
    e?.preventDefault();
    updateTask(task.id, { title, estimatedHours: parseFloat(hours) || 0 });
    setEditing(false);
  }

  function startEdit() {
    setTitle(task.title);
    setHours(String(task.estimatedHours));
    setEditing(true);
  }

  if (editing) {
    return (
      <li className="px-2 py-3">
        <form onSubmit={save} className="flex items-center gap-2" onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}>
          <input className="input flex-1" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus maxLength={200} aria-label="Task title" />
          <input className="input w-24 tabular" type="number" min="0" max="24" step="0.25" value={hours} onChange={(e) => setHours(e.target.value)} aria-label="Estimated hours" />
          <button type="submit" className="icon-btn text-emerald-600" aria-label="Save"><Check className="h-4 w-4" /></button>
          <button type="button" className="icon-btn" onClick={() => setEditing(false)} aria-label="Cancel"><X className="h-4 w-4" /></button>
        </form>
      </li>
    );
  }

  return (
    <li className={`group flex items-center gap-4 rounded-xl px-2 py-3 transition hover:bg-white/[0.03] ${running ? 'bg-brand-400/[0.06]' : ''}`}>
      <button
        onClick={() => toggleComplete(task.id)}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
          task.completed ? 'animate-pop border-emerald-300 bg-emerald-300 text-slate-950' : 'border-white/20 hover:border-emerald-300'
        }`}
        aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
      >
        {task.completed && <Check className="h-4 w-4" strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1" onDoubleClick={startEdit}>
        <div className="flex items-center gap-2">
          <span className={`truncate font-medium ${task.completed ? 'text-slate-400 line-through' : ''}`} title={task.title}>{task.title}</span>
          <StatusChip task={task} now={now} />
          {showDate && <span className="text-xs text-slate-400">{formatDayLabel(task.date, today)}</span>}
          {task.carriedFrom && !showDate && <span className="text-xs text-slate-400" title={`Carried over from ${task.carriedFrom}`}>↻ carried over</span>}
        </div>
        {est > 0 && (
          <div className="mt-2 max-w-md">
            <ProgressBar value={elapsed / est} over={elapsed > est} className="h-1.5" />
          </div>
        )}
      </div>

      <div className="w-36 text-right text-sm tabular">
        <div className={`font-display text-lg leading-none ${running ? 'text-brand-200' : 'text-slate-200'}`}>{formatHM(elapsed)}</div>
        <div className="caps mt-1.5 text-[9px] text-slate-500">of {est ? formatDuration(est) : 'no estimate'}</div>
      </div>

      <div className="flex items-center gap-1">
        {showDate && !task.completed && (
          <button className="icon-btn" title="Move to today" onClick={() => updateTask(task.id, { date: today })}>
            <CalendarArrowUp className="h-4 w-4" />
          </button>
        )}
        {!task.completed && (
          <button
            onClick={() => toggleTimer(task.id)}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
              running ? 'bg-slate-50 text-slate-950 hover:bg-white' : 'border border-white/15 text-slate-300 hover:border-white/60 hover:text-white'
            }`}
            aria-label={running ? 'Pause timer' : 'Start timer'}
          >
            {running ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
          </button>
        )}
        <button className="icon-btn opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={startEdit} aria-label="Edit task"><Pencil className="h-4 w-4" /></button>
        <button
          className="icon-btn opacity-0 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100"
          onClick={() => window.confirm(`Delete “${task.title}”?`) && deleteTask(task.id)}
          aria-label="Delete task"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}
