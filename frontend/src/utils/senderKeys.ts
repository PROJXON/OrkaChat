export function getGuestSenderKey(m?: { userSub?: string | null; user?: string | null } | null): string {
  if (!m) return '';
  const sub = m.userSub ? String(m.userSub) : '';
  if (sub) return `sub:${sub}`;
  return `user:${String(m.user || '')
    .trim()
    .toLowerCase()}`;
}

export function getChatSenderKey(
  m: { userSub?: string | null; userLower?: string | null; user?: string | null },
  normalizeUser: (v: unknown) => string,
): string {
  // Keep behavior identical to ChatScreen's previous logic.
  const sub = m.userSub ? String(m.userSub) : '';
  const lower = m.userLower ? String(m.userLower) : '';
  return sub || lower || normalizeUser(m.user ?? 'anon');
}
