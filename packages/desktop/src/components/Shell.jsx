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
      <aside className="flex w-60 shrink-0 flex-col border-r border-white/[0.06] p-6">
        <Logo sub="Desktop" />
        <nav className="mt-14 space-y-1">
          {NAV.map(({ id, label, icon: Icon }, i) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`group flex w-full items-center gap-3 rounded-full py-2 pr-3 text-left transition ${view === id ? 'text-slate-50' : 'text-slate-500 hover:text-slate-200'}`}
            >
              <span className={`h-px transition-all duration-300 ${view === id ? 'w-6 bg-brand-300' : 'w-3 bg-slate-600 group-hover:w-4'}`} />
              <span className="caps">
                <span className={view === id ? 'text-brand-300' : 'text-slate-600'}>//0{i + 1}</span> {label}
              </span>
              <Icon className="ml-auto h-3.5 w-3.5 opacity-0 transition group-hover:opacity-60" strokeWidth={1.5} />
            </button>
          ))}
        </nav>
        <div className="mt-auto border-t border-white/[0.06] pt-5">
          <div className="truncate text-sm text-slate-100" title={displayName}>{displayName}</div>
          <div className="mt-1 truncate text-xs text-slate-500" title={user?.email}>{user?.email}</div>
          <button onClick={signOut} className="btn-ghost -ml-3 mt-3 px-3 py-1.5">
            <LogOut className="h-3 w-3" /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-end justify-between px-8 pb-2 pt-8">
          <div>
            <p className="caps text-slate-500">
              <span className="mr-2 text-brand-300">//0{NAV.findIndex((n) => n.id === view) + 1}</span>
              {formatDayLabel(today, today)} / {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <h1 className="font-display mt-2 text-5xl leading-none">{NAV.find((n) => n.id === view)?.label}</h1>
          </div>
          <div className="flex items-center gap-2">
            <SyncBadge />
            <NotificationBell />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-8 pb-10 pt-6">
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
