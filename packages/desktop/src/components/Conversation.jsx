import { useEffect, useRef } from 'react';
import { Smartphone, Check } from 'lucide-react';
import { chatList } from '@lifetracker/shared';
import { useStore } from '../config.js';
import { useAssistant } from '../assistant/state.js';
import { ask, executeCommand } from '../assistant/runtime.js';

const clock = (ts) => new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const TOOL_LABEL = {
  add_task: 'task added', start_task: 'timer started', pause_task: 'timer paused', complete_task: 'task done', update_task: 'task updated',
  delete_task: 'task deleted', set_reminder: 'reminder set', cancel_reminder: 'reminder cancelled', remember: 'remembered', forget: 'forgotten',
  update_settings: 'settings changed', open_website: 'opened', open_app: 'app opened',
};

export function Thinking({ label = 'Thinking' }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-400">
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent)]" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </span>
      {label}…
    </div>
  );
}

/** The synced conversation (laptop + phone), newest at the bottom. */
export default function Conversation({ max = 30, className = '', empty }) {
  const chat = useStore((s) => s.chat);
  const mode = useAssistant((s) => s.mode);
  const name = useStore((s) => s.settings.assistantName) || 'Atlas';
  const ref = useRef(null);
  const list = chatList(chat).slice(-max);
  const last = list[list.length - 1];

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [list.length, last?.status, mode]);

  const run = (command) => (command.startsWith('__') ? ask(command) : executeCommand(command));

  return (
    <div ref={ref} className={`space-y-3 overflow-y-auto pr-1 ${className}`} aria-live="polite">
      {list.length === 0 && (empty || <div className="text-sm text-slate-500">Hi — I’m {name}. Ask me anything, or tell me what to do.</div>)}
      {list.map((m) => {
        const mine = m.role === 'user';
        const buttons = (m.actions || []).filter((a) => a.includes('|'));
        const done = (m.actions || []).filter((a) => !a.includes('|'));
        return (
          <div key={m.id} className={`flex ${mine ? 'justify-end' : ''}`}>
            <div className={`max-w-[88%] ${mine ? 'text-right' : ''}`}>
              <div
                className={`inline-block whitespace-pre-line rounded-2xl px-3.5 py-2 text-left text-[15px] leading-relaxed ${
                  mine
                    ? 'bg-slate-50 text-slate-950'
                    : m.status === 'error'
                      ? 'border border-amber-300/30 bg-amber-300/[0.04] text-amber-100'
                      : 'border border-white/10 bg-slate-950/40 text-slate-100 backdrop-blur-sm'
                }`}
              >
                {m.text}
                {buttons.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {buttons.map((a) => {
                      const [label, command] = a.split('|');
                      return (
                        <button key={a} onClick={() => run(command)} className="caps rounded-full border border-white/25 px-2.5 py-1 text-[9px] text-slate-100 hover:border-white/70">
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className={`caps mt-1 flex items-center gap-2 text-[9px] text-slate-600 ${mine ? 'justify-end' : ''}`}>
                {m.from === 'phone' && <Smartphone className="h-2.5 w-2.5" />}
                {clock(m.createdAt)}
                {m.status === 'pending' && ' · waiting'}
                {done.map((a) => (
                  <span key={a} className="flex items-center gap-1 text-emerald-300/80">
                    <Check className="h-2.5 w-2.5" /> {TOOL_LABEL[a] || a.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          </div>
        );
      })}
      {mode === 'thinking' && <Thinking />}
    </div>
  );
}
