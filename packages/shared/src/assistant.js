// The personal assistant: a fully local "brain" that turns tasks, timers and
// (on desktop) live activity into briefings, command replies and nudges.
// No network, no AI service — deterministic rules over your own data.

import * as timer from './timer.js';
import { computeDailyReport, visibleTasks } from './reports.js';
import { sortTasks } from './store.js';
import { dayBounds, formatDuration, MS_HOUR, MS_MINUTE } from './time.js';

export const DEFAULT_TASK_MINUTES = 30; // assumed length of tasks without an estimate

export const DEFAULT_DISTRACTIONS =
  'youtube, netflix, reddit, instagram, facebook, twitter, x.com, tiktok, twitch, prime video, hotstar, 9gag';

const clock = (ts) => new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const dur = (ms) => formatDuration(Math.max(0, ms));
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function greeting(now = Date.now()) {
  const h = new Date(now).getHours();
  if (h < 5) return 'Working late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Time at which the work day ends (settings.workEndHour, default 18:00) for `now`'s date. */
export function workdayBounds(settings = {}, now = Date.now()) {
  const d = new Date(now);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), settings.workStartHour ?? 9).getTime();
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), settings.workEndHour ?? 18).getTime();
  return [start, end];
}

/** Unfinished tasks for today in the order they'll be worked on, with projected times. */
export function remainingPlan(tasks, today, now = Date.now()) {
  const list = sortTasks(visibleTasks(tasks).filter((t) => !t.completed && (t.date === today || timer.isRunning(t))));
  let cursor = now;
  return list.map((task) => {
    const est = timer.estimateMs(task) || DEFAULT_TASK_MINUTES * MS_MINUTE;
    const remainingMs = Math.max(0, est - timer.elapsedMs(task, now));
    const item = { task, remainingMs, startAt: cursor, endAt: cursor + remainingMs, estimated: timer.estimateMs(task) > 0 };
    cursor += remainingMs;
    return item;
  });
}

/**
 * Where you are, what's left and how much time you have.
 * @returns {{ headline: string, lines: string[], speech: string, status: 'idle'|'done'|'ahead'|'on-track'|'behind', ... }}
 */
export function buildBriefing({ tasks, today, settings = {}, now = Date.now(), activity = null, name = '' }) {
  const plan = remainingPlan(tasks, today, now);
  const report = computeDailyReport(tasks, today, { goalHours: settings.dailyGoalHours ?? 6, now });
  const [, dayEnd] = workdayBounds(settings, now);
  const remainingMs = plan.reduce((s, p) => s + p.remainingMs, 0);
  const finishAt = now + remainingMs;
  const timeLeftMs = dayEnd - now;
  const running = visibleTasks(tasks).find(timer.isRunning);
  const goalLeftMs = Math.max(0, (report.goalHours - report.hoursWorked) * MS_HOUR);
  const who = name ? `, ${name}` : '';

  let status;
  if (!report.totalTasks && !plan.length) status = 'idle';
  else if (!plan.length) status = 'done';
  else if (finishAt <= dayEnd - MS_HOUR) status = 'ahead';
  else if (finishAt <= dayEnd) status = 'on-track';
  else status = 'behind';

  const lines = [];
  let headline;
  if (status === 'idle') {
    headline = 'Nothing planned yet';
    lines.push('Add what you want to get done today and I will keep you on track.');
  } else if (status === 'done') {
    headline = 'Everything is done';
    lines.push(`You finished all ${plural(report.completedTasks, 'task')} and focused for ${dur(report.hoursWorked * MS_HOUR)}.`);
  } else {
    headline = `${plural(plan.length, 'task')} left · ${dur(remainingMs)} of work`;
    if (running) {
      const left = timer.estimateMs(running) ? timer.remainingMs(running, now) : null;
      lines.push(
        `Right now: “${running.title}” — ${dur(timer.elapsedMs(running, now))} in` +
          (left == null ? '.' : left >= 0 ? `, ${dur(left)} left.` : `, ${dur(-left)} over the estimate.`),
      );
    } else if (plan[0]) {
      lines.push(`No timer running. Next up: “${plan[0].task.title}” (${dur(plan[0].remainingMs)}).`);
    }
    if (timeLeftMs > 0) {
      const slack = dayEnd - finishAt;
      lines.push(
        `It's ${clock(now)}; at this pace you'll finish around ${clock(finishAt)} — ` +
          (slack >= 0 ? `${dur(slack)} before your ${clock(dayEnd)} wrap-up.` : `${dur(-slack)} after your ${clock(dayEnd)} wrap-up.`),
      );
    } else {
      lines.push(`Your work day ended at ${clock(dayEnd)}; ${dur(remainingMs)} of work is still open.`);
    }
  }
  if (status !== 'idle') {
    lines.push(
      `Focused ${dur(report.hoursWorked * MS_HOUR)} today` +
        (goalLeftMs > 0 ? ` — ${dur(goalLeftMs)} to your ${dur(report.goalHours * MS_HOUR)} goal.` : ' — daily goal reached.'),
    );
  }
  if (status === 'behind' && plan.length > 1) {
    const last = plan[plan.length - 1].task;
    lines.push(`To finish on time, consider moving “${last.title}” to tomorrow or trimming estimates.`);
  }
  if (activity?.app) lines.push(`You're in ${activity.app}${activity.idleSec > 120 ? ' (away)' : ''}.`);

  const speech = `${greeting(now)}${who}. ${headline.replace(' · ', ', ')}. ${lines.slice(0, 3).join(' ')}`;
  return {
    headline,
    lines,
    speech,
    status,
    plan,
    remainingMs,
    finishAt,
    dayEnd,
    timeLeftMs,
    goalLeftMs,
    running: running || null,
    report,
    greeting: `${greeting(now)}${who}`,
  };
}

