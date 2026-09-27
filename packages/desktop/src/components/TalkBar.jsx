import { useEffect, useRef, useState } from 'react';
import { Mic, Square, ArrowUp } from 'lucide-react';
import { canTranscribe, visibleTasks, timer } from '@lifetracker/shared';
import { useStore } from '../config.js';
import { useAssistant } from '../assistant/state.js';
import { ask, listen } from '../assistant/runtime.js';

/** Context-aware quick prompts. */
export function useSuggestions() {
  const tasks = useStore((s) => s.tasks);
  const today = useStore((s) => s.today);
  const city = useStore((s) => s.settings.city);
  const list = visibleTasks(tasks).filter((t) => t.date === today);
  const running = list.find(timer.isRunning);
  const out = [];
  if (!list.length) out.push('Plan my day', 'Add deep work 2h');
  else if (running) out.push('How much time is left?', 'Pause', 'Done');
  else out.push("What's left?", 'Start next');
  out.push('Remind me in 30 min to stretch', 'How was my week?');
  if (city) out.push("What's the weather?");
  out.push('What do you know about me?');
  return out;
}

export default function TalkBar({ autoFocus = false, compact = false }) {
  const [text, setText] = useState('');
  const [hist, setHist] = useState([]);
  const [hIdx, setHIdx] = useState(-1);
  const mode = useAssistant((s) => s.mode);
  const level = useAssistant((s) => s.level);
  const brain = useAssistant((s) => s.brain);
  const name = useStore((s) => s.settings.assistantName) || 'Atlas';
  const suggestions = useSuggestions();
  const inputRef = useRef(null);
  const listening = mode === 'listening';

  useEffect(() => {
    if (autoFocus) setTimeout(() => inputRef.current?.focus(), 30);
  }, [autoFocus]);

  const send = (value) => {
    const v = String(value || '').trim();
    if (!v || mode === 'thinking') return;
    setHist((h) => [v, ...h.filter((x) => x !== v)].slice(0, 30));
    setHIdx(-1);
    setText('');
    ask(v);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowUp' && hist.length && !text.includes('\n')) {
      e.preventDefault();
      const i = Math.min(hist.length - 1, hIdx + 1);
      setHIdx(i);
      setText(hist[i]);
    }
    if (e.key === 'ArrowDown' && hIdx >= 0) {
      e.preventDefault();
      const i = hIdx - 1;
      setHIdx(i);
      setText(i < 0 ? '' : hist[i]);
    }
  };

  return (
    <div>
      {!compact && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button key={s} onClick={() => send(s)} className="rounded-full border border-white/10 bg-slate-950/30 px-3 py-1 text-xs text-slate-300 backdrop-blur-sm transition hover:border-white/40 hover:text-slate-50">
              {s}
            </button>
          ))}
        </div>
      )}
      <form
        className="flex items-center gap-3 rounded-full border border-white/15 bg-slate-950/60 py-1.5 pl-1.5 pr-2 backdrop-blur-md focus-within:border-white/40"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <button
          type="button"
          onClick={listen}
          title={canTranscribe(brain) ? 'Talk (Ctrl+Shift+J)' : 'Voice needs Gemini or Groq — Settings → Brain'}
          aria-label={listening ? 'Stop listening' : 'Talk'}
          className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition ${listening ? 'bg-cyan-300 text-slate-950' : 'bg-[var(--accent)] text-slate-950 hover:brightness-110'}`}
        >
          {listening && <span className="absolute inset-0 rounded-full bg-cyan-300/40" style={{ transform: `scale(${1.15 + level * 0.9})`, transition: 'transform 80ms' }} />}
          {listening ? <Square className="relative h-4 w-4" fill="currentColor" /> : <Mic className="relative h-5 w-5" />}
        </button>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={listening ? 'Listening… speak now' : mode === 'thinking' ? `${name} is thinking…` : `Ask ${name} anything, or tell ${name} what to do`}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-slate-50 placeholder-slate-500 outline-none"
          aria-label="Command"
        />
        <button type="submit" disabled={!text.trim() || mode === 'thinking'} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-950 transition disabled:opacity-20" aria-label="Send">
          <ArrowUp className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
