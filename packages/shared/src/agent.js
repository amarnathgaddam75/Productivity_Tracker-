// The agent: an AI model (any provider from llm.js) that can act on your
// tracker through tools — tasks, timers, reminders, memory, reports, settings
// and, on the laptop, opening websites and apps. Without a model it falls back
// to the built-in command parser, which drives the very same tools.

import * as timer from './timer.js';
import { computeDailyReport, visibleTasks } from './reports.js';
import { buildBriefing, findTask, remainingPlan, greeting, COMMAND_HELP, DEFAULT_TASK_MINUTES } from './assistant.js';
import { suggestRoutines } from './profile.js';
import { parseWhen, describeWhen } from './when.js';
import { shiftDateKey, formatDuration, MS_HOUR, MS_MINUTE } from './time.js';
import { describeWeather } from './weather.js';

const dur = (ms) => formatDuration(Math.max(0, ms));
const clock = (ts) => new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

function resolveDay(day, today) {
  const d = String(day || 'today').toLowerCase().trim();
  if (d === 'today' || !d) return today;
  if (d === 'tomorrow') return shiftDateKey(today, 1);
  if (d === 'yesterday') return shiftDateKey(today, -1);
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const wd = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(d.replace(/^(next|on)\s+/, ''));
  if (wd >= 0) {
    const cur = new Date(`${today}T12:00:00`).getDay();
    return shiftDateKey(today, ((wd - cur + 7) % 7) || 7);
  }
  return today;
}

const dayLabel = (key, today) => (key === today ? 'today' : key === shiftDateKey(today, 1) ? 'tomorrow' : key === shiftDateKey(today, -1) ? 'yesterday' : key);

function taskLine(t, now) {
  const mark = t.completed ? '[done]' : timer.isRunning(t) ? '[running]' : '[open]';
  const est = timer.estimateMs(t) ? `, planned ${dur(timer.estimateMs(t))}` : '';
  const spent = timer.elapsedMs(t, now) ? `, spent ${dur(timer.elapsedMs(t, now))}` : '';
  return `${mark} ${t.title}${est}${spent}`;
}

function pickTask(tasks, query, opts) {
  if (!query) return null;
  return findTask(tasks, query, opts);
}

// ---- tools --------------------------------------------------------------------------

const S = (properties = {}, required = []) => ({ type: 'object', properties, required });
const str = (description) => ({ type: 'string', description });
const num = (description) => ({ type: 'number', description });

/**
 * Tool definitions. `run(args, ctx)` returns a short human-readable result
 * (the model rephrases it; the built-in brain shows it as is).
 * ctx: { store, now, name, platform, profile, activity, system?, weather? }
 */
