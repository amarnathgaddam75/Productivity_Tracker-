import { useEffect } from 'react';
import { useStore } from '../config.js';
import { useAssistant } from '../assistant/state.js';
import { brainLabel } from '@lifetracker/shared';
import Conversation from './Conversation.jsx';
import TalkBar from './TalkBar.jsx';

/** Spotlight-style assistant: Ctrl+K in the app, Ctrl+Shift+Space from anywhere. */
export default function CommandBar() {
  const open = useAssistant((s) => s.commandOpen);
  const setOpen = useAssistant((s) => s.setCommandOpen);
  const brain = useAssistant((s) => s.brain);
  const name = useStore((s) => s.settings.assistantName) || 'Atlas';

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!useAssistant.getState().commandOpen);
      }
      if (e.key === 'Escape' && useAssistant.getState().commandOpen) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 pt-[10vh] backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="w-full max-w-2xl animate-slide-in overflow-hidden rounded-3xl border border-white/10 bg-slate-900/95 p-5 shadow-2xl">
        <div className="caps mb-4 flex items-center justify-between text-slate-500">
          <span>
            <span className="text-[var(--accent)]">{name}</span> · {brainLabel(brain)}
          </span>
          <span>esc</span>
        </div>
        <Conversation max={16} className="max-h-[44vh] pb-2" />
        <div className="mt-4">
          <TalkBar autoFocus />
        </div>
      </div>
    </div>
  );
}
