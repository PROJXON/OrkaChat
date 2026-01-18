import { formatMessageMetaTimestamp } from './chatDates';

export function formatSeenLabel(readAtSec: number, now: Date = new Date()): string {
  const sec = Number(readAtSec || 0);
  if (!Number.isFinite(sec) || sec <= 0) return 'Seen';
  const dt = new Date(sec * 1000);
  const stamp = formatMessageMetaTimestamp(dt.getTime(), now.getTime());
  return stamp ? `Seen · ${stamp}` : 'Seen';
}

export function getSeenLabelForCreatedAt(
  seenAtByCreatedAt: Record<string, number>,
  messageCreatedAtMs: number,
): string | null {
  const t = Number(seenAtByCreatedAt[String(messageCreatedAtMs)] || 0);
  if (!Number.isFinite(t) || t <= 0) return null;
  return formatSeenLabel(t);
}