export const TOOLS = [
  {
    name: 'get_status',
    description: 'Where the user is right now: running timer, what is left today, projected finish time, focus vs goal.',
    parameters: S(),
    run(_, ctx) {
      const s = ctx.store.getState();
      const b = buildBriefing({ tasks: s.tasks, today: s.today, settings: s.settings, now: ctx.now, name: ctx.name });
      return `${b.headline}. ${b.lines.join(' ')}`;
    },
  },
  {
    name: 'list_tasks',
    description: 'List tasks for a day with their status, estimate and time spent.',
    parameters: S({ day: str('"today", "tomorrow", "yesterday", a weekday or YYYY-MM-DD. Default today.'), include_completed: { type: 'boolean' } }),
    run({ day, include_completed = true } = {}, ctx) {
      const s = ctx.store.getState();
      const key = resolveDay(day, s.today);
      const list = visibleTasks(s.tasks).filter((t) => t.date === key && (include_completed || !t.completed));
      if (!list.length) return `No tasks for ${dayLabel(key, s.today)}.`;
      return `${plural(list.length, 'task')} for ${dayLabel(key, s.today)}:\n${list.map((t) => taskLine(t, ctx.now)).join('\n')}`;
    },
  },
  {
    name: 'add_task',
    description: 'Add a task to the plan. Use minutes for the estimate.',
    parameters: S({ title: str('Short task title'), minutes: num('Estimated minutes (default 30)'), day: str('today (default), tomorrow, weekday or YYYY-MM-DD') }, ['title']),
    run({ title, minutes, day } = {}, ctx) {
      const s = ctx.store.getState();
      const date = resolveDay(day, s.today);
      const t = s.addTask({ title, estimatedHours: (Number(minutes) || DEFAULT_TASK_MINUTES) / 60, date });
      if (!t) return 'I need a title for the task.';
      return `Added “${t.title}” (${dur(timer.estimateMs(t))}) for ${dayLabel(date, s.today)}.`;
    },
  },
  {
    name: 'start_task',
    description: 'Start the timer on a task (by name). Without a name, starts the next task in the plan. Only one timer runs at a time.',
    parameters: S({ task: str('Task name or part of it; empty for the next one') }),
    run({ task } = {}, ctx) {
      const s = ctx.store.getState();
      const target = task ? pickTask(s.tasks, task) : remainingPlan(s.tasks, s.today, ctx.now).find((p) => !timer.isRunning(p.task))?.task;
      if (!target) return task ? `No open task matches “${task}”.` : 'Nothing left to start.';
      s.startTimer(target.id);
      return `Started “${target.title}”.${timer.estimateMs(target) ? ` ${dur(timer.remainingMs(target, ctx.now))} planned.` : ''}`;
    },
  },
  {
    name: 'pause_task',
    description: 'Pause the running timer.',
    parameters: S(),
    run(_, ctx) {
      const s = ctx.store.getState();
      const running = visibleTasks(s.tasks).find(timer.isRunning);
      if (!running) return 'No timer is running.';
      s.pauseTimer(running.id);
      return `Paused “${running.title}” at ${dur(timer.elapsedMs(running, ctx.now))}.`;
    },
  },
  {
    name: 'complete_task',
    description: 'Mark a task as done. Without a name, completes the running task.',
    parameters: S({ task: str('Task name; empty for the running task') }),
    run({ task } = {}, ctx) {
      const s = ctx.store.getState();
      const target = task ? pickTask(s.tasks, task) : visibleTasks(s.tasks).find(timer.isRunning);
      if (!target) return task ? `No open task matches “${task}”.` : 'Which task? Nothing is running.';
      s.toggleComplete(target.id);
      const left = remainingPlan(ctx.store.getState().tasks, s.today, ctx.now);
      return `Done: “${target.title}”. ${left.length ? `${plural(left.length, 'task')} left.` : 'That was the last one today.'}`;
    },
  },
  {
    name: 'update_task',
    description: 'Rename a task, change its estimate, or move it to another day.',
    parameters: S({ task: str('Existing task name'), title: str('New title'), minutes: num('New estimate in minutes'), day: str('Move to: today, tomorrow, weekday or YYYY-MM-DD') }, ['task']),
    run({ task, title, minutes, day } = {}, ctx) {
      const s = ctx.store.getState();
      const t = pickTask(s.tasks, task, { includeDone: true });
      if (!t) return `No task matches “${task}”.`;
      const patch = {};
      if (title) patch.title = title;
      if (minutes != null) patch.estimatedHours = Number(minutes) / 60;
      if (day) {
        patch.date = resolveDay(day, s.today);
        if (timer.isRunning(t)) s.pauseTimer(t.id);
      }
      s.updateTask(t.id, patch);
      const parts = [title && `renamed to “${title}”`, minutes != null && `estimate ${dur(minutes * MS_MINUTE)}`, day && `moved to ${dayLabel(patch.date, s.today)}`].filter(Boolean);
      return `Updated “${t.title}”: ${parts.join(', ') || 'no changes'}.`;
    },
  },
  {
    name: 'delete_task',
    description: 'Delete a task.',
    parameters: S({ task: str('Task name') }, ['task']),
    run({ task } = {}, ctx) {
      const s = ctx.store.getState();
      const t = pickTask(s.tasks, task, { includeDone: true });
      if (!t) return `No task matches “${task}”.`;
      s.deleteTask(t.id);
      return `Deleted “${t.title}”.`;
    },
  },
  {
    name: 'set_reminder',
    description: 'Remind the user at a time (notification on laptop and phone, spoken aloud).',
    parameters: S({ text: str('What to remind about'), when: str('"in 20 minutes", "5pm", "tomorrow 9am" or ISO local time "YYYY-MM-DDTHH:MM"') }, ['text', 'when']),
    run({ text, when } = {}, ctx) {
      const at = parseWhen(when, ctx.now);
      if (!at || at < ctx.now - MS_MINUTE) return `I couldn't understand the time “${when}”.`;
      const r = ctx.store.getState().addReminder({ text, at });
      if (!r) return 'What should I remind you about?';
      return `Reminder set ${describeWhen(at, ctx.now)}: ${r.text}.`;
    },
  },
  {
    name: 'list_reminders',
    description: 'List upcoming reminders.',
    parameters: S(),
    run(_, ctx) {
      const list = upcomingReminders(ctx.store.getState().reminders, ctx.now);
      if (!list.length) return 'No upcoming reminders.';
      return list.map((r) => `${describeWhen(r.at, ctx.now)} — ${r.text}`).join('\n');
    },
  },
  {
    name: 'cancel_reminder',
    description: 'Cancel an upcoming reminder by its text.',
    parameters: S({ text: str('Words from the reminder') }, ['text']),
    run({ text } = {}, ctx) {
      const s = ctx.store.getState();
      const q = String(text || '').toLowerCase();
      const r = upcomingReminders(s.reminders, ctx.now).find((x) => x.text.toLowerCase().includes(q) || q.includes(x.text.toLowerCase()));
      if (!r) return `No reminder matches “${text}”.`;
      s.cancelReminder(r.id);
      return `Cancelled the reminder “${r.text}”.`;
    },
  },
  {
    name: 'remember',
    description: 'Save a lasting fact about the user (preferences, routines, goals, people, places). Use whenever they share something worth remembering.',
    parameters: S({ fact: str('The fact, in third person, e.g. "Goes to the gym at 7am on weekdays"') }, ['fact']),
    run({ fact } = {}, ctx) {
      const m = ctx.store.getState().addMemory(fact);
      return m ? `I'll remember: ${m.text}` : 'Nothing to remember.';
    },
  },
  {
    name: 'forget',
    description: 'Forget a saved fact.',
    parameters: S({ fact: str('Words from the fact to forget') }, ['fact']),
    run({ fact } = {}, ctx) {
      const s = ctx.store.getState();
      const q = String(fact || '').toLowerCase();
      const hit = Object.values(s.memories || {}).find((m) => !m.deleted && m.text.toLowerCase().includes(q));
      if (!hit) return `I don't have anything saved about “${fact}”.`;
      s.removeMemory(hit.id);
      return `Forgotten: ${hit.text}`;
    },
  },
  {
    name: 'get_report',
    description: 'Productivity report for today, yesterday or the last 7 days.',
    parameters: S({ period: { type: 'string', enum: ['today', 'yesterday', 'week'] } }),
    run({ period = 'today' } = {}, ctx) {
      const s = ctx.store.getState();
      const goalHours = s.settings.dailyGoalHours ?? 6;
      if (period === 'week') {
        const days = [];
        for (let i = 6; i >= 0; i -= 1) days.push(computeDailyReport(s.tasks, shiftDateKey(s.today, -i), { goalHours, now: ctx.now }));
        const hours = days.reduce((a, d) => a + d.hoursWorked, 0);
        const done = days.reduce((a, d) => a + d.completedTasks, 0);
        const total = days.reduce((a, d) => a + d.totalTasks, 0);
        const best = [...days].sort((a, b) => b.hoursWorked - a.hoursWorked)[0];
        const goalDays = days.filter((d) => d.goalReached).length;
        return `Last 7 days: ${dur(hours * MS_HOUR)} focused, ${done}/${total} tasks done, goal reached on ${plural(goalDays, 'day')}.` + (best?.hoursWorked ? ` Best day ${best.date} with ${dur(best.hoursWorked * MS_HOUR)}.` : '');
      }
      const key = period === 'yesterday' ? shiftDateKey(s.today, -1) : s.today;
      const r = computeDailyReport(s.tasks, key, { goalHours, now: ctx.now });
      if (!r.totalTasks && !r.hoursWorked) return `Nothing tracked ${dayLabel(key, s.today)}.`;
      return `${dayLabel(key, s.today)}: ${r.completedTasks}/${r.totalTasks} tasks done, ${dur(r.hoursWorked * MS_HOUR)} focused of a ${goalHours}h goal, score ${r.productivityScore}%` + (r.efficiency != null ? `, estimate accuracy ${r.efficiency}%.` : '.');
    },
  },
  {
    name: 'get_activity',
    description: 'What the user is doing on the laptop now and which apps they used today (laptop only).',
    parameters: S(),
    desktopOnly: true,
    run(_, ctx) {
      const a = ctx.activity;
      if (!a) return 'Activity tracking is only available in the laptop app.';
      const now = a.current?.idleSec >= 120 ? `Away for ${dur(a.current.idleSec * 1000)}.` : a.current?.app ? `Now in ${a.current.app}${a.current.title ? ` — ${a.current.title}` : ''}.` : 'Current window unknown.';
      const top = (a.totals || []).slice(0, 6).map((t) => `${t.app} ${dur(t.ms)}`).join(', ');
      return `${now}${top ? ` Today: ${top}.` : ''}`;
    },
  },
  {
    name: 'suggest_plan',
    description: 'Suggest a plan for today using the learned habits (routines usually done today, realistic finish time, best focus hours).',
    parameters: S(),
    run(_, ctx) {
      const s = ctx.store.getState();
      const p = ctx.profile;
      const b = buildBriefing({ tasks: s.tasks, today: s.today, settings: s.settings, now: ctx.now });
      const out = [];
      if (b.plan.length) {
        const ratio = p?.estimateRatio && p.estimateRatio > 1 ? p.estimateRatio : 1;
        const realistic = ctx.now + b.remainingMs * ratio;
        out.push(`Planned: ${b.plan.map((x) => `${x.task.title} (${dur(x.remainingMs)})`).join(', ')}. Realistic finish ${clock(realistic)}${ratio > 1 ? ` (you usually need ${ratio}× your estimates)` : ''}.`);
      } else out.push('Nothing is planned yet.');
      const sug = p ? suggestRoutines(s.tasks, p, ctx.now) : [];
      if (sug.length) out.push(`You usually also do: ${sug.map((r) => `${r.title} (~${r.minutes}m${r.usualHour != null ? ` around ${clock(new Date(ctx.now).setHours(r.usualHour, 0, 0, 0))}` : ''})`).join(', ')}.`);
      if (p?.peakHours?.length) out.push(`Put deep work in your best hours: ${p.peakHours.map((h) => clock(new Date(ctx.now).setHours(h, 0, 0, 0))).join(', ')}.`);
      return out.join(' ');
    },
  },
  {
    name: 'update_settings',
    description: "Change the user's settings.",
    parameters: S({
      daily_goal_hours: num('Daily focus goal in hours'),
      work_start_hour: num('Work day start hour 0-23'),
      work_end_hour: num('Wrap-up hour 1-24'),
      assistant_name: str("The assistant's name"),
      city: str('City for weather'),
    }),
    run(args = {}, ctx) {
      const patch = {};
      if (args.daily_goal_hours) patch.dailyGoalHours = Math.min(24, Math.max(0.5, Number(args.daily_goal_hours)));
      if (args.work_start_hour != null) patch.workStartHour = Math.round(Math.min(23, Math.max(0, args.work_start_hour)));
      if (args.work_end_hour != null) patch.workEndHour = Math.round(Math.min(24, Math.max(1, args.work_end_hour)));
      if (args.assistant_name) patch.assistantName = String(args.assistant_name).slice(0, 30);
      if (args.city) patch.city = String(args.city).slice(0, 80);
      if (!Object.keys(patch).length) return 'No settings changed.';
      ctx.store.getState().updateSettings(patch);
      return `Settings updated: ${Object.entries(patch).map(([k, v]) => `${k} = ${v}`).join(', ')}.`;
    },
  },
  {
    name: 'get_weather',
    description: 'Current weather and today’s forecast.',
    parameters: S({ city: str('City; default the user’s city from settings') }),
    async run({ city } = {}, ctx) {
      if (!ctx.weather) return 'Weather is not available here.';
      const w = await ctx.weather(city || ctx.store.getState().settings.city);
      return describeWeather(w);
    },
  },
  {
    name: 'open_website',
    description: 'Open a website or a web search in the laptop browser.',
    parameters: S({ target: str('A URL, a site name like "youtube", or a search query') }, ['target']),
    desktopOnly: true,
    async run({ target } = {}, ctx) {
      if (!ctx.system?.openUrl) return 'I can only open websites from the laptop app.';
      const url = toUrl(target);
      await ctx.system.openUrl(url);
      return `Opened ${url.replace(/^https?:\/\//, '').slice(0, 80)}.`;
    },
  },
  {
    name: 'open_app',
    description: 'Launch an application on the laptop by name (e.g. "VS Code", "Spotify", "Terminal").',
    parameters: S({ name: str('Application name') }, ['name']),
    desktopOnly: true,
    async run({ name } = {}, ctx) {
      if (!ctx.system?.openApp) return 'I can only open apps from the laptop app.';
      const res = await ctx.system.openApp(name);
      return res?.ok ? `Opening ${res.name || name}.` : `I couldn't find an app called “${name}”.`;
    },
  },
];

