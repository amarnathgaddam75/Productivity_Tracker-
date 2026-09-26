import { Volume2, Play, Sparkles, Monitor, Moon, CheckCircle2 } from 'lucide-react';
import { buildBriefing, formatDuration, useNow, voiceAvailable } from '@lifetracker/shared';
import { useStore } from '../config.js';
import { useAssistant } from '../assistant/state.js';
import { executeCommand } from '../assistant/runtime.js';
import Timeline from './Timeline.jsx';

const clock = (ts) => new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const STATUS = {
  ahead: { label: 'Ahead of schedule', cls: 'border-emerald-300/40 text-emerald-300' },
  'on-track': { label: 'On track', cls: 'border-brand-300/40 text-brand-200' },
  behind: { label: 'Behind schedule', cls: 'border-amber-300/40 text-amber-300' },
  done: { label: 'All done', cls: 'border-emerald-300/40 text-emerald-300' },
  idle: { label: 'Nothing planned', cls: 'border-white/15 text-slate-400' },
};

export default function AssistantView() {
  const now = useNow(5000);
  const tasks = useStore((s) => s.tasks);
  const today = useStore((s) => s.today);
  const settings = useStore((s) => s.settings);
  const user = useStore((s) => s.user);
  const activity = useAssistant((s) => s.activity);
  const segments = useAssistant((s) => s.segments);
  const messages = useAssistant((s) => s.messages);
  const setCommandOpen = useAssistant((s) => s.setCommandOpen);
  const firstName = (settings.displayName || user?.displayName || '').split(' ')[0];
  const b = buildBriefing({ tasks, today, settings, now, activity: window.desktop ? activity : null, name: firstName });
  const st = STATUS[b.status];
  const shadow = { textShadow: '0 0 30px rgba(7,5,13,.85)' };
  const span = Math.max(1, b.dayEnd - now);

  return (
    <div>
      {/* briefing hero */}
      <section className="max-w-2xl">
        <p className="caps text-slate-400">{b.greeting}</p>
        <h2 className="font-display mt-3 text-6xl leading-[0.92]" style={shadow}>
          {b.headline}
        </h2>
        <div className="mt-5 flex items-center gap-3">
          <span className={`caps rounded-full border px-3 py-1 ${st.cls}`}>{st.label}</span>
          {b.plan.length > 0 && <span className="caps text-slate-400">Finish ≈ {clock(b.finishAt)} / wrap-up {clock(b.dayEnd)}</span>}
        </div>
        <div className="mt-6 space-y-2 text-lg leading-relaxed text-slate-200" style={shadow}>
          {b.lines.map((l) => (
            <p key={l}>{l}</p>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <button className="btn-primary" onClick={() => executeCommand('status', { fromUser: false })} title={voiceAvailable() ? '' : 'No system voice found — the briefing is shown as text'}>
            <Volume2 className="h-3.5 w-3.5" /> Brief me
          </button>
          {!b.running && b.plan[0] && (
            <button className="btn-outline" onClick={() => executeCommand('start', { fromUser: false })}>
              <Play className="h-3.5 w-3.5" /> Start “{b.plan[0].task.title.slice(0, 28)}”
            </button>
          )}
          <button className="btn-outline" onClick={() => setCommandOpen(true)}>
            <Sparkles className="h-3.5 w-3.5" /> Ask · Ctrl K
          </button>
        </div>
      </section>

      <div className="mt-16 grid grid-cols-5 gap-5">
        {/* right now */}
        <div className="card col-span-2 p-6">
          <h3 className="caps text-slate-400"><span className="mr-2 text-[var(--accent)]">{'//01'}</span>Right now</h3>
          <div className="mt-5 flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 text-slate-300">
              {activity?.idleSec >= 120 ? <Moon className="h-5 w-5" strokeWidth={1.5} /> : <Monitor className="h-5 w-5" strokeWidth={1.5} />}
            </span>
            <div className="min-w-0">
              <div className="truncate text-lg text-slate-100">
                {!window.desktop ? 'Browser preview' : activity?.idleSec >= 120 ? `Away · ${formatDuration(activity.idleSec * 1000)}` : activity?.app || (activity?.supported === false ? 'Window tracking unavailable' : 'Watching…')}
              </div>
              <div className="truncate text-sm text-slate-500" title={activity?.title}>
                {activity?.supported === false && window.desktop
                  ? activity.reason === 'wayland'
                    ? 'Wayland hides other windows. On KDE install “kdotool”, or log in with an X11 session.'
                    : 'Install “xprop” (x11-utils) to see the active window.'
                  : activity?.title || '—'}
              </div>
            </div>
          </div>
          <div className="mt-6 border-t border-white/[0.06] pt-4 text-sm text-slate-400">
            {b.running ? (
              <>Timer: <span className="text-slate-100">{b.running.title}</span></>
            ) : (
              'No timer running.'
            )}
          </div>
        </div>

        {/* remaining plan */}
        <div className="card col-span-3 p-6">
          <div className="flex items-baseline justify-between">
            <h3 className="caps text-slate-400"><span className="mr-2 text-[var(--accent)]">{'//02'}</span>What’s left</h3>
            <span className="caps text-slate-500">{formatDuration(b.remainingMs)} of work / {formatDuration(Math.max(0, b.timeLeftMs))} until wrap-up</span>
          </div>
          {b.plan.length === 0 ? (
            <div className="mt-6 flex items-center gap-3 text-slate-400">
              <CheckCircle2 className="h-5 w-5 text-emerald-300" strokeWidth={1.5} /> Nothing left for today.
            </div>
          ) : (
            <>
              {/* now -> wrap-up bar with each remaining task */}
              <div className="relative mt-5 flex h-2 overflow-hidden rounded-full bg-white/[0.05]">
                {b.plan.map((p, i) => (
                  <div key={p.task.id} className="h-full border-r-2 border-slate-950" style={{ width: `${Math.min(100, (p.remainingMs / span) * 100)}%`, background: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'][i % 5] }} title={p.task.title} />
                ))}
              </div>
              <ul className="mt-4 divide-y divide-white/[0.05]">
                {b.plan.slice(0, 6).map((p, i) => (
                  <li key={p.task.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'][i % 5] }} />
                    <span className="caps w-28 shrink-0 tabular text-slate-500">{clock(p.startAt)}–{clock(p.endAt)}</span>
                    <span className={`truncate ${p.endAt > b.dayEnd ? 'text-amber-300' : 'text-slate-200'}`}>{p.task.title}</span>
                    <span className="ml-auto shrink-0 tabular text-slate-400">{formatDuration(p.remainingMs)}{!p.estimated && ' ?'}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* today timeline */}
      <div className="card mt-5 p-6">
        <h3 className="caps mb-6 text-slate-400"><span className="mr-2 text-[var(--accent)]">{'//03'}</span>Today’s timeline</h3>
        <Timeline tasks={tasks} segments={segments} day={today} settings={settings} now={now} showApps={Boolean(window.desktop)} />
      </div>

      {/* conversation */}
      <div className="card mt-5 p-6">
        <div className="flex items-baseline justify-between">
          <h3 className="caps text-slate-400"><span className="mr-2 text-[var(--accent)]">{'//04'}</span>{settings.assistantName || 'Atlas'} log</h3>
          <button className="caps text-slate-500 hover:text-slate-200" onClick={() => setCommandOpen(true)}>Open command bar · Ctrl K</button>
        </div>
        <ul className="mt-4 space-y-3">
          {messages.slice(-8).reverse().map((m) => (
            <li key={m.id} className="flex gap-3 text-sm">
              <span className="caps w-16 shrink-0 pt-0.5 tabular text-slate-600">{clock(m.at)}</span>
              <div className={`whitespace-pre-line ${m.from === 'you' ? 'text-slate-400' : 'text-slate-200'}`}>
                {m.from === 'you' ? `› ${m.text}` : m.text}
                {m.actions?.length > 0 && (
                  <div className="mt-2 flex gap-2">
                    {m.actions.map((a) => (
                      <button key={a.label} className="caps rounded-full border border-white/20 px-2.5 py-1 text-[9px] hover:border-white/60" onClick={() => executeCommand(a.command)}>
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
          {messages.length === 0 && <li className="text-sm text-slate-500">Briefings, nudges and your commands will show up here.</li>}
        </ul>
      </div>
    </div>
  );
}
