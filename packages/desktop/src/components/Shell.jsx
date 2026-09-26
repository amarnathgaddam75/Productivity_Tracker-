import { useEffect, useState } from 'react';
import { ListTodo, BarChart3, Settings, LogOut } from 'lucide-react';
import { formatDayLabel } from '@lifetracker/shared';
import { useStore } from '../config.js';
import { Logo } from './ui.jsx';
import TasksView from './TasksView.jsx';
import ReportsView from './ReportsView.jsx';
import SettingsView from './SettingsView.jsx';
import SyncBadge from './SyncBadge.jsx';
import NotificationBell from './NotificationBell.jsx';
import Toasts from './Toasts.jsx';

const NAV = [
  { id: 'tasks', label: 'Tasks', icon: ListTodo, key: '1' },
  { id: 'reports', label: 'Reports', icon: BarChart3, key: '2' },
  { id: 'settings', label: 'Settings', icon: Settings, key: ',' },
];

export default function Shell() {
  const [view, setView] = useState('tasks');
  const user = useStore((s) => s.user);
  const displayName = useStore((s) => s.settings.displayName) || user?.displayName || user?.email;
  const today = useStore((s) => s.today);
  const signOut = useStore((s) => s.signOut);

  useEffect(() => window.desktop?.onNavigate?.(setView), []);

  return (
    <div className="flex h-full">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white/70 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/50">
        <Logo className="px-2 py-1" />
        <nav className="mt-8 space-y-1">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                view === id
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-auto rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <div className="truncate text-sm font-medium" title={displayName}>{displayName}</div>
          <div className="truncate text-xs text-slate-500" title={user?.email}>{user?.email}</div>
          <button onClick={signOut} className="btn-ghost mt-2 w-full justify-start px-2 py-1.5 text-xs">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-8 dark:border-slate-800">
          <div>
            <h1 className="text-lg font-semibold">{NAV.find((n) => n.id === view)?.label}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {formatDayLabel(today, today)} · {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SyncBadge />
            <NotificationBell />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl p-8">
            {view === 'tasks' && <TasksView />}
            {view === 'reports' && <ReportsView />}
            {view === 'settings' && <SettingsView />}
          </div>
        </div>
      </main>
      <Toasts />
    </div>
  );
}
