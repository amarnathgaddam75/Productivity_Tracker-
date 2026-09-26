import { useEffect, useRef, useState } from 'react';
import { CornerDownLeft, Sparkles } from 'lucide-react';
import { useStore } from '../config.js';
import { useAssistant } from '../assistant/state.js';
import { executeCommand } from '../assistant/runtime.js';

const SUGGESTIONS = ["what's left", 'status', 'start', 'pause', 'done', 'add ', 'report', 'help'];

/** Spotlight-style command bar: Ctrl+K in the app, Ctrl+Shift+Space from anywhere. */
export default function CommandBar() {
  const open = useAssistant((s) => s.commandOpen);
  const setOpen = useAssistant((s) => s.setCommandOpen);
  const messages = useAssistant((s) => s.messages);
  const name = useStore((s) => s.settings.assistantName) || 'Atlas';
  const [text, setText] = useState('');
  const [hist, setHist] = useState([]);
  const [hIdx, setHIdx] = useState(-1);
  const inputRef = useRef(null);
  const logRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!useAssistant.getState().commandOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight);
  }, [messages, open]);

  if (!open) return null;

  const run = (value) => {
    const v = value.trim();
    if (!v) return;
    executeCommand(v);
    setHist((h) => [v, ...h.filter((x) => x !== v)].slice(0, 30));
    setHIdx(-1);
    setText('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') setOpen(false);
    if (e.key === 'ArrowUp' && hist.length) {
      e.preventDefault();
      const i = Math.min(hist.length - 1, hIdx + 1);
      setHIdx(i);
      setText(hist[i]);
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const i = Math.max(-1, hIdx - 1);
      setHIdx(i);
      setText(i < 0 ? '' : hist[i]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 pt-[12vh] backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="w-full max-w-2xl animate-slide-in overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl">
        <div ref={logRef} className="max-h-[42vh] space-y-3 overflow-y-auto px-5 pt-5">
          {messages.slice(-12).map((m) => (
            <div key={m.id} className={`flex ${m.from === 'you' ? 'justify-end' : ''}`}>
              <div className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-sm ${m.from === 'you' ? 'bg-slate-50 text-slate-950' : 'border border-white/10 text-slate-200'}`}>
                {m.text}
                {m.actions?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.actions.map((a) => (
                      <button key={a.label} onClick={() => run(a.command)} className="caps rounded-full border border-white/20 px-2.5 py-1 text-[9px] text-slate-200 hover:border-white/60">
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {messages.length === 0 && <div className="pb-2 text-sm text-slate-400">Hi — I’m {name}. Ask me what’s left, or tell me to start, pause or add something.</div>}
        </div>
        <div className="flex flex-wrap gap-1.5 px-5 pt-4">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => (s.endsWith(' ') ? (setText(s), inputRef.current?.focus()) : run(s))} className="caps rounded-full border border-white/10 px-2.5 py-1 text-[9px] text-slate-400 hover:border-white/40 hover:text-slate-100">
              {s.trim()}
            </button>
          ))}
        </div>
        <form
          className="mt-4 flex items-center gap-3 border-t border-white/10 px-5 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(text);
          }}
        >
          <Sparkles className="h-4 w-4 text-[var(--accent)]" strokeWidth={1.5} />
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={`Ask ${name}… e.g. “add write report 2h”, “start report”, “what’s left”`}
            className="flex-1 bg-transparent text-base text-slate-50 placeholder-slate-500 outline-none"
            aria-label="Command"
          />
          <span className="caps flex items-center gap-1 text-slate-500">
            <CornerDownLeft className="h-3 w-3" /> enter · esc
          </span>
        </form>
      </div>
    </div>
  );
}
