export function formatSeenLabel(readAtSec: number, now: Date = new Date()): string {
  const sec = Number(readAtSec || 0);
  if (!Number.isFinite(sec) || sec <= 0) return 'Seen';
  const dt = new Date(sec * 1000);
  const isToday =
    dt.getFullYear() === now.getFullYear() &&
    dt.getMonth() === now.getMonth() &&
    dt.getDate() === now.getDate();
  const time = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return isToday ? `Seen · ${time}` : `Seen · ${dt.toLocaleDateString()} · ${time}`;
}

export function getSeenLabelForCreatedAt(
  seenAtByCreatedAt: Record<string, number>,
  messageCreatedAtMs: number,
): string | null {
  const t = Number(seenAtByCreatedAt[String(messageCreatedAtMs)] || 0);
  if (!Number.isFinite(t) || t <= 0) return null;
  return formatSeenLabel(t);
}