// ---- commands -----------------------------------------------------------------

function parseDuration(text) {
  const m = text.match(/(?:\bfor\s+)?(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)\b/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(',', '.'));
  const hours = /^h/i.test(m[2]) ? n : n / 60;
  return { hours: Math.round(hours * 100) / 100, match: m[0] };
}

function score(title, query) {
  const t = title.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  if (t === q) return 100;
  if (t.includes(q)) return 80 - Math.min(30, t.length - q.length);
  const words = q.split(/\s+/).filter((w) => w.length > 1);
  const hits = words.filter((w) => t.includes(w)).length;
  return words.length ? (hits / words.length) * 60 : 0;
}

/** Best matching open task for a free-text query. */
export function findTask(tasks, query, { includeDone = false } = {}) {
  let best = null;
  for (const t of visibleTasks(tasks)) {
    if (!includeDone && t.completed) continue;
    const s = score(t.title, query);
    if (s >= 30 && (!best || s > best.s)) best = { t, s };
  }
  return best?.t || null;
}

/**
 * Understands short commands such as:
 *   add write report 2h · new gym for 45 min · start report · pause · done [report]
 *   what's left · status / where am i · report · help
 */
export function parseCommand(input) {
  const text = String(input || '').trim();
  const lower = text.toLowerCase();
  if (!text) return { type: 'empty' };
  if (/^(help|\?|commands)$/.test(lower)) return { type: 'help' };
  let m;
  if ((m = text.match(/^(?:add|new|create|todo|plan)\s+(?:task\s+)?(.+)$/i))) {
    const d = parseDuration(m[1]);
    const title = (d ? m[1].replace(d.match, '') : m[1]).replace(/\s+(for|of)\s*$/i, '').trim();
    return { type: 'add', title, estimatedHours: d ? d.hours : null };
  }
  if ((m = text.match(/^(?:start|begin|work on|resume|track)\s+(.+)$/i))) return { type: 'start', query: m[1].trim() };
  if (/^(start|resume|go)$/.test(lower)) return { type: 'start', query: '' };
  if (/^(pause|stop|break|hold)( timer)?$/.test(lower)) return { type: 'pause' };
  if ((m = text.match(/^(?:done|finish(?:ed)?|complete(?:d)?|mark done)\s*(.*)$/i))) return { type: 'done', query: m[1].trim() };
  if (/(what'?s|what is) (left|remaining|next)|remaining|^left$|^next$|to ?do|plan( for)? today/.test(lower)) return { type: 'left' };
  if (/status|where am i|how am i doing|brief(ing)?|update|time left/.test(lower)) return { type: 'status' };
  if (/report|summary|how did i do|recap/.test(lower)) return { type: 'report' };
  return { type: 'unknown', text };
}

export const COMMAND_HELP = [
  'add <task> [2h | 30m] — plan a task',
  'start <task> — start its timer (or “start” for the next one)',
  'pause — pause the running timer',
  'done [task] — complete the running or named task',
  "what's left — the remaining plan with times",
  'status — where you are and how much time is left',
  'report — today’s report',
];

/**
 * Execute a parsed command against the tracker store and return a reply.
 * @param {object} store  zustand store (getState-able) from createTrackerStore
 */
export function runCommand(input, store, { now = Date.now(), name = '' } = {}) {
  const cmd = typeof input === 'string' ? parseCommand(input) : input;
  const s = store.getState();
  const tasks = s.tasks;
  const running = visibleTasks(tasks).find(timer.isRunning);
  switch (cmd.type) {
    case 'empty':
      return { ok: false, reply: 'Type a command, e.g. “add gym 1h” or “what’s left”.' };
    case 'help':
      return { ok: true, reply: `Try:\n${COMMAND_HELP.join('\n')}` };
    case 'add': {
      if (!cmd.title) return { ok: false, reply: 'What should I add? e.g. “add write report 2h”.' };
      const t = s.addTask({ title: cmd.title, estimatedHours: cmd.estimatedHours ?? DEFAULT_TASK_MINUTES / 60 });
      return { ok: true, reply: `Added “${t.title}” (${dur(timer.estimateMs(t))}).`, task: t };
    }
    case 'start': {
      const target = cmd.query ? findTask(tasks, cmd.query) : remainingPlan(tasks, s.today, now).find((p) => !timer.isRunning(p.task))?.task;
      if (!target) return { ok: false, reply: cmd.query ? `I couldn't find an open task like “${cmd.query}”.` : 'Nothing left to start.' };
      s.startTimer(target.id);
      return { ok: true, reply: `Started “${target.title}”.${timer.estimateMs(target) ? ` ${dur(timer.remainingMs(target, now))} planned.` : ''}` };
    }
    case 'pause':
      if (!running) return { ok: false, reply: 'No timer is running.' };
      s.pauseTimer(running.id);
      return { ok: true, reply: `Paused “${running.title}” at ${dur(timer.elapsedMs(running, now))}.` };
    case 'done': {
      const target = cmd.query ? findTask(tasks, cmd.query) : running;
      if (!target) return { ok: false, reply: cmd.query ? `I couldn't find an open task like “${cmd.query}”.` : 'Which task? e.g. “done report”.' };
      s.toggleComplete(target.id);
      const left = remainingPlan(store.getState().tasks, s.today, now);
      return { ok: true, reply: `Nice — “${target.title}” is done. ${left.length ? `${plural(left.length, 'task')} left.` : 'That was the last one!'}` };
    }
    case 'left': {
      const plan = remainingPlan(tasks, s.today, now);
      if (!plan.length) return { ok: true, reply: 'Nothing left for today. 🎉' };
      const rows = plan.map((p) => `${clock(p.startAt)}–${clock(p.endAt)}  ${p.task.title} (${dur(p.remainingMs)})`);
      return { ok: true, reply: `${plural(plan.length, 'task')}, about ${dur(plan.reduce((a, p) => a + p.remainingMs, 0))}:\n${rows.join('\n')}` };
    }
    case 'status':
    case 'report': {
      const b = buildBriefing({ tasks, today: s.today, settings: s.settings, now, name });
      if (cmd.type === 'report') {
        const r = b.report;
        return {
          ok: true,
          reply:
            `${r.completedTasks}/${r.totalTasks} tasks done · ${dur(r.hoursWorked * MS_HOUR)} focused · score ${r.productivityScore}%` +
            (r.efficiency != null ? ` · efficiency ${r.efficiency}%` : '') +
            `\n${b.lines.join('\n')}`,
          speech: b.speech,
        };
      }
      return { ok: true, reply: `${b.headline}\n${b.lines.join('\n')}`, speech: b.speech };
    }
    default:
      return { ok: false, reply: `I didn't get “${cmd.text}”. Type “help” for what I can do.` };
  }
}

// ---- nudges -------------------------------------------------------------------

export function isDistraction(activity, keywords = DEFAULT_DISTRACTIONS) {
  if (!activity) return null;
  const hay = `${activity.app || ''} ${activity.title || ''}`.toLowerCase();
  const hit = String(keywords)
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)
    .find((k) => hay.includes(k));
  return hit || null;
}

/**
 * Stateful coach. Feed it an activity sample every few seconds; it returns
 * nudges to show/speak/push and actions (like auto-pausing when you walk away).
 */
export class Coach {
  constructor(memo = {}) {
    this.m = { activeSince: null, lastUntracked: 0, distractSince: null, distractKey: null, lastDistraction: 0, lastCheckin: 0, lastPace: 0, briefed: null, wrapped: null, idlePaused: null, ...memo };
  }

  /**
   * @param {object} ctx
   * @param {Record<string, object>} ctx.tasks
   * @param {string} ctx.today
   * @param {object} ctx.settings
   * @param {{app?: string, title?: string, idleSec?: number}|null} ctx.activity  null when not available (phone/browser)
   * @param {number} [ctx.now]
   * @returns {Array<{kind: string, key: string, title: string, body: string, speak?: string, actions?: Array<{label: string, command: string}>, pauseAt?: number, taskId?: string}>}
   */
  tick({ tasks, today, settings = {}, activity = null, now = Date.now(), name = '' }) {
    const out = [];
    const m = this.m;
    const idleSec = activity?.idleSec ?? 0;
    const present = activity ? idleSec < 120 : true;
    const running = visibleTasks(tasks).find(timer.isRunning);
    const [workStart, workEnd] = workdayBounds(settings, now);
    const inWorkHours = now >= workStart && now < workEnd;
    const who = name ? `, ${name}` : '';

    // 1. morning briefing: first time you're at the computer on a work day
    if (m.briefed !== today && present && now >= workStart - MS_HOUR && now < workEnd) {
      m.briefed = today;
      const b = buildBriefing({ tasks, today, settings, now, activity, name });
      out.push({ kind: 'briefing', key: `brief:${today}`, title: `${b.greeting} — ${b.headline}`, body: b.lines.join(' '), speak: b.speech, actions: b.plan[0] && !running ? [{ label: 'Start next', command: 'start' }] : [] });
    }

    // 2. idle auto-pause and welcome back
    const idleMin = settings.idlePauseMinutes ?? 10;
    if (activity && running && idleMin > 0 && idleSec >= idleMin * 60 && !m.idlePaused) {
      const pauseAt = Math.max(running.runningSince, now - idleSec * 1000);
      m.idlePaused = { taskId: running.id, at: pauseAt, title: running.title };
      out.push({ kind: 'idle-pause', key: `idle:${pauseAt}`, taskId: running.id, pauseAt, title: `Paused “${running.title}”`, body: `You've been away ${dur(idleSec * 1000)}, so I stopped the clock when you left.` });
    }
    if (m.idlePaused && present) {
      const p = m.idlePaused;
      m.idlePaused = null;
      out.push({ kind: 'assistant', key: `back:${p.at}`, title: `Welcome back${who}`, body: `I paused “${p.title}” when you stepped away ${dur(now - p.at)} ago.`, speak: `Welcome back${who}. I paused ${p.title} while you were away.`, actions: [{ label: 'Resume', command: `start ${p.title}` }] });
    }

    // 3. working without a timer
    if (present) m.activeSince = m.activeSince ?? now;
    else m.activeSince = null;
    const untrackedMin = settings.nudgeUntrackedMinutes ?? 15;
    if (activity && !running && inWorkHours && untrackedMin > 0 && m.activeSince && now - m.activeSince >= untrackedMin * MS_MINUTE && now - m.lastUntracked >= untrackedMin * MS_MINUTE) {
      m.lastUntracked = now;
      const next = remainingPlan(tasks, today, now)[0]?.task;
      out.push({
        kind: 'assistant',
        key: `untracked:${now}`,
        title: 'No timer running',
        body: `You've been ${activity.app ? `in ${activity.app}` : 'at the computer'} for ${dur(now - m.activeSince)} without tracking.${next ? ` Start “${next.title}”?` : ' Add what you are working on?'}`,
        speak: next ? `You're not tracking anything. Shall I start ${next.title}?` : `You're not tracking anything right now.`,
        actions: next ? [{ label: `Start “${next.title}”`, command: `start ${next.title}` }] : [],
      });
    }

    // 4. distractions while a task is running
    const hit = running && present ? isDistraction(activity, settings.distractions ?? DEFAULT_DISTRACTIONS) : null;
    if (hit) {
      if (m.distractKey !== hit) {
        m.distractKey = hit;
        m.distractSince = now;
      }
      if (now - m.distractSince >= 5 * MS_MINUTE && now - m.lastDistraction >= 15 * MS_MINUTE) {
        m.lastDistraction = now;
        out.push({ kind: 'distraction', key: `distract:${now}`, title: `${hit[0].toUpperCase()}${hit.slice(1)} for ${dur(now - m.distractSince)}`, body: `“${running.title}” is still running. Back to it, or pause the timer?`, speak: `Heads up${who}. You've been on ${hit} for ${Math.round((now - m.distractSince) / MS_MINUTE)} minutes while ${running.title} is running.`, actions: [{ label: 'Pause timer', command: 'pause' }] });
      }
    } else {
      m.distractKey = null;
      m.distractSince = null;
    }

    // 5. hourly check-in on the running task
    const checkinMin = settings.checkinMinutes ?? 60;
    if (running && checkinMin > 0) {
      const since = Math.max(running.runningSince, m.lastCheckin);
      if (now - since >= checkinMin * MS_MINUTE) {
        m.lastCheckin = now;
        const left = timer.estimateMs(running) ? timer.remainingMs(running, now) : null;
        out.push({ kind: 'checkin', key: `checkin:${now}`, title: `Still on “${running.title}”?`, body: `${dur(timer.elapsedMs(running, now))} in${left == null ? '' : left >= 0 ? `, ${dur(left)} left` : `, ${dur(-left)} over`}.`, actions: [{ label: 'Done', command: 'done' }, { label: 'Pause', command: 'pause' }] });
      }
    }

    // 6. pace check every 2 hours during the day
    if (inWorkHours && now - workStart >= 2 * MS_HOUR && now - m.lastPace >= 2 * MS_HOUR) {
      m.lastPace = now;
      const b = buildBriefing({ tasks, today, settings, now, activity, name });
      if (b.status === 'behind') {
        out.push({ kind: 'pace', key: `pace:${now}`, title: `Running ${dur(b.finishAt - b.dayEnd)} behind`, body: b.lines.join(' '), speak: `Quick pace check. ${b.lines.slice(-2).join(' ')}` });
      }
    }

    // 7. end-of-day wrap-up
    if (m.wrapped !== today && now >= workEnd && now < dayBounds(today)[1]) {
      m.wrapped = today;
      const b = buildBriefing({ tasks, today, settings, now, name });
      const r = b.report;
      if (r.totalTasks || r.hoursWorked) out.push({ kind: 'report', key: `wrap:${today}`, title: 'End of day report', body: `${r.completedTasks}/${r.totalTasks} tasks · ${dur(r.hoursWorked * MS_HOUR)} focused · score ${r.productivityScore}%. ${b.plan.length ? `${plural(b.plan.length, 'task')} will carry over to tomorrow.` : 'Everything is done.'}`, speak: `That's the end of your work day${who}. You finished ${r.completedTasks} of ${r.totalTasks} tasks and focused for ${dur(r.hoursWorked * MS_HOUR)}.` });
    }
    return out;
  }
}
