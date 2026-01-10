export function getGuestSenderKey(m?: { userSub?: unknown; user?: unknown } | null): string {
  if (!m) return '';
  const sub = m.userSub ? String(m.userSub) : '';
  if (sub) return `sub:${sub}`;
  return `user:${String(m.user || '')
    .trim()
    .toLowerCase()}`;
}

export function getChatSenderKey(
  m: { userSub?: unknown; userLower?: unknown; user?: unknown },
  normalizeUser: (v: unknown) => string,
): string {
  // Keep behavior identical to ChatScreen's previous logic.
  const sub = m.userSub ? String(m.userSub) : '';
  const lower = m.userLower ? String(m.userLower) : '';
  return sub || lower || normalizeUser(m.user ?? 'anon');
}
