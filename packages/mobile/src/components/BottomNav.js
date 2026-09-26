import { Timer, PieChart, Bell } from 'lucide-react';
import { useStore } from '../config';

const TABS = [
  { id: 'now', label: 'Now', icon: Timer },
  { id: 'summary', label: 'Today', icon: PieChart },
  { id: 'alerts', label: 'Alerts', icon: Bell },
];

export default function BottomNav({ tab, onChange }) {
  const unread = useStore((s) => s.notifications.filter((n) => !n.read).length);
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      <div className="mx-auto flex max-w-lg">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => onChange(id)} className={`relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${tab === id ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500'}`}>
            <span className="relative">
              <Icon className="h-6 w-6" />
              {id === 'alerts' && unread > 0 && (
                <span className="absolute -right-2 -top-1 flex h-4 min-w-4 animate-pop items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>
              )}
            </span>
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}
