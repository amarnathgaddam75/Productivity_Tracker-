import { Play, Monitor, Moon, Flame, Plus, X, BellRing, Brain, Sun, CloudSun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog, Lightbulb } from 'lucide-react';
import {
  buildBriefing,
  formatDuration,
  useNow,
  upcomingReminders,
  describeWhen,
  suggestRoutines,
  STARTER_TASKS,
  brainLabel,
  MS_HOUR,
} from '@lifetracker/shared';
import { useStore } from '../config.js';
import { useAssistant } from '../assistant/state.js';
import { executeCommand } from '../assistant/runtime.js';
import Timeline, { SERIES } from './Timeline.jsx';
import Conversation from './Conversation.jsx';
import TalkBar from './TalkBar.jsx';
import { ProgressRing } from './ui.jsx';

const clock = (ts) => new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const STATUS = {
  ahead: { label: 'Ahead of schedule', cls: 'border-emerald-300/40 text-emerald-300' },
  'on-track': { label: 'On track', cls: 'border-brand-300/40 text-brand-200' },
  behind: { label: 'Behind schedule', cls: 'border-amber-300/40 text-amber-300' },
  done: { label: 'All done', cls: 'border-emerald-300/40 text-emerald-300' },
  idle: { label: 'Nothing planned', cls: 'border-white/15 text-slate-400' },
};

function WeatherIcon({ code, className }) {
  const Icon = code == null ? CloudSun : code === 0 ? Sun : code <= 2 ? CloudSun : code === 3 ? Cloud : code <= 48 ? CloudFog : code >= 95 ? CloudLightning : code >= 71 && code <= 86 && !(code >= 80 && code <= 82) ? CloudSnow : CloudRain;
  return <Icon className={className} strokeWidth={1.5} />;
}

const Title = ({ n, children, right }) => (
  <div className="mb-4 flex items-baseline justify-between gap-3">
    <h3 className="caps text-slate-400">
      <span className="mr-2 text-[var(--accent)]">{`//${n}`}</span>
      {children}
    </h3>
    {right}
  </div>
);

function Hero({ b, now }) {
  const name = useStore((s) => s.settings.assistantName) || 'Atlas';
  const brain = useAssistant((s) => s.brain);
  const mode = useAssistant((s) => s.mode);
  const weather = useAssistant((s) => s.weather);
  const d = new Date(now);
  const [hm, ampm] = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).split(' ');
  const shadow = { textShadow: '0 0 30px rgba(7,5,13,.85)' };
  const st = STATUS[b.status];
  const modeLabel = { listening: 'Listening', thinking: 'Thinking', speaking: 'Speaking' }[mode] || 'Online';
  return (
    <section className="max-w-3xl">
      <p className="caps flex items-center gap-2 text-slate-400">
        <span className="text-[var(--accent)]">{'//01'}</span> {name}
        <span className={`ml-1 h-1.5 w-1.5 rounded-full ${mode === 'idle' ? 'bg-emerald-300' : 'animate-pulse bg-[var(--accent)]'}`} />
        {modeLabel} · {brainLabel(brain)}
      </p>
      <div className="mt-2 flex items-end gap-4" style={shadow}>
        <div className="font-display text-[120px] leading-[0.85] tabular">{hm}</div>
        <div className="mb-2">
          <div className="font-display text-3xl leading-none">{ampm}</div>
          <div className="caps mt-2 tabular text-slate-500">{String(d.getSeconds()).padStart(2, '0')}s</div>
        </div>
      </div>
      <div className="caps mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-slate-300">
        <span>{d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
        {weather && (
          <span className="flex items-center gap-1.5" title={weather.place}>
            <WeatherIcon code={weather.code} className="h-3.5 w-3.5 text-[var(--accent)]" /> {weather.tempC}° {weather.description}
          </span>
        )}
        <span className={`rounded-full border px-3 py-1 ${st.cls}`}>{st.label}</span>
      </div>
      <p className="mt-6 text-2xl leading-snug text-slate-100" style={shadow}>
        {b.greeting}. <span className="text-slate-400">{b.headline}{b.plan.length ? ` — done ≈ ${clock(b.finishAt)}` : ''}.</span>
      </p>
    </section>
  );
}

