import { useEffect, useRef } from 'react';
import { useOrb } from '@lifetracker/shared';

export function Logo({ className = '', sub = 'Productivity tracker' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 text-[9px] font-medium tracking-[0.08em]">LT</div>
      <div className="min-w-0 leading-tight">
        <div className="caps text-slate-100">LifeTracker</div>
        {sub && <div className="caps truncate text-slate-500">{sub}</div>}
      </div>
    </div>
  );
}

/**
 * WebGL particle body (see @lifetracker/shared/orb). `state` is eased in:
 * { shape, color, energy, brightness }. Falls back to a soft CSS glow.
 */
export function Orb({ state, count = 45000, scale = 0.8, point = 2, className = '', burstKey }) {
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

export function Splash() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="animate-pulse">
        <Logo />
      </div>
    </div>
  );
}

/** Circular progress indicator (0..1). */
export function ProgressRing({ value, size = 120, stroke = 3, className = '', children, color = 'text-brand-300' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={1} className="fill-none stroke-white/10" />
        {v > 0.005 && <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          className={`fill-none stroke-current transition-[stroke-dashoffset] duration-700 ${color}`}
        />}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export function ProgressBar({ value, className = '', over = false }) {
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div className={`h-px w-full overflow-hidden bg-white/10 ${className}`}>
      <div
        className={`h-full transition-all duration-500 ${over ? 'bg-rose-400' : v >= 0.85 ? 'bg-amber-300' : 'bg-brand-300'}`}
        style={{ width: `${v * 100}%` }}
      />
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, sub, index, accent = 'text-brand-300' }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="caps text-slate-400">
          {index && <span className={`mr-2 ${accent}`}>{'//'}{index}</span>}
          {label}
        </span>
        <Icon className={`h-4 w-4 ${accent}`} strokeWidth={1.5} />
      </div>
      <div className="font-display mt-4 text-4xl tabular">{value}</div>
      {sub && <div className="mt-2 text-sm text-slate-400">{sub}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 text-slate-400">
        <Icon className="h-5 w-5" strokeWidth={1.5} />
      </div>
      <div className="caps text-slate-200">{title}</div>
      <div className="mt-2 max-w-sm text-sm text-slate-500">{children}</div>
    </div>
  );
}
