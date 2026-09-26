import { useEffect, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';
import { computeDailyReport, formatDuration, formatDayLabel, useNow, MS_HOUR } from '@lifetracker/shared';
import { useStore } from '../config.js';
import TasksView from './TasksView.jsx';
import ReportsView from './ReportsView.jsx';
import SettingsView from './SettingsView.jsx';
import SyncBadge from './SyncBadge.jsx';
import NotificationBell from './NotificationBell.jsx';
import Toasts from './Toasts.jsx';
import Scene from './Scene.jsx';

const NAV = [
  { id: 'tasks', label: 'Tasks', kicker: 'Plan / Track' },
  { id: 'reports', label: 'Reports', kicker: 'Progress / Insight' },
  { id: 'settings', label: 'Settings', kicker: 'Profile / Sync' },
];

/** Bottom rail: today's numbers + a hairline that fills toward the daily goal. */
function Rail() {
  const now = useNow(15000);
  const tasks = useStore((s) => s.tasks);
  const today = useStore((s) => s.today);
  const goalHours = useStore((s) => s.settings.dailyGoalHours);
  const r = computeDailyReport(tasks, today, { goalHours, now });
  return (
    <footer className="pointer-events-none fixed inset-x-10 bottom-6 z-20">
      <div className="flex items-end justify-between">
        <div className="caps text-[var(--accent)] opacity-90 transition-colors duration-1000">
          {r.completedTasks}/{r.totalTasks} tasks / {formatDuration(r.hoursWorked * MS_HOUR)} focused / score {r.productivityScore}%
        </div>
        <div className="caps text-slate-500">
          Goal {formatDuration(r.goalHours * MS_HOUR)} / {Math.round(r.goalProgress * 100)}%
        </div>
      </div>
      <div className="mt-3 h-px bg-white/10">
        <div className="h-full bg-[var(--accent)] transition-all duration-1000" style={{ width: `${r.goalProgress * 100}%` }} />
      </div>
    </footer>
  );
}

export default function Shell() {
  const [view, setView] = useState('tasks');
  const [menu, setMenu] = useState(false);
  const user = useStore((s) => s.user);
  const displayName = useStore((s) => s.settings.displayName) || user?.displayName || user?.email;
  const today = useStore((s) => s.today);
  const signOut = useStore((s) => s.signOut);
  const index = NAV.findIndex((n) => n.id === view);
  const mainRef = useRef(null);
  useEffect(() => mainRef.current?.scrollTo(0, 0), [view]);
  const nav = NAV[index];

  useEffect(() => window.desktop?.onNavigate?.(setView), []);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setMenu(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = (id) => {
    setView(id);
    setMenu(false);
  };

  return (
    <div className="relative h-full overflow-hidden">
      <Scene view={view} />

      {/* top chrome */}
      <header className="fixed inset-x-10 top-7 z-30 flex items-start justify-between">
        <div className="flex items-start gap-3.5">
          <button onClick={() => go('tasks')} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-[9px] tracking-[0.08em] hover:border-white/60" aria-label="LifeTracker home">
            LT
          </button>
          <div>
            <div className="caps leading-9 text-slate-300">
              LifeTracker / <span className="text-slate-500">{displayName}</span>
            </div>
            <div className="caps -mt-1.5 text-slate-600">
              {formatDayLabel(today, today)} / {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <SyncBadge />
          <NotificationBell />
          <button onClick={() => setMenu((m) => !m)} className="group flex items-center gap-3" aria-label={menu ? 'Close menu' : 'Open menu'} aria-expanded={menu}>
            <span className="caps text-slate-500 group-hover:text-slate-300">Menu</span>
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/40 transition duration-300 group-hover:rotate-90 group-hover:border-white">
              <span className={`h-[7px] w-[7px] rounded-full bg-slate-50 transition ${menu ? 'scale-[2.2]' : ''}`} />
            </span>
          </button>
        </div>
      </header>

      {/* right-edge ticks */}
      <nav className="fixed right-11 top-1/2 z-30 flex -translate-y-1/2 flex-col items-end gap-6" aria-label="Views">
        {NAV.map((n, i) => (
          <button key={n.id} onClick={() => go(n.id)} className="group relative flex items-center gap-3" aria-label={n.label}>
            <span className="caps pointer-events-none text-slate-400 opacity-0 transition group-hover:opacity-100">
              {`//0${i + 1}`} {n.label}
            </span>
            <span className={`h-px transition-all duration-500 ${view === n.id ? 'w-7 bg-[var(--accent)]' : 'w-3 bg-slate-500 group-hover:w-5'}`} />
          </button>
        ))}
      </nav>

      {/* content */}
      <main
        ref={mainRef}
        className="relative z-10 h-full overflow-y-auto"
        style={{
          // content fades out under the fixed header and bottom rail, like the landing page
          maskImage: 'linear-gradient(to bottom, transparent 0, transparent 80px, #000 150px, #000 calc(100% - 110px), transparent calc(100% - 60px))',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, transparent 80px, #000 150px, #000 calc(100% - 110px), transparent calc(100% - 60px))',
        }}
      >
        <div className="mx-auto max-w-[1180px] px-10 pb-40 pl-10 pr-24 pt-32">
          <p className="caps text-slate-400">
            <span className="mr-2 text-[var(--accent)]">{`//0${index + 1}`}</span>
            {nav.kicker}
          </p>
          <h1 className="font-display mb-10 mt-3 text-[92px] leading-[0.88]" style={{ textShadow: '0 0 28px rgba(7,5,13,.8)' }}>
            {nav.label}
          </h1>
          <div key={view} className="animate-slide-in">
            {view === 'tasks' && <TasksView />}
            {view === 'reports' && <ReportsView />}
            {view === 'settings' && <SettingsView />}
          </div>
        </div>
      </main>

      <Rail />

      {/* full-screen menu */}
      {menu && (
        <div className="fixed inset-0 z-20 flex animate-slide-in flex-col justify-center bg-slate-950/80 px-10 backdrop-blur-xl">
          <ol>
            {NAV.map((n, i) => (
              <li key={n.id}>
                <button onClick={() => go(n.id)} className={`group flex items-baseline gap-5 text-left transition-all hover:pl-3 ${view === n.id ? 'text-slate-50' : 'text-slate-500 hover:text-slate-100'}`}>
                  <span className="caps text-[var(--accent)]">{`//0${i + 1}`}</span>
                  <span className="font-display text-[88px] leading-[1.02]">{n.label}</span>
                </button>
              </li>
            ))}
          </ol>
          <div className="caps mt-12 flex items-center gap-6 text-slate-500">
            <span className="normal-case tracking-normal text-slate-400">{user?.email}</span>
            <button onClick={signOut} className="flex items-center gap-2 hover:text-slate-100">
              <LogOut className="h-3 w-3" /> Sign out
            </button>
          </div>
        </div>
      )}
      <Toasts />
    </div>
  );
}