function FocusCard({ b }) {
  const profile = useAssistant((s) => s.profile);
  const r = b.report;
  const pct = Math.round(r.goalProgress * 100);
  return (
    <div className="card flex items-center gap-6 bg-slate-950/75 p-6 backdrop-blur-md">
      <ProgressRing value={r.goalProgress} size={128} stroke={4} color="text-[var(--accent)]">
        <div className="font-display text-3xl tabular">{pct}%</div>
        <div className="caps text-[9px] text-slate-500">of goal</div>
      </ProgressRing>
      <div className="min-w-0 space-y-2 text-sm">
        <div className="caps text-slate-400">
          <span className="mr-2 text-[var(--accent)]">{'//03'}</span>Focus
        </div>
        <div className="text-slate-100">
          {formatDuration(r.hoursWorked * MS_HOUR)} <span className="text-slate-500">/ {formatDuration(r.goalHours * MS_HOUR)}</span>
        </div>
        <div className="text-slate-400">
          {r.completedTasks}/{r.totalTasks} tasks · score {r.productivityScore}%
        </div>
        <div className={`flex items-center gap-1.5 ${profile?.streak ? 'text-amber-300' : 'text-slate-500'}`}>
          <Flame className="h-4 w-4" strokeWidth={1.5} />
          {profile?.streak ? `${profile.streak}-day streak` : 'Focus 1h today to start a streak'}
        </div>
      </div>
    </div>
  );
}

