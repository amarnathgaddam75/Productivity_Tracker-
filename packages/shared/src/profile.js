// Learns your habits from your own history (no AI needed): when you usually
// start, when you focus best, how long tasks really take compared with your
// estimates, what you do on which weekday, and your streak. The assistant uses
// this to plan realistically and to suggest routines on an empty day.

import * as timer from './timer.js';
import { visibleTasks } from './reports.js';
import { dateKey, shiftDateKey, MS_HOUR, MS_MINUTE } from './time.js';

const LOOKBACK_DAYS = 28;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
};

export const normalizeTitle = (t) =>
  String(t || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function sessionsOf(task, now) {
  const s = [...(task.sessions || [])];
  if (task.runningSince) s.push({ start: task.runningSince, end: now });
  return s.filter((x) => x.end > x.start);
}

const hourLabel = (h) => new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' });

/**
 * @returns {{
 *   days: number, typicalStartHour: number|null, peakHours: number[], avgFocusHours: number,
 *   estimateRatio: number|null, bestWeekday: string|null, streak: number,
 *   routines: Array<{title, key, days: number, weekdays: number[], minutes: number, usualHour: number|null}>,
 *   insights: string[]
 * }}
 */
export function learnProfile(tasks, { now = Date.now(), goalHours = 6 } = {}) {
  const today = dateKey(now);
  const from = shiftDateKey(today, -LOOKBACK_DAYS);
  const list = visibleTasks(tasks).filter((t) => t.date >= from && t.date <= today);

  const byDay = {}; // date -> { focusMs, firstStart }
  const hourMs = new Array(24).fill(0);
  const ratios = [];
  const titles = {}; // key -> { title, dates:Set, weekdays:Set, minutes:[], hours:[] }

  for (const t of list) {
    const ss = sessionsOf(t, now);
    for (const s of ss) {
      const d = dateKey(s.start);
      const day = (byDay[d] ||= { focusMs: 0, firstStart: Infinity });
      day.focusMs += s.end - s.start;
      day.firstStart = Math.min(day.firstStart, s.start);
      // spread the session across the hours it covers
      let a = s.start;
      while (a < s.end) {
        const h = new Date(a).getHours();
        const next = Math.min(s.end, new Date(a).setMinutes(60, 0, 0));
        hourMs[h] += next - a;
        a = next;
      }
    }
    if (t.completed && timer.estimateMs(t) > 0) {
      const actual = timer.elapsedMs(t, now);
      if (actual > 5 * MS_MINUTE) ratios.push(actual / timer.estimateMs(t));
    }
    const key = normalizeTitle(t.title);
    if (key) {
      const e = (titles[key] ||= { title: t.title, dates: new Set(), weekdays: new Set(), minutes: [], hours: [] });
      e.dates.add(t.date);
      e.weekdays.add(new Date(`${t.date}T12:00:00`).getDay());
      const spent = timer.elapsedMs(t, now);
      e.minutes.push(spent > 0 ? spent / MS_MINUTE : timer.estimateMs(t) / MS_MINUTE || 30);
      if (ss[0]) e.hours.push(new Date(ss[0].start).getHours());
    }
  }

  const activeDays = Object.keys(byDay).filter((d) => d < today || byDay[d].focusMs > 0);
  const startHours = Object.entries(byDay)
    .filter(([d]) => d < today)
    .map(([, v]) => new Date(v.firstStart).getHours() + new Date(v.firstStart).getMinutes() / 60);
  const typicalStartHour = startHours.length >= 3 ? Math.round(median(startHours) * 4) / 4 : null;
  const peakHours = hourMs
    .map((ms, h) => ({ h, ms }))
    .filter((x) => x.ms > 20 * MS_MINUTE)
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 3)
    .map((x) => x.h)
    .sort((a, b) => a - b);
  const pastDays = Object.entries(byDay).filter(([d]) => d < today);
  const avgFocusHours = pastDays.length ? pastDays.reduce((s, [, v]) => s + v.focusMs, 0) / pastDays.length / MS_HOUR : 0;
  const estimateRatio = ratios.length >= 3 ? Math.round(median(ratios) * 100) / 100 : null;

  const weekdayMs = new Array(7).fill(0);
  const weekdayCount = new Array(7).fill(0);
  for (const [d, v] of pastDays) {
    const wd = new Date(`${d}T12:00:00`).getDay();
    weekdayMs[wd] += v.focusMs;
    weekdayCount[wd] += 1;
  }
  const avgByWd = weekdayMs.map((ms, i) => (weekdayCount[i] ? ms / weekdayCount[i] : 0));
  const bestWd = pastDays.length >= 7 ? avgByWd.indexOf(Math.max(...avgByWd)) : -1;

  // streak: consecutive days (ending yesterday, or today if already focused) with >= 1h focus
  let streak = 0;
  let cursor = (byDay[today]?.focusMs || 0) >= MS_HOUR ? today : shiftDateKey(today, -1);
  while ((byDay[cursor]?.focusMs || 0) >= MS_HOUR) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }

  const routines = Object.entries(titles)
    .filter(([, e]) => e.dates.size >= 3)
    .map(([key, e]) => ({
      key,
      title: e.title,
      days: e.dates.size,
      weekdays: [...e.weekdays].sort(),
      minutes: Math.max(10, Math.round(median(e.minutes) / 5) * 5),
      usualHour: e.hours.length ? Math.round(median(e.hours)) : null,
    }))
    .sort((a, b) => b.days - a.days)
    .slice(0, 8);

  const insights = [];
  if (typicalStartHour != null) insights.push(`You usually start around ${hourLabel(Math.floor(typicalStartHour))}.`);
  if (peakHours.length) insights.push(`Your best focus hours: ${peakHours.map(hourLabel).join(', ')}.`);
  if (estimateRatio != null && Math.abs(estimateRatio - 1) >= 0.15)
    insights.push(`Tasks take you about ${estimateRatio}× your estimates${estimateRatio > 1 ? ' — I pad plans for that' : ''}.`);
  if (avgFocusHours > 0) insights.push(`You average ${avgFocusHours.toFixed(1)}h of focus a day (goal ${goalHours}h).`);
  if (bestWd >= 0) insights.push(`${WEEKDAYS[bestWd]} is your most productive day.`);
  if (streak >= 2) insights.push(`${streak}-day focus streak — keep it alive.`);

  return {
    days: activeDays.length,
    typicalStartHour,
    peakHours,
    avgFocusHours: Math.round(avgFocusHours * 10) / 10,
    estimateRatio,
    bestWeekday: bestWd >= 0 ? WEEKDAYS[bestWd] : null,
    streak,
    routines,
    insights,
  };
}

/** Routines you usually do on this weekday that aren't planned for today yet. */
export function suggestRoutines(tasks, profile, now = Date.now()) {
  const today = dateKey(now);
  const wd = new Date(now).getDay();
  const planned = new Set(visibleTasks(tasks).filter((t) => t.date === today).map((t) => normalizeTitle(t.title)));
  return profile.routines.filter((r) => !planned.has(r.key) && (r.weekdays.includes(wd) || r.days >= 10)).slice(0, 5);
}

/** One-click starters for an empty day. */
export const STARTER_TASKS = [
  { title: 'Deep work block', minutes: 120 },
  { title: 'Inbox & messages', minutes: 30 },
  { title: 'Exercise', minutes: 45 },
  { title: 'Learn something new', minutes: 60 },
  { title: 'Plan tomorrow', minutes: 15 },
];
