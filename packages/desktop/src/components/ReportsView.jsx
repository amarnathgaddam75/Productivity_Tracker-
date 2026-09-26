import { useMemo, useState } from 'react';
import { CheckCircle2, Clock, Gauge, Zap, Shuffle, ChevronLeft, ChevronRight, Target, BarChart3 } from 'lucide-react';
import {
  computeDailyReport,
  reportWithMessage,
  shiftDateKey,
  formatDuration,
  formatDayLabel,
  scoreLabel,
  efficiencyLabel,
  useNow,
  MS_HOUR,
} from '@lifetracker/shared';
import { useStore } from '../config.js';
import { StatCard, ProgressRing, EmptyState } from './ui.jsx';

const hoursText = (h) => formatDuration(h * MS_HOUR);

export default function ReportsView() {
  const now = useNow(15000);
  const tasks = useStore((s) => s.tasks);
  const today = useStore((s) => s.today);
  const goalHours = useStore((s) => s.settings.dailyGoalHours);
  const summaries = useStore((s) => s.summaries);
  const [day, setDay] = useState(today);
  const [seed, setSeed] = useState(0);

  const report = useMemo(
    () => reportWithMessage(computeDailyReport(tasks, day, { goalHours, now }), `${day}:${seed}`),
    [tasks, day, goalHours, now, seed],
  );

  // Last 7 days: live from task sessions, falling back to stored summaries.
  const history = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const key = shiftDateKey(today, i - 6);
      const r = computeDailyReport(tasks, key, { goalHours, now });
      const s = summaries[key];
      const hours = r.hoursWorked || s?.hoursWorked || 0;
      return { key, hours, completed: r.totalTasks ? r.completedTasks : s?.completedTasks || 0 };
    });
  }, [tasks, summaries, today, goalHours, now]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button className="icon-btn" onClick={() => setDay(shiftDateKey(day, -1))} aria-label="Previous day"><ChevronLeft className="h-5 w-5" /></button>
          <span className="w-44 text-center font-semibold">{formatDayLabel(day, today)}</span>
          <button className="icon-btn" disabled={day >= today} onClick={() => setDay(shiftDateKey(day, 1))} aria-label="Next day"><ChevronRight className="h-5 w-5" /></button>
        </div>
        {day !== today && <button className="btn-ghost text-xs" onClick={() => setDay(today)}>Back to today</button>}
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={CheckCircle2} label="Tasks completed" value={`${report.completedTasks}/${report.totalTasks}`} sub={report.totalTasks ? `${report.totalTasks - report.completedTasks} remaining` : 'No tasks planned'} accent="text-emerald-600 bg-emerald-500/10 dark:text-emerald-400" />
        <StatCard icon={Clock} label="Hours worked" value={hoursText(report.hoursWorked)} sub={`Planned ${hoursText(report.estimatedHours)}`} />
        <StatCard icon={Gauge} label="Productivity score" value={`${report.productivityScore}%`} sub={scoreLabel(report.productivityScore)} accent="text-violet-600 bg-violet-500/10 dark:text-violet-400" />
        <StatCard icon={Zap} label="Efficiency" value={report.efficiency == null ? '—' : `${report.efficiency}%`} sub={efficiencyLabel(report.efficiency)} accent="text-amber-600 bg-amber-500/10 dark:text-amber-400" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card flex items-center gap-6 p-6">
          <ProgressRing value={report.goalProgress} size={132} color={report.goalReached ? 'text-emerald-500' : 'text-brand-500'}>
            <span className="text-2xl font-semibold tabular">{Math.round(report.goalProgress * 100)}%</span>
            <span className="text-xs text-slate-500">of goal</span>
          </ProgressRing>
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500"><Target className="h-4 w-4" /> Daily goal</div>
            <div className="mt-1 text-2xl font-semibold tabular">{hoursText(report.hoursWorked)}</div>
            <div className="text-sm text-slate-500">of {hoursText(report.goalHours)}</div>
            {report.goalReached && <div className="mt-2 animate-pop text-sm font-medium text-emerald-600 dark:text-emerald-400">🎉 Goal reached!</div>}
          </div>
        </div>

        <div className="card relative col-span-2 overflow-hidden bg-gradient-to-br from-brand-600 to-violet-600 p-6 text-white">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex h-full flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-100">Daily motivation</span>
              <button className="rounded-lg p-1.5 text-brand-100 transition hover:bg-white/10 hover:text-white" onClick={() => setSeed((n) => n + 1)} title="Another message" aria-label="Another message">
                <Shuffle className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-4 text-2xl font-medium leading-snug">“{report.message.text}”</p>
            <p className="mt-4 text-sm text-brand-100">
              {report.completedTasks} of {report.totalTasks} tasks done · {hoursText(report.hoursWorked)} focused
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <div className="card col-span-2 p-6">
          <h3 className="text-sm font-semibold">Hours worked · last 7 days</h3>
          <WeekChart history={history} goal={goalHours} selected={day} onSelect={setDay} today={today} />
        </div>
        <div className="card col-span-3 p-6">
          <h3 className="text-sm font-semibold">Estimated vs actual</h3>
          {report.perTask.length === 0 ? (
            <EmptyState icon={BarChart3} title="No tasks for this day">Tasks you plan or track time on will appear here.</EmptyState>
          ) : (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 font-medium">Task</th>
                  <th className="pb-2 text-right font-medium">Estimate</th>
                  <th className="pb-2 text-right font-medium">Actual</th>
                  <th className="pb-2 pl-4 font-medium">Usage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {report.perTask.map((t) => {
                  const ratio = t.estimatedHours ? t.actualHours / t.estimatedHours : 0;
                  return (
                    <tr key={t.id}>
                      <td className="max-w-[220px] truncate py-2 pr-2" title={t.title}>
                        {t.completed ? '✓ ' : ''}{t.title}
                      </td>
                      <td className="py-2 text-right tabular text-slate-500">{t.estimatedHours ? hoursText(t.estimatedHours) : '—'}</td>
                      <td className="py-2 text-right tabular">{hoursText(t.actualHours)}</td>
                      <td className="py-2 pl-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                            <div className={`h-full rounded-full ${ratio > 1 ? 'bg-rose-500' : 'bg-brand-500'}`} style={{ width: `${Math.min(1, ratio) * 100}%` }} />
                          </div>
                          <span className="w-10 text-right text-xs tabular text-slate-500">{t.estimatedHours ? `${Math.round(ratio * 100)}%` : ''}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/** Single-series bar chart with a dashed goal line and per-bar hover tooltip. */
function WeekChart({ history, goal, selected, onSelect, today }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(goal || 0, ...history.map((d) => d.hours), 1);
  const H = 160;
  const goalY = goal ? H - (goal / max) * H : null;

  return (
    <div className="mt-4">
      <div className="relative" style={{ height: H }}>
        {/* recessive grid */}
        {[0.5, 1].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-slate-100 dark:border-slate-800" style={{ top: H - f * H }} />
        ))}
        {goalY != null && (
          <div className="absolute inset-x-0 z-10 border-t border-dashed border-slate-400 dark:border-slate-500" style={{ top: goalY }}>
            <span className="absolute -top-4 right-0 text-[10px] text-slate-500">goal {formatDuration(goal * MS_HOUR)}</span>
          </div>
        )}
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {history.map((d) => {
            const h = (d.hours / max) * H;
            const isSel = d.key === selected;
            return (
              <button
                key={d.key}
                className="group relative flex h-full flex-1 items-end justify-center"
                onMouseEnter={() => setHover(d.key)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(d.key)}
                onBlur={() => setHover(null)}
                onClick={() => onSelect(d.key)}
                aria-label={`${formatDayLabel(d.key, today)}: ${formatDuration(d.hours * MS_HOUR)}`}
              >
                <div
                  className={`w-full max-w-[28px] rounded-t transition ${isSel ? 'bg-brand-600 dark:bg-brand-400' : 'bg-brand-300 group-hover:bg-brand-500 dark:bg-brand-700 dark:group-hover:bg-brand-500'}`}
                  style={{ height: Math.max(d.hours > 0 ? 2 : 0, h) }}
                />
                {hover === d.key && (
                  <div className="pointer-events-none absolute bottom-full z-20 mb-1 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-xs text-white shadow dark:bg-slate-700" style={{ bottom: h + 4 }}>
                    <div className="font-medium">{formatDayLabel(d.key, today)}</div>
                    <div className="tabular">{formatDuration(d.hours * MS_HOUR)} · {d.completed} done</div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex gap-[2px] border-t border-slate-200 pt-2 dark:border-slate-700">
        {history.map((d) => (
          <div key={d.key} className={`flex-1 text-center text-[11px] ${d.key === selected ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-500'}`}>
            {new Date(`${d.key}T12:00`).toLocaleDateString(undefined, { weekday: 'short' })}
          </div>
        ))}
      </div>
    </div>
  );
}
