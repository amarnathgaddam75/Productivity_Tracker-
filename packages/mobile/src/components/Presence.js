import { Monitor } from 'lucide-react';
import { useNow } from '@lifetracker/shared';
import { useStore } from '../config';

function ago(ms) {
  const m = Math.round(ms / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}

/** “Desktop · VS Code · now” — what the desktop assistant sees you doing. */
export default function Presence() {
  const now = useNow(30000);
  const p = useStore((s) => s.presence);
  if (!p?.updatedAt) return null;
  const fresh = now - p.updatedAt < 4 * 60000;
  const what = !fresh ? `last seen ${ago(now - p.updatedAt)}` : p.idle ? 'away' : p.app || (p.supported === false ? 'active' : 'active');
  return (
    <div className="caps mt-1.5 flex min-w-0 items-center gap-1.5 text-slate-500">
      <Monitor className="h-3 w-3 shrink-0" strokeWidth={1.75} />
      <span className="truncate">
        Desktop · <span className={fresh && !p.idle ? 'text-slate-300' : ''}>{what}</span>
        {fresh && p.taskTitle ? <> · <span className="text-[var(--accent)]">{p.taskTitle}</span></> : null}
        {fresh && p.title ? <span className="normal-case tracking-normal"> — {p.title}</span> : null}
      </span>
    </div>
  );
}
