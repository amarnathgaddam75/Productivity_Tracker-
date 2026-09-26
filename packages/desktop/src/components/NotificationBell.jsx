import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { useStore } from '../config.js';
import { KIND_STYLE } from './notificationStyle.js';

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const notifications = useStore((s) => s.notifications);
  const markAllRead = useStore((s) => s.markAllRead);
  const clear = useStore((s) => s.clearNotifications);
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const toggle = () => {
    setOpen((o) => !o);
    if (!open && unread) setTimeout(markAllRead, 1500);
  };

  return (
    <div className="relative" ref={ref}>
      <button className="icon-btn relative h-9 w-9" onClick={toggle} aria-label={`Notifications (${unread} unread)`}>
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 animate-pop items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="card absolute right-0 top-11 z-40 w-96 animate-slide-in overflow-hidden shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <span className="text-sm font-semibold">Notifications</span>
            <div className="flex gap-1">
              <button className="icon-btn" title="Mark all read" onClick={markAllRead}><CheckCheck className="h-4 w-4" /></button>
              <button className="icon-btn" title="Clear all" onClick={clear}><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 && <div className="px-4 py-10 text-center text-sm text-slate-500">You're all caught up.</div>}
            {notifications.map((n) => {
              const { icon: Icon, cls } = KIND_STYLE[n.kind] || KIND_STYLE.summary;
              return (
                <div key={n.id} className={`flex gap-3 border-b border-slate-100 px-4 py-3 last:border-0 dark:border-slate-800 ${n.read ? '' : 'bg-brand-50/50 dark:bg-brand-500/5'}`}>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cls}`}><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{n.title}</span>
                      <span className="shrink-0 text-xs text-slate-400">{timeAgo(n.at)}</span>
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">{n.body}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
