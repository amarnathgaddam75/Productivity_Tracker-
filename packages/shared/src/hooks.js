import { useEffect, useState } from 'react';

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
