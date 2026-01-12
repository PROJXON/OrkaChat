import type { ChatMessage } from './types';

export function buildSystemChatMessageFromPayload(payload: unknown): ChatMessage {
  const rec = typeof payload === 'object' && payload != null ? (payload as Record<string, unknown>) : {};
  const createdAt = Number(rec.createdAt || Date.now());
  const messageIdRaw = rec.messageId;
  const idRaw = rec.id;
  const stableId =
    (typeof messageIdRaw === 'string' || typeof messageIdRaw === 'number' ? String(messageIdRaw) : '') ||
    (typeof idRaw === 'string' || typeof idRaw === 'number' ? String(idRaw) : '') ||
    `sys-${createdAt}-${Math.random().toString(36).slice(2)}`;

  return {
    id: stableId,
    kind: 'system',
    systemKind: typeof rec.systemKind === 'string' ? rec.systemKind : undefined,
    actorSub: typeof rec.actorSub === 'string' ? rec.actorSub : undefined,
    actorUser: typeof rec.actorUser === 'string' ? rec.actorUser : undefined,
    targetSub: typeof rec.targetSub === 'string' ? rec.targetSub : undefined,
    targetUser: typeof rec.targetUser === 'string' ? rec.targetUser : undefined,
    user: 'System',
    userLower: 'system',
    text: String(rec.text || ''),
    rawText: String(rec.text || ''),
    createdAt,
    localStatus: 'sent',
  };
}

