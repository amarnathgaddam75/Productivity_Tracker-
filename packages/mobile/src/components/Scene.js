import { useEffect, useRef, useState } from 'react';
import { activeTimer, sceneOrbState, useNow, buildBriefing } from '@lifetracker/shared';
import { usePhoneBrain } from '../phoneBrain';
import { useStore } from '../config';
import Orb from './Orb';

const TAB_VIEW = { assistant: 'assistant', now: 'tasks', summary: 'reports', alerts: 'alerts' };

function hexToTriplet(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/** Full-screen particle body behind the phone app; follows the tab and the timer. */
export default function Scene({ tab }) {
  const now = useNow(1000);
  const tasks = useStore((s) => s.tasks);
  const today = useStore((s) => s.today);
  const settings = useStore((s) => s.settings);
  const mode = usePhoneBrain((s) => s.mode);
  const info = activeTimer(tasks, today, now);
  const status = tab === 'assistant' ? buildBriefing({ tasks, today, settings, now }).status : null;
  const orbMode = mode === 'waiting' ? 'thinking' : mode;
  const state = { ...sceneOrbState(TAB_VIEW[tab] || 'tasks', info, { status, mode: orbMode }), offset: [0, 0.5] };

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
        style={{ background: 'radial-gradient(60vmax 50vmax at 50% 24%, rgba(var(--glow), 0.22), transparent 70%)' }}
        aria-hidden="true"
      />
      <Orb state={state} burstKey={burst} count={32000} scale={0.5} point={1.5} className="fixed inset-0 z-0" />
    </>
  );
}