const SITES = { youtube: 'youtube.com', gmail: 'mail.google.com', mail: 'mail.google.com', calendar: 'calendar.google.com', github: 'github.com', maps: 'maps.google.com', drive: 'drive.google.com', chatgpt: 'chatgpt.com', whatsapp: 'web.whatsapp.com', netflix: 'netflix.com', spotify: 'open.spotify.com', linkedin: 'linkedin.com', twitter: 'x.com', news: 'news.google.com' };

export function toUrl(target) {
  const t = String(target || '').trim();
  if (/^https?:\/\//i.test(t)) return t;
  const key = t.toLowerCase().replace(/^(the\s+)/, '');
  if (SITES[key]) return `https://${SITES[key]}`;
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(t)) return `https://${t}`;
  return `https://www.google.com/search?q=${encodeURIComponent(t)}`;
}

export function upcomingReminders(reminders = {}, now = Date.now()) {
  return Object.values(reminders)
    .filter((r) => r && !r.deleted && !r.done && r.at >= now - 12 * MS_HOUR)
    .sort((a, b) => a.at - b.at);
}

export function dueReminders(reminders = {}, now = Date.now()) {
  return Object.values(reminders).filter((r) => r && !r.deleted && !r.done && r.at <= now);
}

export function toolsFor(platform) {
  return TOOLS.filter((t) => platform === 'desktop' || !t.desktopOnly);
}

