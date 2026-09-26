import { useMemo, useState } from 'react';
import { CheckCircle2, Clock, Gauge, Zap, Shuffle } from 'lucide-react';
import { computeDailyReport, reportWithMessage, formatDuration, scoreLabel, efficiencyLabel, useNow, MS_HOUR } from '@lifetracker/shared';
import { useStore } from '../config';

const hrs = (h) => formatDuration(h * MS_HOUR);

function Stat({ icon: Icon, label, value, sub, cls, index }) {
  return (
    <div className="card p-4">
      <div className="caps flex items-center justify-between text-slate-400">
        <span><span className={`mr-1.5 ${cls}`}>{'//'}{index}</span>{label}</span>
        <Icon className={`h-3.5 w-3.5 ${cls}`} strokeWidth={1.5} />
      </div>
      <div className="font-display mt-3 text-3xl tabular">{value}</div>
      <div className="mt-1 truncate text-xs text-slate-500">{sub}</div>
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
  const stroke = 3;
  const rad = (size - stroke) / 2;
  const c = 2 * Math.PI * rad;

  return (
    <div className="space-y-4">
      <header className="pb-2 pt-[33vh]">
        <p className="caps text-slate-400"><span className="mr-2 text-[var(--accent)]">{'//02'}</span>Progress / Report</p>
        <h1 className="font-display mt-2 text-6xl leading-none" style={{ textShadow: '0 0 24px rgba(7,5,13,.9)' }}>Today</h1>
      </header>
      <div className="card flex items-center gap-5 p-5">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={rad} strokeWidth={1} className="fill-none stroke-white/10" />
            {r.goalProgress > 0.005 && (
              <circle cx={size / 2} cy={size / 2} r={rad} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - r.goalProgress)} className={`fill-none stroke-current transition-all duration-700 ${r.goalReached ? 'text-emerald-300' : 'text-brand-300'}`} />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-2xl tabular">{hrs(r.hoursWorked)}</span>
            <span className="caps mt-1 text-slate-500">of {hrs(r.goalHours)}</span>
          </div>
        </div>
        <div>
          <div className="caps text-slate-400"><span className="mr-1.5 text-brand-300">{'//00'}</span>Today's goal</div>
          <div className="font-display mt-2 text-5xl tabular">{Math.round(r.goalProgress * 100)}%</div>
          {r.goalReached ? <div className="caps mt-2 animate-pop text-emerald-300">Goal reached ✦</div> : <div className="mt-2 text-sm text-slate-500">{hrs(Math.max(0, r.goalHours - r.hoursWorked))} to go</div>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat icon={CheckCircle2} label="Completed" value={`${r.completedTasks}/${r.totalTasks}`} sub={r.totalTasks ? `${r.totalTasks - r.completedTasks} remaining` : 'No tasks yet'} cls="text-emerald-300" index="01" />
        <Stat icon={Clock} label="Hours" value={hrs(r.hoursWorked)} sub={`Planned ${hrs(r.estimatedHours)}`} cls="text-brand-300" index="02" />
        <Stat icon={Gauge} label="Score" value={`${r.productivityScore}%`} sub={scoreLabel(r.productivityScore)} cls="text-violet-300" index="03" />
        <Stat icon={Zap} label="Efficiency" value={r.efficiency == null ? '—' : `${r.efficiency}%`} sub={efficiencyLabel(r.efficiency)} cls="text-amber-300" index="04" />
      </div>

      <div className="card relative overflow-hidden p-5">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="relative flex items-center justify-between">
          <span className="caps text-slate-400"><span className="mr-1.5 text-brand-300">{'//05'}</span>Motivation</span>
          <button onClick={() => setSeed((n) => n + 1)} className="rounded-full p-1.5 text-slate-400 active:bg-white/10" aria-label="Another message"><Shuffle className="h-4 w-4" /></button>
        </div>
        <p className="relative mt-3 text-lg font-light leading-snug" style={{ fontStretch: '110%' }}>“{r.message.text}”</p>
      </div>

      {r.perTask.length > 0 && (
        <div className="card p-4">
          <h3 className="caps mb-3 text-slate-400"><span className="mr-1.5 text-brand-300">{'//06'}</span>Estimated vs actual</h3>
          <ul className="space-y-3">
            {r.perTask.map((t) => {
              const ratio = t.estimatedHours ? t.actualHours / t.estimatedHours : 0;
              return (
                <li key={t.id}>
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="truncate">{t.completed ? '✓ ' : ''}{t.title}</span>
                    <span className="shrink-0 tabular text-slate-500">{hrs(t.actualHours)} / {t.estimatedHours ? hrs(t.estimatedHours) : '—'}</span>
                  </div>
                  <div className="mt-1.5 h-px overflow-hidden bg-white/10">
                    <div className={`h-full ${ratio > 1 ? 'bg-rose-400' : 'bg-brand-300'}`} style={{ width: `${Math.min(1, ratio) * 100}%` }} />
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
