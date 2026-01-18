const DAY_MS = 24 * 60 * 60 * 1000;

function startOfLocalDayMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function formatParts(
  d: Date,
  opts: Intl.DateTimeFormatOptions,
): { month?: string; day?: string; year?: string; weekday?: string } {
  const parts = new Intl.DateTimeFormat('en-US', opts).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return { month: get('month'), day: get('day'), year: get('year'), weekday: get('weekday') };
}

function formatTime(d: Date): string {
  // Use locale default for AM/PM vs 24h, but lock the fields we care about.
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function twoDigitYear(d: Date): string {
  const y = d.getFullYear();
  const yy = String(Math.abs(y) % 100).padStart(2, '0');
  return `'${yy}`;
}

function diffLocalDays(now: Date, then: Date): number {
  return Math.floor((startOfLocalDayMs(now) - startOfLocalDayMs(then)) / DAY_MS);
}

export type RelativeDateBucket = 'today' | 'last6days' | 'older' | 'olderThanYear';

export function getRelativeDateBucket(
  epochMs: number,
  nowMs: number = Date.now(),
): RelativeDateBucket {
  const t = Number(epochMs || 0);
  if (!Number.isFinite(t) || t <= 0) return 'older';
  const d = new Date(t);
  const now = new Date(nowMs);
  const days = diffLocalDays(now, d);
  if (days <= 0) return 'today';
  if (days <= 6) return 'last6days';
  if (days >= 365) return 'olderThanYear';
  return 'older';
}

/**
 * Message/receipt timestamp formatting:
 * - today: "HH:MM"
 * - 1-6 days ago: "Mon · HH:MM"
 * - older: "Feb 6 · HH:MM" (no year)
 * - >= 1 year: "Feb 6 '25 · HH:MM"
 */
export function formatMessageMetaTimestamp(epochMs: number, nowMs: number = Date.now()): string {
  const t = Number(epochMs || 0);
  if (!Number.isFinite(t) || t <= 0) return '';
  const d = new Date(t);
  const now = new Date(nowMs);
  const days = diffLocalDays(now, d);

  const time = formatTime(d);
  if (days <= 0) return time;

  if (days <= 6) {
    const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(d);
    return `${weekday} · ${time}`;
  }

  const { month, day } = formatParts(d, { month: 'short', day: 'numeric' });
  const md = [month, day].filter(Boolean).join(' ');
  if (days >= 365) return `${md} ${twoDigitYear(d)} · ${time}`;
  return `${md} · ${time}`;
}

// Chats list date label:
// - last 6 days: "Mon", "Tue", ...
// - older: "Feb 6"
// - over a year: "Dec 15 '24"
export function formatChatActivityDate(epochMs: number, nowMs: number = Date.now()): string {
  const t = Number(epochMs || 0);
  if (!Number.isFinite(t) || t <= 0) return '';

  const d = new Date(t);
  const now = new Date(nowMs);
  const diffDays = diffLocalDays(now, d);

  if (diffDays <= 6) {
    // Short weekday (no punctuation)
    return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(d);
  }

  const includeYear = diffDays >= 365;
  if (includeYear) {
    const { month, day } = formatParts(d, { month: 'short', day: 'numeric' });
    const md = [month, day].filter(Boolean).join(' ');
    return [md, twoDigitYear(d)].filter(Boolean).join(' ');
  }

  const { month, day } = formatParts(d, { month: 'short', day: 'numeric' });
  return [month, day].filter(Boolean).join(' ');
}
