// Turns "in 20 minutes", "at 5pm", "tomorrow 9:30", "tonight" or an ISO date
// into a timestamp. Used by reminders (typed commands and the AI agent).

import { MS_MINUTE, MS_HOUR } from './time.js';

const WORD_NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, ten: 10, fifteen: 15, twenty: 20, thirty: 30, 'forty five': 45, half: 0.5 };

function atTime(base, h, m) {
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

/**
 * @param {string|number} input
 * @param {number} [now]
 * @returns {number|null} timestamp in ms
 */
export function parseWhen(input, now = Date.now()) {
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  const text = String(input || '').trim().toLowerCase();
  if (!text) return null;

  // ISO / full dates from the AI ("2026-09-27T09:00", "2026-09-27 09:00")
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const t = Date.parse(text.replace(' ', 'T'));
    return Number.isNaN(t) ? null : t;
  }

  // relative: "in 20 min", "in an hour", "in half an hour", "20 minutes", "in 1h30"
  let m = text.match(/^(?:in\s+)?(\d+(?:\.\d+)?|a|an|one|two|three|four|five|ten|fifteen|twenty|thirty|half)\s*(?:an?\s+)?(s|sec|secs|seconds?|m|min|mins|minutes?|h|hr|hrs|hours?)(?:\s*(\d+)\s*(?:m|min|mins|minutes?)?)?$/);
  if (m) {
    const n = WORD_NUM[m[1]] ?? parseFloat(m[1]);
    const unit = m[2][0];
    let ms = unit === 's' ? n * 1000 : unit === 'm' ? n * MS_MINUTE : n * MS_HOUR;
    if (m[3]) ms += Number(m[3]) * MS_MINUTE;
    return now + ms;
  }

  // absolute, optionally "tomorrow"
  let day = 0;
  let rest = text;
  if (/\btomorrow\b/.test(rest)) {
    day = 1;
    rest = rest.replace(/\btomorrow\b/, '').trim();
  } else if (/\btoday\b/.test(rest)) rest = rest.replace(/\btoday\b/, '').trim();
  rest = rest.replace(/^(at|by|around)\s+/, '').trim();
  const base = now + day * 24 * MS_HOUR;

  if (rest === '' && day) return atTime(base, 9, 0);
  if (/^(tonight|this evening)$/.test(rest)) return atTime(base, 20, 0);
  if (/^(this )?morning$/.test(rest)) return atTime(base, 9, 0);
  if (/^(this )?afternoon$/.test(rest)) return atTime(base, 14, 0);
  if (/^noon|midday$/.test(rest)) return atTime(base, 12, 0);
  if (/^midnight$/.test(rest)) return atTime(base + 24 * MS_HOUR, 0, 0);

  m = rest.match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] || 0);
  const ampm = m[3]?.[0];
  if (h > 23 || min > 59) return null;
  if (ampm === 'p' && h < 12) h += 12;
  if (ampm === 'a' && h === 12) h = 0;
  let t = atTime(base, h, min);
  if (!day && t <= now) {
    // "at 5" when it's 3pm means 5pm; otherwise the next day
    if (!ampm && h < 12 && atTime(base, h + 12, min) > now) t = atTime(base, h + 12, min);
    else t += 24 * MS_HOUR;
  }
  return t;
}

/** "in 25 min" / "at 5:30 PM" / "tomorrow 9:00 AM" for replies. */
export function describeWhen(ts, now = Date.now()) {
  const diff = ts - now;
  const clock = new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (diff > 0 && diff < 90 * MS_MINUTE) return `in ${Math.max(1, Math.round(diff / MS_MINUTE))} min`;
  const d = new Date(ts);
  const n = new Date(now);
  const tomorrow = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
  if (d.toDateString() === n.toDateString()) return `at ${clock}`;
  if (d.toDateString() === tomorrow.toDateString()) return `tomorrow at ${clock}`;
  return `${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} at ${clock}`;
}