export async function executeTool(name, args, ctx) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return { ok: false, text: `Unknown tool ${name}.` };
  if (tool.desktopOnly && ctx.platform !== 'desktop') return { ok: false, text: 'That only works from the laptop app.' };
  try {
    const text = await tool.run(args || {}, ctx);
    return { ok: !/^(No |I couldn't|I can only|Nothing|Unknown|Which task)/.test(text), text };
  } catch (e) {
    return { ok: false, text: `That failed: ${e?.message || e}` };
  }
}

// ---- system prompt --------------------------------------------------------------------

export function buildSystemPrompt(ctx) {
  const s = ctx.store.getState();
  const now = ctx.now;
  const assistant = s.settings.assistantName || 'Atlas';
  const b = buildBriefing({ tasks: s.tasks, today: s.today, settings: s.settings, now, name: ctx.name });
  const d = new Date(now);
  const tz = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return '';
    }
  })();
  const todays = visibleTasks(s.tasks).filter((t) => t.date === s.today || timer.isRunning(t));
  const tomorrow = visibleTasks(s.tasks).filter((t) => t.date === shiftDateKey(s.today, 1));
  const mem = Object.values(s.memories || {}).filter((m) => !m.deleted).sort((a, b2) => a.createdAt - b2.createdAt).slice(-40);
  const rem = upcomingReminders(s.reminders, now).slice(0, 8);
  const p = ctx.profile;
  const a = ctx.activity;

  return [
    `You are ${assistant}, ${ctx.name || 'the user'}'s personal AI assistant inside LifeTracker — think J.A.R.V.I.S.: calm, warm, a little witty, very capable and proactive. You live on their laptop and phone, track their day and help them get everything done.`,
    `Now: ${d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}, ${clock(now)}${tz ? ` (${tz})` : ''}. They are talking to you from their ${ctx.platform === 'desktop' ? 'laptop' : 'phone'}.`,
    '',
    'How to behave:',
    '- Use the tools to read or change tasks, timers, reminders, memory, settings' + (ctx.platform === 'desktop' ? ', and to open websites/apps' : '') + '. Never say you did something unless the tool call succeeded.',
    '- Your replies are read aloud: usually 1–3 short sentences, natural speech, no markdown, no bullet lists unless asked.',
    '- For anything else (questions, facts, advice, maths, writing, ideas) just answer from your own knowledge.',
    '- Durations go to tools in minutes. Reminder times as phrases like "in 20 minutes", "5pm", "tomorrow 9am".',
    '- When they tell you something lasting about themselves (habits, preferences, goals, people), call remember.',
    '- Be proactive: if they are behind, overloaded or distracted, say so kindly and suggest one concrete next step.',
    '',
    `Today: ${b.headline}. ${b.lines.join(' ')}`,
    todays.length ? `Today's tasks:\n${todays.map((t) => `- ${taskLine(t, now)}`).join('\n')}` : "Today's tasks: none yet.",
    tomorrow.length ? `Tomorrow: ${tomorrow.map((t) => t.title).join(', ')}` : '',
    rem.length ? `Upcoming reminders:\n${rem.map((r) => `- ${describeWhen(r.at, now)}: ${r.text}`).join('\n')}` : '',
    p?.insights?.length ? `Learned habits: ${p.insights.join(' ')}` : '',
    p?.routines?.length ? `Recurring tasks: ${p.routines.map((r) => `${r.title} (~${r.minutes}m, ${r.days} of the last 28 days)`).join('; ')}` : '',
    mem.length ? `What you remember about them:\n${mem.map((m) => `- ${m.text}`).join('\n')}` : '',
    a?.current ? `Laptop right now: ${a.current.idleSec >= 120 ? `away for ${dur(a.current.idleSec * 1000)}` : a.current.app ? `using ${a.current.app}${a.current.title ? ` (${a.current.title.slice(0, 80)})` : ''}` : 'unknown'}.` : '',
    s.settings.city ? `Their city: ${s.settings.city}.` : '',
  ]
    .filter((x) => x !== '')
    .join('\n');
}

