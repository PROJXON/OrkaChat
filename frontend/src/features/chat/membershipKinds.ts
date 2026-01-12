const MEMBERSHIP_SYSTEM_KINDS = new Set([
  'added',
  'ban',
  'unban',
  'unbanned',
  'left',
  'removed',
  'kick',
  'kicked',
  'banned',
  'update',
]);

export function isMembershipSystemKind(kind: unknown): boolean {
  return typeof kind === 'string' && kind.length > 0 && MEMBERSHIP_SYSTEM_KINDS.has(kind);
}