function UpNext({ b }) {
  const tasks = useStore((s) => s.tasks);
  const addTask = useStore((s) => s.addTask);
  const profile = useAssistant((s) => s.profile);
  const suggestions = profile ? suggestRoutines(tasks, profile, Date.now()) : [];
  const starters = suggestions.length ? suggestions.map((r) => ({ title: r.title, minutes: r.minutes, learned: true })) : STARTER_TASKS;
  return (
    <div className="card bg-slate-950/75 p-6 backdrop-blur-md">
      <Title n="04" right={b.plan.length > 0 && <span className="caps text-slate-500">{formatDuration(b.remainingMs)} left</span>}>
        Up next
      </Title>
      {b.plan.length > 0 && (
        <ul className="space-y-2.5">
          {b.plan.slice(0, 4).map((p, i) => (
            <li key={p.task.id} className="flex items-center gap-3 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: SERIES[i % SERIES.length] }} />
              <span className={`min-w-0 flex-1 truncate ${p.endAt > b.dayEnd ? 'text-amber-300' : 'text-slate-100'}`}>{p.task.title}</span>
              <span className="caps shrink-0 tabular text-slate-500">{clock(p.startAt)}</span>
              {i === 0 && !b.running && (
                <button onClick={() => executeCommand(`start ${p.task.title}`)} className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50 text-slate-950" aria-label={`Start ${p.task.title}`}>
                  <Play className="h-3 w-3" fill="currentColor" />
                </button>
              )}
            </li>
          ))}
          {b.plan.length > 4 && <li className="caps text-slate-500">+ {b.plan.length - 4} more</li>}
        </ul>
      )}
      {b.plan.length === 0 && (
        <>
          <p className="text-sm text-slate-400">{b.status === 'done' ? 'Everything is done. Add something for later?' : suggestions.length ? 'You usually do these today — tap to add:' : 'Nothing planned yet. Quick start:'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {starters.map((s) => (
              <button key={s.title} onClick={() => addTask({ title: s.title, estimatedHours: s.minutes / 60 })} className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs text-slate-200 transition hover:border-white/50">
                <Plus className="h-3 w-3" /> {s.title} · {formatDuration(s.minutes * 60000)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Reminders({ now }) {
  const reminders = useStore((s) => s.reminders);
  const cancel = useStore((s) => s.cancelReminder);
  const setOpen = useAssistant((s) => s.setCommandOpen);
  const list = upcomingReminders(reminders, now).slice(0, 4);
  return (
    <div className="card bg-slate-950/75 p-6 backdrop-blur-md">
      <Title n="05">Reminders</Title>
      {list.length === 0 ? (
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 text-left text-sm text-slate-500 hover:text-slate-300">
          <BellRing className="h-4 w-4" strokeWidth={1.5} /> Say “remind me at 5 to call mom”.
        </button>
      ) : (
        <ul className="space-y-2.5">
          {list.map((r) => (
            <li key={r.id} className="group flex items-center gap-3 text-sm">
              <BellRing className="h-3.5 w-3.5 shrink-0 text-cyan-300" strokeWidth={1.5} />
              <span className="min-w-0 flex-1 truncate text-slate-100">{r.text}</span>
              <span className="caps shrink-0 text-slate-500">{describeWhen(r.at, now)}</span>
              <button onClick={() => cancel(r.id)} className="text-slate-600 opacity-0 transition hover:text-slate-200 group-hover:opacity-100" aria-label={`Cancel ${r.text}`}>
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Insights() {
  const profile = useAssistant((s) => s.profile);
  const memories = useStore((s) => s.memories);
  const known = Object.values(memories).filter((m) => !m.deleted).length;
  return (
    <div className="card bg-slate-950/75 p-6 backdrop-blur-md">
      <Title n="06" right={<span className="caps flex items-center gap-1.5 text-slate-500"><Brain className="h-3 w-3" /> {known} memories</span>}>
        What I’ve learned
      </Title>
      {profile?.insights?.length ? (
        <ul className="space-y-2 text-sm text-slate-300">
          {profile.insights.slice(0, 4).map((i) => (
            <li key={i} className="flex gap-2">
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" strokeWidth={1.5} /> {i}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">I learn your rhythm as you track: when you start, your best hours, how long things really take. Insights appear after a few days.</p>
      )}
    </div>
  );
}

function RightNow({ b }) {
  const activity = useAssistant((s) => s.activity);
  return (
    <div className="card bg-slate-950/75 p-6 backdrop-blur-md">
      <Title n="07">Right now</Title>
      <div className="flex items-center gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 text-slate-300">
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
              : b.running
                ? `Timer: ${b.running.title}`
                : activity?.title || 'No timer running'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AssistantView() {
  const now = useNow(1000);
  const tasks = useStore((s) => s.tasks);
  const today = useStore((s) => s.today);
  const settings = useStore((s) => s.settings);
  const user = useStore((s) => s.user);
  const segments = useAssistant((s) => s.segments);
  const firstName = (settings.displayName || user?.displayName || '').split(' ')[0];
  const b = buildBriefing({ tasks, today, settings, now, name: firstName });

  return (
    <div>
      <Hero b={b} now={now} />

      <div className="mt-12 grid grid-cols-12 gap-5">
        <div className="card col-span-7 flex flex-col p-6">
          <Title n="02">Talk</Title>
          <Conversation max={30} className="h-[360px]" />
          <div className="mt-4">
            <TalkBar />
          </div>
        </div>
        <div className="col-span-5 space-y-5">
          <FocusCard b={b} />
          <UpNext b={b} />
          <Reminders now={now} />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-12 gap-5">
        <div className="col-span-7">
          <Insights />
        </div>
        <div className="col-span-5">
          <RightNow b={b} />
        </div>
      </div>

      <div className="card mt-5 p-6">
        <Title n="08">Today’s timeline</Title>
        <Timeline tasks={tasks} segments={segments} day={today} settings={settings} now={now} showApps={Boolean(window.desktop)} />
      </div>
    </div>
  );
}
