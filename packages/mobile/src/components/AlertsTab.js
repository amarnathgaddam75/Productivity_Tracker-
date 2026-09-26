import { useEffect } from 'react';
import { BellOff, BellRing } from 'lucide-react';
import { useStore } from '../config';
import { KIND_STYLE } from './kindStyle';

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return new Date(ts).toLocaleDateString();
}

export default function AlertsTab() {
  const notifications = useStore((s) => s.notifications);
  const markAllRead = useStore((s) => s.markAllRead);
  const clear = useStore((s) => s.clearNotifications);
  const canAsk = typeof Notification !== 'undefined' && Notification.permission === 'default';

  // Opening the tab marks everything as read (clears the badge).
  useEffect(() => {
    const t = setTimeout(markAllRead, 1200);
    return () => clearTimeout(t);
  }, [markAllRead, notifications.length]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="font-semibold">Notifications</h2>
        {notifications.length > 0 && <button onClick={clear} className="text-sm font-medium text-brand-600 dark:text-brand-400">Clear all</button>}
      </div>
      {canAsk && (
        <button className="btn-soft w-full" onClick={() => Notification.requestPermission()}>
          <BellRing className="h-4 w-4" /> Allow alerts when the app is in background
        </button>
      )}
      {notifications.length === 0 ? (
        <div className="card flex flex-col items-center p-10 text-center text-sm text-slate-500">
          <BellOff className="mb-2 h-8 w-8 text-slate-300" />
          No notifications yet. Completed tasks, time warnings and goal celebrations show up here.
        </div>
      ) : (
        <ul className="card divide-y divide-slate-100 dark:divide-slate-800">
          {notifications.map((n) => {
            const { icon: Icon, cls } = KIND_STYLE[n.kind] || KIND_STYLE.summary;
            return (
              <li key={n.id} className={`flex gap-3 p-4 ${n.read ? '' : 'bg-brand-50/60 dark:bg-brand-500/5'}`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cls}`}><Icon className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{n.title}</span>
                    <span className="shrink-0 text-xs text-slate-400">{timeAgo(n.at)}</span>
                  </div>
                  <div className="text-sm text-slate-500">{n.body}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
