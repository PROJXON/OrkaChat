import type { EncryptedChatPayloadV1 } from '../../types/crypto';
import type { ReactionMap } from '../../types/reactions';
import { timestampId } from '../../utils/ids';
import type { ChatMessage } from './types';
import type { EncryptedGroupPayloadV1 } from './types';

export function buildIncomingChatMessageFromWsPayload(opts: {
  payload: unknown;
  encryptedPlaceholder: string;
  parseEncrypted: (rawText: string) => EncryptedChatPayloadV1 | null;
  parseGroupEncrypted: (rawText: string) => EncryptedGroupPayloadV1 | null;
  normalizeUser: (v: unknown) => string;
  normalizeReactions: (v: unknown) => ReactionMap | undefined;
}): ChatMessage {
  const payload =
    typeof opts.payload === 'object' && opts.payload != null
      ? (opts.payload as Record<string, unknown>)
      : {};
  const rawText =
    typeof payload.text === 'string'
      ? payload.text
      : payload.text && typeof payload.text === 'object'
        ? JSON.stringify(payload.text)
        : String(payload.text ?? '');

  const encrypted = opts.parseEncrypted(rawText);
  const groupEncrypted = opts.parseGroupEncrypted(rawText);
  const createdAt = Number(payload.createdAt || Date.now());
  const messageIdRaw = payload.messageId;
  const idRaw = payload.id;
  const stableId =
    (typeof messageIdRaw === 'string' || typeof messageIdRaw === 'number'
      ? String(messageIdRaw)
      : '') ||
    (typeof idRaw === 'string' || typeof idRaw === 'number' ? String(idRaw) : '') ||
    timestampId(createdAt);

  return {
    id: stableId,
    user: typeof payload.user === 'string' ? payload.user : undefined,
    userSub: typeof payload.userSub === 'string' ? payload.userSub : undefined,
    userLower:
      typeof payload.userLower === 'string'
        ? opts.normalizeUser(payload.userLower)
        : typeof payload.user === 'string'
          ? opts.normalizeUser(payload.user)
          : undefined,
    avatarBgColor:
      typeof payload.avatarBgColor === 'string' ? String(payload.avatarBgColor) : undefined,
    avatarTextColor:
      typeof payload.avatarTextColor === 'string' ? String(payload.avatarTextColor) : undefined,
    avatarImagePath:
      typeof payload.avatarImagePath === 'string' ? String(payload.avatarImagePath) : undefined,
    reactions: opts.normalizeReactions(payload.reactions),
    rawText,
    encrypted: encrypted ?? undefined,
    groupEncrypted: groupEncrypted ?? undefined,
    text: encrypted || groupEncrypted ? opts.encryptedPlaceholder : rawText,
    createdAt,
    expiresAt: typeof payload.expiresAt === 'number' ? payload.expiresAt : undefined,
    ttlSeconds: typeof payload.ttlSeconds === 'number' ? payload.ttlSeconds : undefined,
    localStatus: 'sent',
    editedAt: typeof payload.editedAt === 'number' ? payload.editedAt : undefined,
    deletedAt: typeof payload.deletedAt === 'number' ? payload.deletedAt : undefined,
    deletedBySub: typeof payload.deletedBySub === 'string' ? payload.deletedBySub : undefined,
    mentions: Array.isArray(payload.mentions)
      ? payload.mentions.map(String).filter(Boolean)
      : undefined,
    replyToCreatedAt:
      typeof payload.replyToCreatedAt === 'number' ? payload.replyToCreatedAt : undefined,
    replyToMessageId:
      typeof payload.replyToMessageId === 'string' ? payload.replyToMessageId : undefined,
    replyToUserSub: typeof payload.replyToUserSub === 'string' ? payload.replyToUserSub : undefined,
    replyToPreview: typeof payload.replyToPreview === 'string' ? payload.replyToPreview : undefined,
  };
}
