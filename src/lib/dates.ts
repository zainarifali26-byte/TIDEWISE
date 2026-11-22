// Calendar-date helpers. Dates are plain "YYYY-MM-DD" strings in local time,
// which keeps them timezone-safe for a budgeting app.

export function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISO(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function today() {
  return toISO(new Date());
}

export function addDays(s: string, n: number) {
  const d = fromISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function addMonths(s: string, n: number) {
  const d = fromISO(s);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toISO(d);
}

export function daysBetween(a: string, b: string) {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86_400_000);
}

/** "2026-11" */
export function monthKey(s: string) {
  return s.slice(0, 7);
}

export function startOfMonth(s: string) {
  return `${s.slice(0, 7)}-01`;
}

export function daysInMonth(s: string) {
  const d = fromISO(s);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export function dayOfMonth(s: string) {
  return Number(s.slice(8, 10));
}

const monthShort = new Intl.DateTimeFormat('en-US', { month: 'short' });
const monthLong = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const dayLabel = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const fullDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export const fmt = {
  monthShort: (s: string) => monthShort.format(fromISO(s.length === 7 ? `${s}-01` : s)),
  monthLong: (s: string) => monthLong.format(fromISO(s.length === 7 ? `${s}-01` : s)),
  day: (s: string) => dayLabel.format(fromISO(s)),
  short: (s: string) => shortDate.format(fromISO(s)),
  full: (s: string) => fullDate.format(fromISO(s)),
};

export function relativeDay(s: string, ref = today()) {
  const diff = daysBetween(ref, s);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  if (diff > 1 && diff < 7) return `In ${diff} days`;
  return fmt.day(s);
}
