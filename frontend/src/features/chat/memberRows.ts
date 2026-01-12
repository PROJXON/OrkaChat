import type { MemberRow, MemberStatus } from '../../types/members';

function isMemberStatus(v: unknown): v is MemberStatus {
  return v === 'active' || v === 'banned' || v === 'left';
}

export function toMemberRow(v: unknown): MemberRow | null {
  if (!v || typeof v !== 'object') return null;
  const rec = v as Record<string, unknown>;
  const memberSub = typeof rec.memberSub === 'string' ? rec.memberSub.trim() : '';
  if (!memberSub) return null;
  return {
    memberSub,
    displayName: typeof rec.displayName === 'string' ? rec.displayName : undefined,
    isAdmin: typeof rec.isAdmin === 'boolean' ? rec.isAdmin : undefined,
    status: isMemberStatus(rec.status) ? rec.status : undefined,
    avatarBgColor: typeof rec.avatarBgColor === 'string' ? rec.avatarBgColor : undefined,
    avatarTextColor: typeof rec.avatarTextColor === 'string' ? rec.avatarTextColor : undefined,
    avatarImagePath: typeof rec.avatarImagePath === 'string' ? rec.avatarImagePath : undefined,
  };
}

export function isVisibleMemberRow(m: unknown): boolean {
  if (!m || typeof m !== 'object') return false;
  const rec = m as Record<string, unknown>;
  return rec.status === 'active' || rec.status === 'banned';
}

