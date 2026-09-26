import { Volume2 } from 'lucide-react';
import { buildBriefing, formatDuration, speak, useNow } from '@lifetracker/shared';
import { useStore } from '../config';

const clock = (ts) => new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const STATUS = {
  ahead: ['Ahead', 'border-emerald-300/40 text-emerald-300'],
  'on-track': ['On track', 'border-brand-300/40 text-brand-200'],
  behind: ['Behind', 'border-amber-300/40 text-amber-300'],
  done: ['All done', 'border-emerald-300/40 text-emerald-300'],
  idle: ['Nothing planned', 'border-white/15 text-slate-400'],
};

/** What needs to be done, where you are and how much time is left. */
export default function Briefing() {
  const now = useNow(15000);
  const tasks = useStore((s) => s.tasks);
  const today = useStore((s) => s.today);
  const settings = useStore((s) => s.settings);
  const user = useStore((s) => s.user);
  const name = (settings.displayName || user?.displayName || '').split(' ')[0];
  const b = buildBriefing({ tasks, today, settings, now, name });
  const [label, cls] = STATUS[b.status];

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="caps text-slate-400"><span className="mr-1.5 text-[var(--accent)]">{'//01'}</span>{settings.assistantName || 'Atlas'} briefing</span>
        <button onClick={() => speak(b.speech)} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-slate-200 active:scale-95" aria-label="Read aloud">
          <Volume2 className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 text-2xl font-light leading-snug" style={{ fontStretch: '112%' }}>{b.headline}</div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className={`caps rounded-full border px-2.5 py-1 ${cls}`}>{label}</span>
        {b.plan.length > 0 && <span className="caps text-slate-500">Finish ≈ {clock(b.finishAt)}</span>}
      </div>
      <div className="mt-3 space-y-1.5 text-sm text-slate-300">
        {b.lines.map((l) => <p key={l}>{l}</p>)}
      </div>
      {b.plan.length > 0 && (
        <ul className="mt-4 divide-y divide-white/[0.06] border-t border-white/[0.06]">
          {b.plan.slice(0, 5).map((p) => (
            <li key={p.task.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="caps w-24 shrink-0 tabular text-slate-500">{clock(p.startAt)}–{clock(p.endAt)}</span>
              <span className={`truncate ${p.endAt > b.dayEnd ? 'text-amber-300' : 'text-slate-200'}`}>{p.task.title}</span>
              <span className="ml-auto shrink-0 tabular text-slate-400">{formatDuration(p.remainingMs)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
