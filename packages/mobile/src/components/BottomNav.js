import { Timer, PieChart, Bell, Sparkles } from 'lucide-react';
import { useStore } from '../config';

const TABS = [
  { id: 'assistant', label: 'Assistant', icon: Sparkles },
  { id: 'now', label: 'Now', icon: Timer },
  { id: 'summary', label: 'Today', icon: PieChart },
  { id: 'alerts', label: 'Alerts', icon: Bell },
];

export default function BottomNav({ tab, onChange }) {
  const unread = useStore((s) => s.notifications.filter((n) => !n.read).length);
  const assistantName = useStore((s) => s.settings.assistantName) || 'Atlas';
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.07] bg-slate-950/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => onChange(id)} className={`caps relative flex flex-1 flex-col items-center gap-1.5 pb-2.5 pt-3 ${tab === id ? 'text-slate-50' : 'text-slate-500'}`}>
            <span className="relative">
              <Icon className={`h-5 w-5 ${tab === id ? 'text-brand-300' : ''}`} strokeWidth={1.5} />
              {id === 'alerts' && unread > 0 && (
                <span className="absolute -right-2 -top-1 flex h-4 min-w-4 animate-pop items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>
              )}
            </span>
            {id === 'assistant' ? assistantName.slice(0, 10) : label}
            {tab === id && <span className="absolute top-0 h-px w-8 bg-brand-300" />}
          </button>
        ))}
      </div>
    </nav>
  );
}
