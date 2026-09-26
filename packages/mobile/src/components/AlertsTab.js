import { useEffect, useState } from 'react';
import { BellOff, BellRing, Smartphone, Loader2 } from 'lucide-react';
import { enablePhonePush, disablePhonePush, pushSupport, thisDeviceRegistered } from '../phonePush';
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
  const devices = useStore((s) => s.devices);
  const registered = thisDeviceRegistered(devices);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const support = pushSupport();

  async function toggle() {
    setBusy(true);
    setMsg('');
    try {
      if (registered) {
        await disablePhonePush(useStore);
        setMsg('This phone will no longer get notifications.');
      } else {
        await enablePhonePush(useStore);
        setMsg('Done — your desktop assistant can now reach this phone, even when the app is closed.');
      }
    } catch (err) {
      setMsg(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  // Opening the tab marks everything as read (clears the badge).
  useEffect(() => {
    const t = setTimeout(markAllRead, 1200);
    return () => clearTimeout(t);
  }, [markAllRead, notifications.length]);

  return (
    <div className="space-y-3">
      <header className="pb-3 pt-[33vh]">
        <p className="caps text-slate-400"><span className="mr-2 text-[var(--accent)]">{'//03'}</span>Notifications / Sync</p>
        <h1 className="font-display mt-2 text-6xl leading-none" style={{ textShadow: '0 0 24px rgba(7,5,13,.9)' }}>Alerts</h1>
      </header>
      <div className="flex items-center justify-between px-1">
        <h2 className="caps text-slate-300"><span className="mr-2 text-brand-300">{'//01'}</span>Notifications</h2>
        {notifications.length > 0 && <button onClick={clear} className="caps text-brand-300">Clear all</button>}
      </div>
      <div className="card p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 text-[var(--accent)]">
            <Smartphone className="h-5 w-5" strokeWidth={1.5} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm text-slate-100">{registered ? 'Notifications on this phone are on' : 'Get reminders on this phone'}</div>
            <div className="text-xs text-slate-500">Briefings, nudges and reports from your desktop assistant — even when this app is closed.</div>
          </div>
        </div>
        <button className={`${registered ? 'btn-soft' : 'btn-primary'} mt-4 w-full`} onClick={toggle} disabled={busy || !support.ok}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
          {registered ? 'Turn off on this phone' : 'Enable notifications'}
        </button>
        {(msg || !support.ok) && <p className="mt-3 text-xs text-slate-400">{msg || support.reason}</p>}
      </div>
      {notifications.length === 0 ? (
        <div className="card flex flex-col items-center p-10 text-center text-sm text-slate-500">
          <BellOff className="mb-3 h-6 w-6 text-slate-500" strokeWidth={1.5} />
          No notifications yet. Completed tasks, time warnings and goal celebrations show up here.
        </div>
      ) : (
        <ul className="card divide-y divide-slate-100 dark:divide-slate-800">
          {notifications.map((n) => {
            const { icon: Icon, cls } = KIND_STYLE[n.kind] || KIND_STYLE.summary;
            return (
              <li key={n.id} className={`flex gap-3 p-4 ${n.read ? '' : 'bg-brand-400/[0.06]'}`}>
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