// ---- the loop ---------------------------------------------------------------------------

/**
 * Ask the AI. `history` is prior {role:'user'|'assistant', content} turns.
 * @returns {Promise<{ reply: string, actions: Array<{name, args, ok, text}> }>}
 */
export async function runAgent({ provider, input, history = [], ctx, maxSteps = 6 }) {
  const system = buildSystemPrompt(ctx);
  const tools = toolsFor(ctx.platform).map(({ name, description, parameters }) => ({ name, description, parameters }));
  const messages = [...history.slice(-12), { role: 'user', content: input }];
  const actions = [];
  for (let step = 0; step < maxSteps; step += 1) {
    const res = await provider.chat({ system, messages, tools });
    if (!res.toolCalls?.length) return { reply: res.text || (actions.length ? actions.map((x) => x.text).join(' ') : 'Okay.'), actions };
    messages.push({ role: 'assistant', content: res.text || '', toolCalls: res.toolCalls });
    for (const call of res.toolCalls) {
      const out = await executeTool(call.name, call.args, ctx);
      actions.push({ name: call.name, args: call.args, ...out });
      messages.push({ role: 'tool', toolCallId: call.id, name: call.name, content: out.text });
    }
  }
  return { reply: actions.map((x) => x.text).join(' ') || 'Done.', actions };
}

