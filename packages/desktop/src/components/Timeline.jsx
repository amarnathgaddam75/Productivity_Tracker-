import { useMemo, useState } from 'react';
import { dayBounds, formatDuration, visibleTasks, workdayBounds, MS_HOUR } from '@lifetracker/shared';
import { AWAY, appTotals } from '../assistant/state.js';

// Validated categorical palette (dark steps), fixed order; >5 series fold into "Other".
export const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'];
const OTHER = '#6f6988';

const clock = (ts) => new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/**
 * Today at a glance: when you tracked which task, and which apps you were in.
 * Hover any block for details; the legend below doubles as the data table.
 */
export default function Timeline({ tasks, segments = [], day, settings, now, showApps = true }) {
  const [hover, setHover] = useState(null);
  const [dayStart, dayEnd] = dayBounds(day);

  const data = useMemo(() => {
    const [workStart, workEnd] = workdayBounds(settings, dayStart + 12 * MS_HOUR);
    const sessions = [];
    const list = visibleTasks(tasks);
    list.forEach((t) => {
      const parts = [...(t.sessions || [])];
      if (t.runningSince) parts.push({ start: t.runningSince, end: now });
      parts.forEach((s) => {
        const a = Math.max(s.start, dayStart);
        const b = Math.min(s.end, dayEnd, now);
        if (b > a) sessions.push({ task: t, start: a, end: b });
      });
    });
    // tasks ordered by first session of the day -> stable colours
    const order = [...new Set(sessions.sort((x, y) => x.start - y.start).map((s) => s.task.id))];
    const taskColor = (id) => (order.indexOf(id) < SERIES.length ? SERIES[order.indexOf(id)] : OTHER);

    const totals = appTotals(segments);
    const top = totals.slice(0, SERIES.length).map((t) => t.app);
    const appColor = (app) => (app === AWAY ? null : top.includes(app) ? SERIES[top.indexOf(app)] : OTHER);
    const otherMs = totals.slice(SERIES.length).reduce((s, t) => s + t.ms, 0);

    const firstAt = Math.min(workStart, ...sessions.map((s) => s.start), ...segments.map((s) => s.start));
    const from = Math.max(dayStart, Math.floor(firstAt / MS_HOUR) * MS_HOUR);
    const lastAt = Math.max(now, workEnd);
    const to = Math.min(dayEnd, Math.max(from + 4 * MS_HOUR, Math.ceil(lastAt / MS_HOUR) * MS_HOUR));
    const hours = [];
    for (let t = from; t <= to; t += MS_HOUR) hours.push(t);
    const taskTotals = order.map((id) => {
      const t = list.find((x) => x.id === id);
      return { id, title: t.title, color: taskColor(id), ms: sessions.filter((s) => s.task.id === id).reduce((a, s) => a + s.end - s.start, 0) };
    });
    return { sessions, taskColor, totals, top, appColor, otherMs, from, to, hours, taskTotals };
  }, [tasks, segments, dayStart, dayEnd, now, settings]);

  const { from, to } = data;
  const x = (t) => `${((Math.min(Math.max(t, from), to) - from) / (to - from)) * 100}%`;
  const w = (a, b) => `${Math.max(0.25, ((Math.min(b, to) - Math.max(a, from)) / (to - from)) * 100)}%`;
  const nowIn = now >= from && now <= to;

  const lane = (label, children) => (
    <div className="flex items-center gap-4">
      <div className="caps w-12 shrink-0 text-slate-500">{label}</div>
      <div className="relative h-7 flex-1 rounded-md bg-white/[0.03]">{children}</div>
    </div>
  );

  return (
    <div className="relative">
      <div className="space-y-2.5" onMouseLeave={() => setHover(null)}>
        {lane(
          'Tasks',
          data.sessions.map((s, i) => (
            <div
              key={i}
              className="absolute inset-y-0 rounded-[4px] border-x-2 border-slate-950 transition-opacity hover:opacity-80"
              style={{ left: x(s.start), width: w(s.start, s.end), background: data.taskColor(s.task.id) }}
              onMouseEnter={(e) => setHover({ x: e.currentTarget.offsetLeft, lane: 0, title: s.task.title, sub: `${clock(s.start)} – ${clock(s.end)} · ${formatDuration(s.end - s.start)}` })}
            />
          )),
        )}
        {showApps &&
          lane(
            'Apps',
            segments
              .filter((s) => s.end > from && s.start < to)
              .map((s, i) =>
                s.app === AWAY ? (
                  <div key={i} className="absolute inset-y-2 rounded-[3px] bg-[repeating-linear-gradient(135deg,rgba(255,255,255,.08)_0_2px,transparent_2px_6px)]" style={{ left: x(s.start), width: w(s.start, s.end) }} onMouseEnter={(e) => setHover({ x: e.currentTarget.offsetLeft, lane: 1, title: 'Away', sub: `${clock(s.start)} – ${clock(s.end)} · ${formatDuration(s.end - s.start)}` })} />
                ) : (
                  <div
                    key={i}
                    className="absolute inset-y-0 border-x border-slate-950 hover:opacity-80"
                    style={{ left: x(s.start), width: w(s.start, s.end), background: data.appColor(s.app) }}
                    onMouseEnter={(e) => setHover({ x: e.currentTarget.offsetLeft, lane: 1, title: s.app, sub: `${s.title ? `${s.title.slice(0, 60)} · ` : ''}${clock(s.start)} – ${clock(s.end)}` })}
                  />
                ),
              ),
          )}
        {/* hour axis */}
        <div className="relative ml-16 h-5">
          {data.hours.map((h) => (
            <span key={h} className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] tabular text-slate-500" style={{ left: x(h) }}>
              {new Date(h).toLocaleTimeString(undefined, { hour: 'numeric' })}
            </span>
          ))}
        </div>
        {nowIn && (
          <div className="pointer-events-none absolute bottom-5 top-0 ml-16 w-px bg-slate-50/70" style={{ left: `calc((100% - 4rem) * ${(now - from) / (to - from)})` }}>
            <span className="caps absolute -top-4 -translate-x-1/2 text-[9px] text-slate-300">Now</span>
          </div>
        )}
        {hover && (
          <div className="pointer-events-none absolute z-20 max-w-xs rounded-lg border border-white/10 bg-slate-900/95 px-3 py-2 text-xs shadow-xl" style={{ left: `calc(4rem + ${hover.x}px)`, top: hover.lane ? 76 : 36 }}>
            <div className="font-medium text-slate-100">{hover.title}</div>
            <div className="mt-0.5 text-slate-400">{hover.sub}</div>
          </div>
        )}
      </div>

      {/* legend + table */}
      <div className="mt-6 grid grid-cols-2 gap-8">
        <div>
          <div className="caps mb-2 text-slate-500">Tracked tasks</div>
          {data.taskTotals.length === 0 ? (
            <div className="text-sm text-slate-500">No timers yet today.</div>
          ) : (
            <ul className="space-y-1.5">
              {data.taskTotals.map((t) => (
                <li key={t.id} className="flex items-center gap-2.5 text-sm">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: t.color }} />
                  <span className="truncate text-slate-200">{t.title}</span>
                  <span className="ml-auto tabular text-slate-400">{formatDuration(t.ms)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {showApps && (
          <div>
            <div className="caps mb-2 text-slate-500">Top apps</div>
            {data.totals.length === 0 ? (
              <div className="text-sm text-slate-500">No window activity recorded yet today.</div>
            ) : (
              <ul className="space-y-1.5">
                {data.totals.slice(0, SERIES.length).map((t) => (
                  <li key={t.app} className="flex items-center gap-2.5 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: data.appColor(t.app) }} />
                    <span className="truncate text-slate-200">{t.app}</span>
                    <span className="ml-auto tabular text-slate-400">{formatDuration(t.ms)}</span>
                  </li>
                ))}
                {data.otherMs > 0 && (
                  <li className="flex items-center gap-2.5 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: OTHER }} />
                    <span className="text-slate-400">Other</span>
                    <span className="ml-auto tabular text-slate-400">{formatDuration(data.otherMs)}</span>
                  </li>
                )}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
