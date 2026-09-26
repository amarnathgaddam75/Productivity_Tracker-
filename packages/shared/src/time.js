// Date/time helpers. All "day" logic uses the device's local timezone so that
// "today" and the midnight reset match what the user sees on their clock.

export const MS_MINUTE = 60 * 1000;
export const MS_HOUR = 60 * MS_MINUTE;
export const MS_DAY = 24 * MS_HOUR;

const pad = (n) => String(n).padStart(2, '0');

/** Local calendar day key, e.g. "2026-09-26". */
export function dateKey(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** [start, end) epoch-ms bounds of the local day identified by `key`. */
export function dayBounds(key) {
  const [y, m, d] = key.split('-').map(Number);
  const start = new Date(y, m - 1, d).getTime();
  const end = new Date(y, m - 1, d + 1).getTime(); // DST-safe
  return [start, end];
}

/** Returns the day key `offset` days away from `key` (negative = past). */
export function shiftDateKey(key, offset) {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d + offset).getTime());
}

/** Milliseconds until the next local midnight. */
export function msUntilMidnight(now = Date.now()) {
  const [, end] = dayBounds(dateKey(now));
  return end - now;
}

/** "1:05" (h:mm) for durations; negative values are rendered with a leading "-". */
export function formatHM(ms) {
  const sign = ms < 0 ? '-' : '';
  const totalMin = Math.floor(Math.abs(ms) / MS_MINUTE);
  return `${sign}${Math.floor(totalMin / 60)}:${pad(totalMin % 60)}`;
}

/** { h, m, s } strings for a big clock display, e.g. { h: "01", m: "05", s: "09" }. */
export function clockParts(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    h: pad(Math.floor(total / 3600)),
    m: pad(Math.floor((total % 3600) / 60)),
    s: pad(total % 60),
  };
}

/** Human friendly duration, e.g. "2h 15m", "45m", "0m". */
export function formatDuration(ms) {
  const totalMin = Math.round(Math.max(0, ms) / MS_MINUTE);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/** Hours as a compact decimal string: 1.5 -> "1.5h", 2 -> "2h". */
export function formatHours(hours) {
  const rounded = Math.round(hours * 100) / 100;
  return `${rounded}h`;
}

export function formatDayLabel(key, today = dateKey()) {
  if (key === today) return 'Today';
  if (key === shiftDateKey(today, -1)) return 'Yesterday';
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