// ---- built-in brain (no AI) ------------------------------------------------------------------

const WHEN_TAIL = /\s+((?:in|after)\s+.+|at\s+.+|by\s+.+|tomorrow(?:\s+.*)?|tonight|this (?:morning|afternoon|evening))$/i;
const WHEN_HEAD = /^((?:in|after)\s+\S+(?:\s+(?:minutes?|mins?|hours?|hrs?|h|m|seconds?))?|at\s+\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?|tomorrow(?:\s+at\s+\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?)?|tonight)\s+(?:to\s+)?(.+)$/i;

export function parseReminder(text, now = Date.now()) {
  const body = text.replace(/^(please\s+)?(remind me|reminder|set a reminder|alert me)\s*(?:(?:to|about|that)\s+)?/i, '').trim();
  let m = body.match(WHEN_HEAD);
  if (m) {
    const at = parseWhen(m[1].replace(/^after\s+/i, 'in '), now);
    if (at) return { text: m[2].trim(), at };
  }
  m = body.match(WHEN_TAIL);
  if (m) {
    const at = parseWhen(m[1].replace(/^after\s+/i, 'in ').replace(/^by\s+/i, ''), now);
    if (at) return { text: body.slice(0, m.index).replace(/^to\s+/i, '').trim(), at };
  }
  return null;
}

