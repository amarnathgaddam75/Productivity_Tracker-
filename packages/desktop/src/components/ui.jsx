import { Timer } from 'lucide-react';

export function Logo({ className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 text-white shadow-lg shadow-brand-500/30">
        <Timer className="h-5 w-5" />
      </div>
      <span className="text-lg font-semibold tracking-tight">LifeTracker</span>
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
export function ProgressRing({ value, size = 120, stroke = 10, className = '', children, color = 'text-brand-500' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-slate-200 dark:stroke-slate-800" />
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
    <div className={`h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800 ${className}`}>
      <div
        className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-rose-500' : v >= 0.85 ? 'bg-amber-500' : 'bg-brand-500'}`}
        style={{ width: `${v * 100}%` }}
      />
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, sub, accent = 'text-brand-500 bg-brand-500/10' }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${accent}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight tabular">{value}</div>
      {sub && <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{sub}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
        <Icon className="h-6 w-6" />
      </div>
      <div className="font-medium">{title}</div>
      <div className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{children}</div>
    </div>
  );
}
