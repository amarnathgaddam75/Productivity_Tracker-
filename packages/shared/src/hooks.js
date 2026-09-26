import { useEffect, useRef, useState } from 'react';
import { createOrb } from './orb.js';

/** Re-renders every `intervalMs` and returns the current time. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Binds auth + runs the store heartbeat (rollover, notifications, summaries). */
export function useTrackerLifecycle(useStore) {
  useEffect(() => useStore.getState().bindAuth(), [useStore]);
  useEffect(() => {
    const id = setInterval(() => useStore.getState().tick(), 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        useStore.getState().tick();
        useStore.getState().syncNow();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [useStore]);
}

/**
 * Mount a particle orb on a canvas ref. Returns a ref holding the orb (or null
 * when WebGL is unavailable). The orb is created once and destroyed on unmount.
 */
export function useOrb(canvasRef, options) {
  const orbRef = useRef(null);
  const [supported, setSupported] = useState(true);
  useEffect(() => {
    if (!canvasRef.current) return undefined;
    let orb = null;
    try {
      orb = createOrb(canvasRef.current, options);
    } catch (err) {
      console.warn('[orb] WebGL unavailable', err);
    }
    orbRef.current = orb;
    setSupported(Boolean(orb));
    return () => {
      orb?.destroy();
      orbRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef]);
  return { orbRef, supported };
}

/** Orb look for a timer, derived from the task's state. */
export function timerOrbState({ running, warn, over, hasTask }) {
  if (!hasTask) return { shape: 'sphere', color: '#a78bfa', energy: 0.2, brightness: 0.55 };
  if (!running) return { shape: 'sphere', color: '#c7d2fe', energy: 0.12, brightness: 0.6 };
  if (over) return { shape: 'ring', color: '#fb7185', energy: 1, brightness: 1.1 };
  if (warn) return { shape: 'ring', color: '#fbbf24', energy: 0.9, brightness: 1 };
  return { shape: 'ring', color: '#a78bfa', energy: 0.85, brightness: 1 };
}
