import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { useStore } from '../config.js';

const PRESETS = [0.25, 0.5, 1, 2, 3];

export default function AddTaskForm() {
  const addTask = useStore((s) => s.addTask);
  const [title, setTitle] = useState('');
  const [hours, setHours] = useState('1');
  const titleRef = useRef(null);

  function submit(e) {
    e.preventDefault();
    if (!title.trim()) return titleRef.current?.focus();
    addTask({ title, estimatedHours: parseFloat(hours) || 0 });
    setTitle('');
    titleRef.current?.focus();
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[240px] flex-1">
        <label className="label" htmlFor="new-title">New task</label>
        <input id="new-title" ref={titleRef} className="input" placeholder="What are you working on?" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
      </div>
      <div className="w-32">
        <label className="label" htmlFor="new-hours">Estimate (h)</label>
        <input id="new-hours" type="number" min="0" max="24" step="0.25" className="input tabular" value={hours} onChange={(e) => setHours(e.target.value)} />
      </div>
      <div className="flex gap-1 pb-0.5">
        {PRESETS.map((p) => (
          <button type="button" key={p} onClick={() => setHours(String(p))} className={`rounded-lg px-2 py-1.5 text-xs font-medium transition ${parseFloat(hours) === p ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            {p < 1 ? `${p * 60}m` : `${p}h`}
          </button>
        ))}
      </div>
      <button type="submit" className="btn-primary">
        <Plus className="h-4 w-4" /> Add task
      </button>
    </form>
  );
}
