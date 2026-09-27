import { useEffect, useRef, useState } from 'react';
import { Mic, Square, ArrowUp, Smartphone, Laptop, Check, BellRing, Flame, Plus, Sun, CloudSun, CloudRain, Cloud, ChevronDown, KeyRound } from 'lucide-react';
import {
  buildBriefing,
  chatList,
  hostOnline,
  formatDuration,
  upcomingReminders,
  describeWhen,
  suggestRoutines,
  STARTER_TASKS,
  speechRecognition,
  useNow,
  visibleTasks,
  timer,
  PROVIDERS,
  MS_HOUR,
} from '@lifetracker/shared';
import { useStore } from '../config';
import { usePhoneBrain, askFromPhone, PHONE_PROVIDERS } from '../phoneBrain';

const clock = (ts) => new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const STATUS = {
  ahead: ['Ahead', 'border-emerald-300/40 text-emerald-300'],
  'on-track': ['On track', 'border-brand-300/40 text-brand-200'],
  behind: ['Behind', 'border-amber-300/40 text-amber-300'],
  done: ['All done', 'border-emerald-300/40 text-emerald-300'],
  idle: ['Nothing planned', 'border-white/15 text-slate-400'],
};
const TOOL_LABEL = { add_task: 'task added', start_task: 'timer started', pause_task: 'paused', complete_task: 'done', update_task: 'updated', delete_task: 'deleted', set_reminder: 'reminder set', cancel_reminder: 'cancelled', remember: 'remembered', forget: 'forgotten', update_settings: 'settings', open_website: 'opened on laptop', open_app: 'opened on laptop' };

function WeatherIcon({ code, className }) {
  const Icon = code == null ? CloudSun : code === 0 ? Sun : code <= 2 ? CloudSun : code === 3 ? Cloud : CloudRain;
  return <Icon className={className} strokeWidth={1.5} />;
}

