const DAY_MS = 24 * 60 * 60 * 1000;

function startOfLocalDayMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function formatParts(
  d: Date,
  opts: Intl.DateTimeFormatOptions
): { month?: string; day?: string; year?: string; weekday?: string } {
  const parts = new Intl.DateTimeFormat('en-US', opts).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return { month: get('month'), day: get('day'), year: get('year'), weekday: get('weekday') };
}

// Chats list date label:
// - last 6 days: "Mon", "Tue", ...
// - older: "Feb 6"
// - over a year: "Dec 15 2024"
export function formatChatActivityDate(epochMs: number, nowMs: number = Date.now()): string {
  const t = Number(epochMs || 0);
  if (!Number.isFinite(t) || t <= 0) return '';

  const d = new Date(t);
  const now = new Date(nowMs);
  const diffDays = Math.floor((startOfLocalDayMs(now) - startOfLocalDayMs(d)) / DAY_MS);

  if (diffDays <= 6) {
    // Short weekday (no punctuation)
    return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(d);
  }

  const includeYear = diffDays >= 365;
  if (includeYear) {
    const { month, day, year } = formatParts(d, { month: 'short', day: 'numeric', year: 'numeric' });
    return [month, day, year].filter(Boolean).join(' ');
  }

  const { month, day } = formatParts(d, { month: 'short', day: 'numeric' });
  return [month, day].filter(Boolean).join(' ');
}

