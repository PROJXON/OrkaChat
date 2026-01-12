import type { ConversationRow, TitleOverrides, UnreadRow } from '../types/conversations';
export type { ConversationRow, TitleOverrides, UnreadRow } from '../types/conversations';

export function normalizeTitle(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : '';
}

export function setTitleOverride(
  overrides: TitleOverrides,
  convIdRaw: unknown,
  titleRaw: unknown,
): TitleOverrides {
  const convId = typeof convIdRaw === 'string' ? convIdRaw.trim() : '';
  const title = normalizeTitle(titleRaw);
  if (!convId || convId === 'global' || !title) return overrides || {};
  return { ...(overrides || {}), [convId]: title };
}

export function applyTitleOverridesToConversations<T extends ConversationRow>(
  conversations: T[],
  overrides: TitleOverrides,
): T[] {
  const ov = overrides || {};
  if (!conversations?.length) return conversations || [];
  return conversations.map((c) => {
    const id = typeof c?.conversationId === 'string' ? c.conversationId : '';
    const t = id ? normalizeTitle(ov[id]) : '';
    return t ? ({ ...c, peerDisplayName: t } as T) : c;
  });
}

export function applyTitleOverridesToUnreadMap(
  unread: Record<string, UnreadRow>,
  overrides: TitleOverrides,
): Record<string, UnreadRow> {
  const merged: Record<string, UnreadRow> = { ...(unread || {}) };
  const ov = overrides || {};
  for (const [convId, titleRaw] of Object.entries(ov)) {
    if (!convId || !convId.startsWith('gdm#')) continue;
    const title = normalizeTitle(titleRaw);
    if (!title) continue;
    const existing = merged[convId];
    if (!existing) continue;
    const u = normalizeTitle(existing.user);
    if (u.startsWith('Added to group:'))
      merged[convId] = { ...existing, user: `Added to group: ${title}` };
    else merged[convId] = { ...existing, user: title };
  }
  return merged;
}

// ChatScreen header title helper (pure formatting).
export function getChatHeaderTitle(args: {
  isChannel: boolean;
  channelName?: string | null;
  peer?: string | null;
  isGroup: boolean;
  groupName?: string | null;
}): string {
  const channel = normalizeTitle(args.channelName);
  const peer = normalizeTitle(args.peer);
  const group = normalizeTitle(args.groupName);

  if (args.isChannel) return channel || '…';
  if (peer) {
    if (args.isGroup) return group || peer;
    return `DM with ${peer}`;
  }
  return 'Global Chat';
}