/** Intent for the built-in brain → tool call. */
export function parseIntent(input, now = Date.now()) {
  const text = String(input || '').trim().replace(/[.!]+$/, '');
  const lower = text.toLowerCase();
  let m;
  if (!text) return null;
  if (/^(remind me|reminder|set a reminder|alert me)\b/i.test(text)) {
    const r = parseReminder(text, now);
    return r ? { tool: 'set_reminder', args: { text: r.text, when: r.at } } : { say: 'When should I remind you? e.g. “remind me in 20 minutes to stretch”.' };
  }
  if (/^(my )?reminders$|what are my reminders|list reminders/.test(lower)) return { tool: 'list_reminders' };
  if ((m = text.match(/^(?:cancel|delete|remove) (?:the )?reminder(?: (?:to|about))?\s+(.+)$/i))) return { tool: 'cancel_reminder', args: { text: m[1] } };
  if ((m = text.match(/^remember(?: that)?\s+(.+)$/i))) return { tool: 'remember', args: { fact: m[1] } };
  if ((m = text.match(/^forget(?: that| about)?\s+(.+)$/i))) return { tool: 'forget', args: { fact: m[1] } };
  if (/plan (my|the) day|what should i do|suggest|plan today/.test(lower)) return { tool: 'suggest_plan' };
  if ((m = lower.match(/weather(?: (?:in|at|for) (.+))?/))) return { tool: 'get_weather', args: { city: m[1] } };
  if (/^(what('?s| is) the )?time( is it)?\??$|what time is it/.test(lower)) return { say: `It's ${clock(now)}.` };
  if (/what('?s| is) (the )?date|what day is it/.test(lower)) return { say: `It's ${new Date(now).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}.` };
  if ((m = text.match(/^(?:open|launch|start app)\s+(.+?)(?:\s+app)?$/i)) && !/^(task|timer)\b/i.test(m[1])) {
    const target = m[1].trim();
    return /\.|youtube|gmail|mail|calendar|github|maps|drive|whatsapp|netflix|linkedin|twitter|news/i.test(target) ? { tool: 'open_website', args: { target } } : { tool: 'open_app', args: { name: target } };
  }
  if ((m = text.match(/^(?:search|google|look up)(?: for)?\s+(.+)$/i))) return { tool: 'open_website', args: { target: m[1] } };
  if ((m = text.match(/^(?:move|push|postpone)\s+(.+?)\s+to\s+(tomorrow|today|\w+day|\d{4}-\d{2}-\d{2})$/i))) return { tool: 'update_task', args: { task: m[1], day: m[2] } };
  if ((m = text.match(/^(?:delete|remove)\s+(?:task\s+)?(.+)$/i))) return { tool: 'delete_task', args: { task: m[1] } };
  if (/how (was|did) (my|i do this) week|weekly report|this week/.test(lower)) return { tool: 'get_report', args: { period: 'week' } };
  if (/yesterday/.test(lower) && /report|how did i|summary/.test(lower)) return { tool: 'get_report', args: { period: 'yesterday' } };
  if (/what am i doing|which apps?|my activity|screen time/.test(lower)) return { tool: 'get_activity' };
  if (/tomorrow/.test(lower) && /task|plan|what/.test(lower)) return { tool: 'list_tasks', args: { day: 'tomorrow' } };
  if (/^(hi|hello|hey|yo|good (morning|afternoon|evening))\b/.test(lower)) return { say: 'greeting' };
  if (/^(thanks|thank you|thx|cheers)/.test(lower)) return { say: 'Anytime.' };
  if (/who are you|what can you do|^help$|commands/.test(lower)) return { say: 'help' };
  // legacy commands
  if ((m = text.match(/^(?:add|new|create|todo|plan)\s+(?:task\s+)?(.+)$/i))) {
    const d = m[1].match(/(?:\bfor\s+)?(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)\b/i);
    const minutes = d ? parseFloat(d[1].replace(',', '.')) * (/^h/i.test(d[2]) ? 60 : 1) : undefined;
    let title = (d ? m[1].replace(d[0], '') : m[1]).replace(/\s+(for|of)\s*$/i, '').trim();
    let day;
    const dm = title.match(/\s+(tomorrow|today)$/i);
    if (dm) {
      day = dm[1];
      title = title.slice(0, dm.index);
    }
    return { tool: 'add_task', args: { title, minutes, day } };
  }
  if ((m = text.match(/^(?:start|begin|work on|resume|track)\s+(.+)$/i))) return { tool: 'start_task', args: { task: m[1] } };
  if (/^(start|resume|go|start next)$/.test(lower)) return { tool: 'start_task' };
  if (/^(pause|stop|break|hold)( (the )?timer)?$/.test(lower)) return { tool: 'pause_task' };
  if ((m = text.match(/^(?:done|finish(?:ed)?|complete(?:d)?|mark done)\s*(.*)$/i))) return { tool: 'complete_task', args: { task: m[1] || undefined } };
  if (/(what'?s|what is) (left|remaining|next)|remaining|^left$|^next$|to ?do|my tasks|task list/.test(lower)) return { tool: 'list_tasks', args: { include_completed: false } };
  if (/status|where am i|how am i doing|brief(ing)?|update|time left/.test(lower)) return { tool: 'get_status' };
  if (/report|summary|how did i do|recap/.test(lower)) return { tool: 'get_report', args: { period: 'today' } };
  return null;
}

export const BUILTIN_HELP = [
  ...COMMAND_HELP,
  'remind me in 20 min to stretch · remind me at 5pm to call mom',
  'remember that I go to the gym at 7',
  'plan my day · how was my week · weather',
  'open youtube · search best pomodoro apps · open vs code (laptop)',
  'move report to tomorrow · delete gym',
];

/** Answer without any AI model. */
export async function runBuiltin({ input, ctx }) {
  const intent = parseIntent(input, ctx.now);
  const s = ctx.store.getState();
  const assistant = s.settings.assistantName || 'Atlas';
  if (!intent)
    return {
      reply: `I can't answer open questions yet — connect a brain in Settings → Brain (Gemini and Groq are free). Meanwhile I understand things like:\n${BUILTIN_HELP.slice(0, 6).join('\n')}`,
      actions: [],
      understood: false,
    };
  if (intent.say === 'greeting') {
    const b = buildBriefing({ tasks: s.tasks, today: s.today, settings: s.settings, now: ctx.now, name: ctx.name });
    return { reply: `${greeting(ctx.now)}${ctx.name ? `, ${ctx.name}` : ''}. ${b.headline}.`, actions: [] };
  }
  if (intent.say === 'help') return { reply: `I'm ${assistant}. Try:\n${BUILTIN_HELP.join('\n')}`, actions: [] };
  if (intent.say) return { reply: intent.say, actions: [] };
  const out = await executeTool(intent.tool, intent.args, ctx);
  return { reply: out.text, actions: [{ name: intent.tool, args: intent.args, ...out }] };
}