function Hero({ b, now }) {
  const weather = usePhoneBrain((s) => s.weather?.data);
  const d = new Date(now);
  const [hm, ampm] = clock(now).split(' ');
  const [label, cls] = STATUS[b.status];
  return (
    <section className="pt-40">
      <div className="flex items-end gap-2" style={{ textShadow: '0 0 24px rgba(7,5,13,.9)' }}>
        <span className="font-display text-[68px] leading-[0.85] tabular">{hm}</span>
        <span className="font-display mb-1 text-xl">{ampm}</span>
      </div>
      <div className="caps mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-slate-300">
        <span>{d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
        {weather && (
          <span className="flex items-center gap-1">
            <WeatherIcon code={weather.code} className="h-3.5 w-3.5 text-[var(--accent)]" /> {weather.tempC}°
          </span>
        )}
        <span className={`rounded-full border px-2.5 py-0.5 ${cls}`}>{label}</span>
      </div>
      <p className="mt-3 text-lg leading-snug text-slate-100">
        {b.headline}
        {b.plan.length ? <span className="text-slate-400"> · done ≈ {clock(b.finishAt)}</span> : null}
      </p>
    </section>
  );
}

function Widgets({ b, now }) {
  const tasks = useStore((s) => s.tasks);
  const reminders = useStore((s) => s.reminders);
  const addTask = useStore((s) => s.addTask);
  const profile = usePhoneBrain((s) => s.profile);
  const r = b.report;
  const next = upcomingReminders(reminders, now)[0];
  const sug = profile ? suggestRoutines(tasks, profile, now) : [];
  const starters = sug.length ? sug.map((x) => ({ title: x.title, minutes: x.minutes })) : STARTER_TASKS.slice(0, 4);
  return (
    <div className="mt-5 grid grid-cols-2 gap-3">
      <div className="card p-4">
        <div className="caps text-slate-500">Focus</div>
        <div className="font-display mt-2 text-3xl tabular">{Math.round(r.goalProgress * 100)}%</div>
        <div className="mt-1 text-xs text-slate-400">{formatDuration(r.hoursWorked * MS_HOUR)} of {formatDuration(r.goalHours * MS_HOUR)}</div>
        <div className="mt-3 h-px bg-white/10">
          <div className="h-full bg-[var(--accent)]" style={{ width: `${r.goalProgress * 100}%` }} />
        </div>
        <div className={`mt-3 flex items-center gap-1 text-xs ${profile?.streak ? 'text-amber-300' : 'text-slate-500'}`}>
          <Flame className="h-3.5 w-3.5" strokeWidth={1.5} /> {profile?.streak ? `${profile.streak}-day streak` : 'No streak yet'}
        </div>
      </div>
      <div className="card p-4">
        <div className="caps text-slate-500">Up next</div>
        {b.plan[0] ? (
          <>
            <div className="mt-2 line-clamp-2 text-base leading-snug text-slate-100">{b.plan[0].task.title}</div>
            <div className="mt-1 text-xs text-slate-400">{formatDuration(b.plan[0].remainingMs)} · {b.plan.length - 1} more after</div>
          </>
        ) : (
          <div className="mt-2 text-sm text-slate-400">Nothing planned.</div>
        )}
        <div className="mt-3 flex items-center gap-1.5 text-xs text-cyan-300">
          <BellRing className="h-3.5 w-3.5" strokeWidth={1.5} />
          <span className="truncate">{next ? `${describeWhen(next.at, now)} · ${next.text}` : 'No reminders'}</span>
        </div>
      </div>
      {b.status === 'idle' && (
        <div className="card col-span-2 p-4">
          <div className="caps text-slate-500">{sug.length ? 'You usually do these today' : 'Quick start'}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {starters.map((s) => (
              <button key={s.title} onClick={() => addTask({ title: s.title, estimatedHours: s.minutes / 60 })} className="flex items-center gap-1 rounded-full border border-white/15 px-3 py-1.5 text-xs text-slate-200 active:scale-95">
                <Plus className="h-3 w-3" /> {s.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Chat() {
  const chat = useStore((s) => s.chat);
  const mode = usePhoneBrain((s) => s.mode);
  const name = useStore((s) => s.settings.assistantName) || 'Atlas';
  const list = chatList(chat).slice(-24);
  const endRef = useRef(null);
  const last = list[list.length - 1];
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [list.length, last?.status, mode]);

  return (
    <div className="mt-6 space-y-3">
      <div className="caps text-slate-400"><span className="mr-2 text-[var(--accent)]">{'//02'}</span>Conversation</div>
      {list.length === 0 && <div className="text-sm text-slate-500">Hi — I’m {name}. Tap the mic and talk to me, or type below.</div>}
      {list.map((m) => {
        const mine = m.role === 'user';
        const done = (m.actions || []).filter((a) => !a.includes('|'));
        return (
          <div key={m.id} className={`flex ${mine ? 'justify-end' : ''}`}>
            <div className={`max-w-[86%] ${mine ? 'text-right' : ''}`}>
              <div className={`inline-block whitespace-pre-line rounded-2xl px-3.5 py-2 text-left text-[15px] leading-relaxed ${mine ? 'bg-slate-50 text-slate-950' : m.status === 'error' ? 'border border-amber-300/30 text-amber-100' : 'border border-white/10 bg-slate-950/50 text-slate-100 backdrop-blur-sm'}`}>
                {m.text}
              </div>
              <div className={`caps mt-1 flex flex-wrap items-center gap-1.5 text-[9px] text-slate-600 ${mine ? 'justify-end' : ''}`}>
                {m.from === 'desktop' ? <Laptop className="h-2.5 w-2.5" /> : <Smartphone className="h-2.5 w-2.5" />}
                {clock(m.createdAt)}
                {m.status === 'pending' && ' · sent to laptop'}
                {m.status === 'working' && ' · thinking'}
                {done.map((a) => (
                  <span key={a} className="flex items-center gap-0.5 text-emerald-300/80"><Check className="h-2.5 w-2.5" /> {TOOL_LABEL[a] || a}</span>
                ))}
              </div>
            </div>
          </div>
        );
      })}
      {(mode === 'thinking' || mode === 'waiting') && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span className="flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent)]" style={{ animationDelay: `${i * 0.15}s` }} />)}</span>
          {mode === 'waiting' ? 'Asking your laptop…' : 'Thinking…'}
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}

function BrainCard() {
  const presence = useStore((s) => s.presence);
  const cfg = usePhoneBrain((s) => s.cfg);
  const setCfg = usePhoneBrain((s) => s.setCfg);
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const online = hostOnline(presence);
  const own = cfg.provider !== 'builtin';
  const p = PROVIDERS[cfg.provider] || PROVIDERS.builtin;
  const who = own ? `This phone · ${p.label.split(' — ')[0].split(' (')[0]}` : online ? `Your laptop${presence?.brain ? ` · ${presence.brain}` : ''}` : 'Built-in (laptop offline)';
  return (
    <div className="card mt-6 p-4">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-left">
        <span>
          <span className="caps block text-slate-500">Brain</span>
          <span className="mt-1 flex items-center gap-2 text-sm text-slate-200">
            <span className={`h-1.5 w-1.5 rounded-full ${own || online ? 'bg-emerald-300' : 'bg-slate-500'}`} /> {who}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-500 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-4 space-y-3 border-t border-white/[0.06] pt-4 text-sm">
          <p className="text-slate-400">
            By default your laptop answers (while the desktop app runs), using the AI you picked there. To use AI here even when the laptop is off, add a key for this phone — it stays on this phone only.
          </p>
          <select className="input" value={cfg.provider} onChange={(e) => setCfg({ provider: e.target.value, model: '', apiKey: '' })} aria-label="Phone brain">
            <option value="builtin">Use my laptop (recommended)</option>
            {PHONE_PROVIDERS.filter(([id]) => id !== 'builtin').map(([id, x]) => (
              <option key={id} value={id}>{x.label}</option>
            ))}
          </select>
          {own && (
            <>
              <div className="flex gap-2">
                <input className="input flex-1" type="password" placeholder={cfg.apiKey ? '•••••• saved' : 'API key'} value={key} onChange={(e) => setKey(e.target.value)} aria-label="Phone API key" autoComplete="off" />
                <button className="btn-soft !px-3 !py-2" disabled={!key.trim()} onClick={() => { setCfg({ apiKey: key.trim() }); setKey(''); }}>
                  <KeyRound className="h-4 w-4" /> Save
                </button>
              </div>
              <input className="input" placeholder={`Model (default ${p.model})`} value={cfg.model || ''} onChange={(e) => setCfg({ model: e.target.value.trim() })} aria-label="Phone model" />
              {p.keyUrl && <a className="text-xs text-brand-300 underline" href={p.keyUrl} target="_blank" rel="noreferrer">Get a free key</a>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Composer() {
  const [text, setText] = useState('');
  const mode = usePhoneBrain((s) => s.mode);
  const heard = usePhoneBrain((s) => s.heard);
  const setMode = usePhoneBrain((s) => s.setMode);
  const setHeard = usePhoneBrain((s) => s.setHeard);
  const tasks = useStore((s) => s.tasks);
  const today = useStore((s) => s.today);
  const name = useStore((s) => s.settings.assistantName) || 'Atlas';
  const recRef = useRef(null);
  const SR = speechRecognition();
  const busy = mode === 'thinking' || mode === 'waiting';
  const running = visibleTasks(tasks).find(timer.isRunning);
  const hasToday = visibleTasks(tasks).some((t) => t.date === today);
  const chips = [...(!hasToday ? ['Plan my day'] : running ? ['How long left?', 'Done'] : ["What's left?", 'Start next']), 'Remind me in 30 min to stretch', 'How was my week?'];

  const send = (v) => {
    const t = String(v || '').trim();
    if (!t || busy) return;
    setText('');
    askFromPhone(t);
  };

  const listen = () => {
    if (mode === 'listening') {
      recRef.current?.stop();
      return;
    }
    if (!SR) return;
    const rec = new SR();
    recRef.current = rec;
    rec.lang = navigator.language || 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = '';
    rec.onresult = (e) => {
      let t = '';
      for (let i = 0; i < e.results.length; i += 1) t += e.results[i][0].transcript;
      setHeard(t);
      if (e.results[e.results.length - 1].isFinal) finalText = t;
    };
    rec.onerror = () => {};
    rec.onend = () => {
      recRef.current = null;
      const said = (finalText || usePhoneBrain.getState().heard || '').trim();
      setHeard('');
      setMode('idle');
      if (said) send(said);
    };
    setHeard('');
    setMode('listening');
    try {
      navigator.vibrate?.(20);
    } catch {
      /* ignore */
    }
    rec.start();
  };

  return (
    <div className="safe-bottom fixed inset-x-0 bottom-[68px] z-20 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent px-4 pb-3 pt-6">
      <div className="mx-auto max-w-lg">
        {mode === 'listening' ? (
          <div className="mb-3 min-h-[28px] text-center text-lg text-cyan-200">{heard || 'Listening…'}</div>
        ) : (
          <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
            {chips.map((c) => (
              <button key={c} onClick={() => send(c)} className="shrink-0 rounded-full border border-white/10 bg-slate-950/60 px-3 py-1.5 text-xs text-slate-300 active:scale-95">
                {c}
              </button>
            ))}
          </div>
        )}
        <form
          className="flex items-center gap-2 rounded-full border border-white/15 bg-slate-900/90 p-1.5 backdrop-blur-md"
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
        >
          <button
            type="button"
            onClick={listen}
            disabled={!SR}
            aria-label={mode === 'listening' ? 'Stop listening' : 'Talk'}
            className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-slate-950 transition active:scale-95 disabled:opacity-30 ${mode === 'listening' ? 'bg-cyan-300' : 'bg-[var(--accent)]'}`}
          >
            {mode === 'listening' && <span className="absolute inset-0 animate-ping rounded-full bg-cyan-300/50" />}
            {mode === 'listening' ? <Square className="relative h-4 w-4" fill="currentColor" /> : <Mic className="relative h-5 w-5" />}
          </button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={busy ? `${name} is thinking…` : `Ask ${name}…`}
            className="min-w-0 flex-1 bg-transparent text-base text-slate-50 placeholder-slate-500 outline-none"
            aria-label="Message"
            enterKeyHint="send"
          />
          <button type="submit" disabled={!text.trim() || busy} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-950 disabled:opacity-20" aria-label="Send">
            <ArrowUp className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AssistantTab() {
  const now = useNow(1000);
  const tasks = useStore((s) => s.tasks);
  const today = useStore((s) => s.today);
  const settings = useStore((s) => s.settings);
  const user = useStore((s) => s.user);
  const name = (settings.displayName || user?.displayName || '').split(' ')[0];
  const b = buildBriefing({ tasks, today, settings, now, name });
  return (
    <div className="pb-40">
      <Hero b={b} now={now} />
      <Widgets b={b} now={now} />
      <Chat />
      <BrainCard />
      <Composer />
    </div>
  );
}
