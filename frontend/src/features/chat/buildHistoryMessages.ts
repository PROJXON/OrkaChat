import type { EncryptedChatPayloadV1 } from '../../types/crypto';
import type { ReactionMap } from '../../types/reactions';
import { timestampId } from '../../utils/ids';
import type { ChatMessage, EncryptedGroupPayloadV1 } from './types';

export function buildHistoryMessagesFromApiItems(opts: {
  rawItems: unknown;
  encryptedPlaceholder: string;
  parseEncrypted: (rawText: string) => EncryptedChatPayloadV1 | null;
  parseGroupEncrypted: (rawText: string) => EncryptedGroupPayloadV1 | null;
  normalizeUser: (v: unknown) => string;
  normalizeReactions: (v: unknown) => ReactionMap | undefined;
}): ChatMessage[] {
  const items = Array.isArray(opts.rawItems) ? opts.rawItems : [];

  const normalized: ChatMessage[] = items
    .map((it: any) => {
      const rawText = typeof it.text === 'string' ? String(it.text) : '';
      const kind = typeof it.kind === 'string' && it.kind === 'system' ? 'system' : undefined;
      const encrypted = kind ? null : opts.parseEncrypted(rawText);
      const groupEncrypted = kind ? null : opts.parseGroupEncrypted(rawText);
      const deletedAt = typeof it.deletedAt === 'number' ? it.deletedAt : undefined;
      return {
        id: String(it.messageId ?? timestampId(it.createdAt ?? Date.now())),
        kind,
        systemKind: typeof it.systemKind === 'string' ? it.systemKind : undefined,
        actorSub: typeof it.actorSub === 'string' ? it.actorSub : undefined,
        actorUser: typeof it.actorUser === 'string' ? it.actorUser : undefined,
        targetSub: typeof it.targetSub === 'string' ? it.targetSub : undefined,
        targetUser: typeof it.targetUser === 'string' ? it.targetUser : undefined,
        user: kind ? 'System' : (it.user ?? 'anon'),
        userSub: kind ? undefined : typeof it.userSub === 'string' ? it.userSub : undefined,
        userLower: kind
          ? 'system'
          : typeof it.userLower === 'string'
            ? opts.normalizeUser(it.userLower)
            : opts.normalizeUser(String(it.user ?? 'anon')),
        avatarBgColor: typeof it.avatarBgColor === 'string' ? String(it.avatarBgColor) : undefined,
        avatarTextColor: typeof it.avatarTextColor === 'string' ? String(it.avatarTextColor) : undefined,
        avatarImagePath: typeof it.avatarImagePath === 'string' ? String(it.avatarImagePath) : undefined,
        editedAt: typeof it.editedAt === 'number' ? it.editedAt : undefined,
        deletedAt,
        deletedBySub: typeof it.deletedBySub === 'string' ? it.deletedBySub : undefined,
        reactions: opts.normalizeReactions((it as any)?.reactions),
        mentions: Array.isArray((it as any)?.mentions) ? (it as any).mentions.map(String).filter(Boolean) : undefined,
        replyToCreatedAt: typeof (it as any)?.replyToCreatedAt === 'number' ? (it as any).replyToCreatedAt : undefined,
        replyToMessageId: typeof (it as any)?.replyToMessageId === 'string' ? (it as any).replyToMessageId : undefined,
        replyToUserSub: typeof (it as any)?.replyToUserSub === 'string' ? (it as any).replyToUserSub : undefined,
        replyToPreview: typeof (it as any)?.replyToPreview === 'string' ? (it as any).replyToPreview : undefined,
        rawText,
        encrypted: encrypted ?? undefined,
        groupEncrypted: groupEncrypted ?? undefined,
        text: deletedAt ? '' : encrypted || groupEncrypted ? opts.encryptedPlaceholder : rawText,
        createdAt: Number(it.createdAt ?? Date.now()),
        expiresAt: typeof it.expiresAt === 'number' ? it.expiresAt : undefined,
        ttlSeconds: typeof it.ttlSeconds === 'number' ? it.ttlSeconds : undefined,
      } as ChatMessage;
    })
    .filter((m: ChatMessage) => m.text.length > 0)
    .sort((a: ChatMessage, b: ChatMessage) => b.createdAt - a.createdAt);

  return normalized;
}

