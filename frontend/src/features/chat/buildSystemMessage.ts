import type { ChatMessage } from './types';

export function buildSystemChatMessageFromPayload(payload: any): ChatMessage {
  const createdAt = Number(payload?.createdAt || Date.now());
  const stableId =
    (payload?.messageId && String(payload.messageId)) ||
    (payload?.id && String(payload.id)) ||
    `sys-${createdAt}-${Math.random().toString(36).slice(2)}`;

  return {
    id: stableId,
    kind: 'system',
    systemKind: typeof payload?.systemKind === 'string' ? payload.systemKind : undefined,
    actorSub: typeof payload?.actorSub === 'string' ? payload.actorSub : undefined,
    actorUser: typeof payload?.actorUser === 'string' ? payload.actorUser : undefined,
    targetSub: typeof payload?.targetSub === 'string' ? payload.targetSub : undefined,
    targetUser: typeof payload?.targetUser === 'string' ? payload.targetUser : undefined,
    user: 'System',
    userLower: 'system',
    text: String(payload?.text || ''),
    rawText: String(payload?.text || ''),
    createdAt,
    localStatus: 'sent',
  };
}

