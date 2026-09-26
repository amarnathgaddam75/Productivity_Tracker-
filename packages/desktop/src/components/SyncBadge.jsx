import { Cloud, CloudOff, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useStore } from '../config.js';

const STATES = {
  synced: { icon: CheckCircle2, text: 'Synced', cls: 'text-emerald-300' },
  syncing: { icon: RefreshCw, text: 'Syncing', cls: 'text-brand-300', spin: true },
  pending: { icon: Cloud, text: 'Pending', cls: 'text-amber-300' },
  offline: { icon: CloudOff, text: 'Offline', cls: 'text-slate-300' },
  error: { icon: AlertTriangle, text: 'Sync error', cls: 'text-rose-300' },
};

export default function SyncBadge() {
  const sync = useStore((s) => s.sync);
  const online = useStore((s) => s.online);
  const syncNow = useStore((s) => s.syncNow);
  const key = !online ? 'offline' : sync.status;
  const st = STATES[key] || STATES.synced;
  const Icon = st.icon;
  const title =
    key === 'offline'
      ? `Offline — ${sync.pending} change(s) saved locally and will sync automatically`
      : key === 'error'
        ? `${sync.error || 'Sync failed'} — click to retry`
        : sync.pending
          ? `${sync.pending} change(s) waiting to sync`
          : 'All changes are saved to the cloud';
  return (
    <button onClick={() => syncNow()} title={title} className={`caps flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 ${st.cls}`}>
      <Icon className={`h-3 w-3 ${st.spin ? 'animate-spin' : ''}`} strokeWidth={1.75} />
      {st.text}
      {sync.pending > 0 && key !== 'syncing' && <span className="tabular">({sync.pending})</span>}
    </button>
  );
}
