import { useEffect, useRef, useState } from 'react';
import { activeTimer, sceneOrbState, useNow, buildBriefing } from '@lifetracker/shared';
import { useAssistant } from '../assistant/state.js';
import { useStore } from '../config.js';
import { Orb } from './ui.jsx';

function hexToTriplet(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/**
 * Full-screen particle body behind the whole app (like the landing page).
 * Its shape and colour follow the current view and the timer; completing a
 * task kicks the particles outward.
 */
export default function Scene({ view, offset = [0.42, 0] }) {
  const now = useNow(1000);
  const tasks = useStore((s) => s.tasks);
  const today = useStore((s) => s.today);
  const settings = useStore((s) => s.settings);
  const speaking = useAssistant((s) => s.speaking);
  const info = activeTimer(tasks, today, now);
  const status = view === 'assistant' ? buildBriefing({ tasks, today, settings, now }).status : null;
  const state = { ...sceneOrbState(view, info, { status, speaking }), offset };

  // Burst when a task gets completed.
  const [burst, setBurst] = useState(0);
  const lastDone = useRef(null);
  const latestDone = Object.values(tasks).reduce((m, t) => (t?.completed && !t.deleted && (t.completedAt || 0) > m ? t.completedAt : m), 0);
  useEffect(() => {
    if (lastDone.current !== null && latestDone > lastDone.current) setBurst((n) => n + 1);
    lastDone.current = latestDone;
  }, [latestDone]);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', state.color);
    document.documentElement.style.setProperty('--glow', hexToTriplet(state.color));
  }, [state.color]);

  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 z-0 transition-[background] duration-1000"
        style={{
          background:
            'radial-gradient(38vmax 38vmax at 71% 50%, rgba(var(--glow), 0.22), transparent 70%), radial-gradient(90vmax 70vmax at 60% 50%, rgba(var(--glow), 0.07), transparent 70%)',
        }}
        aria-hidden="true"
      />
      <Orb state={state} burstKey={burst} count={90000} scale={0.7} point={2} className="fixed inset-0 z-0" />
    </>
  );
}
