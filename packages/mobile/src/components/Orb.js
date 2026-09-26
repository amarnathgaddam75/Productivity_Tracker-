import { useEffect, useRef } from 'react';
import { useOrb } from '@lifetracker/shared';

/** WebGL particle body (see @lifetracker/shared/orb); falls back to a soft glow. */
export default function Orb({ state, count = 22000, scale = 0.8, point = 1.6, className = '', burstKey }) {
  const canvasRef = useRef(null);
  const { orbRef, supported } = useOrb(canvasRef, { count, scale, point, interactive: true });
  const key = JSON.stringify(state);
  useEffect(() => {
    orbRef.current?.set(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, supported]);
  useEffect(() => {
    if (burstKey) orbRef.current?.burst();
  }, [burstKey, orbRef]);
  return (
    <div className={`pointer-events-none ${/\b(absolute|fixed)\b/.test(className) ? '' : 'relative'} ${className}`} aria-hidden="true">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {!supported && (
        <div
          className="absolute left-1/2 top-1/2 h-3/5 w-3/5 -translate-x-1/2 -translate-y-1/2 rounded-full blur-sm"
          style={{ background: `radial-gradient(circle at 45% 40%, #fff, ${state?.color || '#a78bfa'} 35%, transparent 70%)`, opacity: 0.6 }}
        />
      )}
    </div>
  );
}
