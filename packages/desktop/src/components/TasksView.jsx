import { useMemo, useState } from 'react';
import { ListTodo } from 'lucide-react';
import { visibleTasks, sortTasks } from '@lifetracker/shared';
import { useStore } from '../config.js';
import TimerHero from './TimerHero.jsx';
import AddTaskForm from './AddTaskForm.jsx';
import TaskRow from './TaskRow.jsx';
import { EmptyState } from './ui.jsx';

const FILTERS = [
  { id: 'today', label: 'Today' },
  { id: 'open', label: 'Open' },
  { id: 'done', label: 'Completed' },
  { id: 'earlier', label: 'Earlier' },
];

export default function TasksView() {
  const tasks = useStore((s) => s.tasks);
  const today = useStore((s) => s.today);
  const [filter, setFilter] = useState('today');

  const all = useMemo(() => visibleTasks(tasks), [tasks]);
  const lists = useMemo(() => {
    const todays = all.filter((t) => t.date === today || t.runningSince);
    return {
      today: sortTasks(todays),
      open: sortTasks(todays.filter((t) => !t.completed)),
      done: sortTasks(todays.filter((t) => t.completed)),
      earlier: sortTasks(all.filter((t) => t.date < today && !t.runningSince)),
    };
  }, [all, today]);

  const list = lists[filter];
  const doneCount = lists.done.length;

  return (
    <div>
      <TimerHero />

      <div className="card mt-20">
        <div className="border-b border-slate-200 p-5 dark:border-slate-800">
          <AddTaskForm />
        </div>
        <div className="flex items-center justify-between px-5 pt-4">
          <div className="flex gap-1 rounded-full border border-white/10 p-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`caps rounded-full px-3 py-1.5 transition ${
                  filter === f.id ? 'bg-slate-50 text-slate-950' : 'text-slate-500 hover:text-slate-200'
                }`}
              >
                {f.label}
                <span className={`ml-1.5 tabular ${filter === f.id ? 'text-slate-500' : 'text-slate-600'}`}>{lists[f.id].length}</span>
              </button>
            ))}
          </div>
          <span className="caps text-slate-500 tabular">
            {doneCount}/{lists.today.length} done today
          </span>
        </div>
        <div className="p-3">
          {list.length === 0 ? (
            <EmptyState icon={ListTodo} title={filter === 'done' ? 'Nothing completed yet' : filter === 'earlier' ? 'No older tasks' : 'No tasks yet'}>
              {filter === 'earlier'
                ? 'Unfinished tasks from previous days show up here when carry-over is turned off.'
                : 'Add a task above with an estimate, then press play to start tracking time.'}
            </EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {list.map((t) => (
                <TaskRow key={t.id} task={t} showDate={filter === 'earlier'} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
