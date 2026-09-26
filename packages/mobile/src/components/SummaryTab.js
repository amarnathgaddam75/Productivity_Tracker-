import { useMemo, useState } from 'react';
import { CheckCircle2, Clock, Gauge, Zap, Shuffle } from 'lucide-react';
import { computeDailyReport, reportWithMessage, formatDuration, scoreLabel, efficiencyLabel, useNow, MS_HOUR } from '@lifetracker/shared';
import { useStore } from '../config';

const hrs = (h) => formatDuration(h * MS_HOUR);

function Stat({ icon: Icon, label, value, sub, cls }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${cls}`}><Icon className="h-4 w-4" /></span>
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular">{value}</div>
      <div className="truncate text-xs text-slate-500">{sub}</div>
    </div>
  );
}

export default function SummaryTab() {
  const now = useNow(15000);
  const tasks = useStore((s) => s.tasks);
  const today = useStore((s) => s.today);
  const goalHours = useStore((s) => s.settings.dailyGoalHours);
  const [seed, setSeed] = useState(0);
  const r = useMemo(() => reportWithMessage(computeDailyReport(tasks, today, { goalHours, now }), `${today}:${seed}`), [tasks, today, goalHours, now, seed]);

  const size = 150;
  const stroke = 12;
  const rad = (size - stroke) / 2;
  const c = 2 * Math.PI * rad;

  return (
    <div className="space-y-4">
      <div className="card flex items-center gap-5 p-5">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={rad} strokeWidth={stroke} className="fill-none stroke-slate-200 dark:stroke-slate-800" />
            {r.goalProgress > 0.005 && (
              <circle cx={size / 2} cy={size / 2} r={rad} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - r.goalProgress)} className={`fill-none stroke-current transition-all duration-700 ${r.goalReached ? 'text-emerald-500' : 'text-brand-500'}`} />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold tabular">{hrs(r.hoursWorked)}</span>
            <span className="text-xs text-slate-500">of {hrs(r.goalHours)} goal</span>
          </div>
        </div>
        <div>
          <div className="text-sm font-medium text-slate-500">Today's goal</div>
          <div className="mt-1 text-3xl font-semibold tabular">{Math.round(r.goalProgress * 100)}%</div>
          {r.goalReached ? <div className="mt-1 animate-pop text-sm font-medium text-emerald-600">🎉 Goal reached!</div> : <div className="mt-1 text-sm text-slate-500">{hrs(Math.max(0, r.goalHours - r.hoursWorked))} to go</div>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat icon={CheckCircle2} label="Completed" value={`${r.completedTasks}/${r.totalTasks}`} sub={r.totalTasks ? `${r.totalTasks - r.completedTasks} remaining` : 'No tasks yet'} cls="bg-emerald-500/10 text-emerald-600" />
        <Stat icon={Clock} label="Hours worked" value={hrs(r.hoursWorked)} sub={`Planned ${hrs(r.estimatedHours)}`} cls="bg-brand-500/10 text-brand-600" />
        <Stat icon={Gauge} label="Productivity" value={`${r.productivityScore}%`} sub={scoreLabel(r.productivityScore)} cls="bg-violet-500/10 text-violet-600" />
        <Stat icon={Zap} label="Efficiency" value={r.efficiency == null ? '—' : `${r.efficiency}%`} sub={efficiencyLabel(r.efficiency)} cls="bg-amber-500/10 text-amber-600" />
      </div>

      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-violet-600 p-5 text-white">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-100">Motivation</span>
          <button onClick={() => setSeed((n) => n + 1)} className="rounded-lg p-1.5 active:bg-white/10" aria-label="Another message"><Shuffle className="h-4 w-4" /></button>
        </div>
        <p className="mt-3 text-lg font-medium leading-snug">“{r.message.text}”</p>
      </div>

      {r.perTask.length > 0 && (
        <div className="card p-4">
          <h3 className="mb-2 text-sm font-semibold">Estimated vs actual</h3>
          <ul className="space-y-3">
            {r.perTask.map((t) => {
              const ratio = t.estimatedHours ? t.actualHours / t.estimatedHours : 0;
              return (
                <li key={t.id}>
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="truncate">{t.completed ? '✓ ' : ''}{t.title}</span>
                    <span className="shrink-0 tabular text-slate-500">{hrs(t.actualHours)} / {t.estimatedHours ? hrs(t.estimatedHours) : '—'}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div className={`h-full rounded-full ${ratio > 1 ? 'bg-rose-500' : 'bg-brand-500'}`} style={{ width: `${Math.min(1, ratio) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
