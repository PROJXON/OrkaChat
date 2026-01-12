import type { EncryptedChatPayloadV1 } from '../../types/crypto';
import type { ReactionMap } from '../../types/reactions';
import { timestampId } from '../../utils/ids';
import type { ChatMessage, EncryptedGroupPayloadV1 } from './types';

type ApiHistoryItem = {
  messageId?: unknown;
  text?: unknown;
  kind?: unknown;
  systemKind?: unknown;
  actorSub?: unknown;
  actorUser?: unknown;
  targetSub?: unknown;
  targetUser?: unknown;
  user?: unknown;
  userSub?: unknown;
  userLower?: unknown;
  avatarBgColor?: unknown;
  avatarTextColor?: unknown;
  avatarImagePath?: unknown;
  editedAt?: unknown;
  deletedAt?: unknown;
  deletedBySub?: unknown;
  reactions?: unknown;
  mentions?: unknown;
  replyToCreatedAt?: unknown;
  replyToMessageId?: unknown;
  replyToUserSub?: unknown;
  replyToPreview?: unknown;
  createdAt?: unknown;
  expiresAt?: unknown;
  ttlSeconds?: unknown;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object";
}

function asApiHistoryItem(v: unknown): ApiHistoryItem {
  return isRecord(v) ? (v as ApiHistoryItem) : {};
}

function toStringOrEmpty(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

function toNumberOrUndefined(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

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
    .map((raw) => {
      const it = asApiHistoryItem(raw);
      const rawText = toStringOrEmpty(it.text);
      const kind: ChatMessage['kind'] = it.kind === 'system' ? 'system' : undefined;
      const encrypted = kind ? null : opts.parseEncrypted(rawText);
      const groupEncrypted = kind ? null : opts.parseGroupEncrypted(rawText);
      const deletedAt = toNumberOrUndefined(it.deletedAt);
      const createdAt = toNumberOrUndefined(it.createdAt) ?? Date.now();
      const messageId = it.messageId == null ? '' : String(it.messageId);

      const mentions =
        Array.isArray(it.mentions) && it.mentions.length ? it.mentions.map((m) => String(m)).filter(Boolean) : undefined;

      return {
        id: (messageId || timestampId(createdAt)) as string,
        kind,
        systemKind: typeof it.systemKind === 'string' ? it.systemKind : undefined,
        actorSub: typeof it.actorSub === 'string' ? it.actorSub : undefined,
        actorUser: typeof it.actorUser === 'string' ? it.actorUser : undefined,
        targetSub: typeof it.targetSub === 'string' ? it.targetSub : undefined,
        targetUser: typeof it.targetUser === 'string' ? it.targetUser : undefined,
        user: kind ? 'System' : (typeof it.user === 'string' ? it.user : 'anon'),
        userSub: kind ? undefined : typeof it.userSub === 'string' ? it.userSub : undefined,
        userLower: kind
          ? 'system'
          : typeof it.userLower === 'string'
            ? opts.normalizeUser(it.userLower)
            : opts.normalizeUser(typeof it.user === 'string' ? it.user : 'anon'),
        avatarBgColor: typeof it.avatarBgColor === 'string' ? it.avatarBgColor : undefined,
        avatarTextColor: typeof it.avatarTextColor === 'string' ? it.avatarTextColor : undefined,
        avatarImagePath: typeof it.avatarImagePath === 'string' ? it.avatarImagePath : undefined,
        editedAt: toNumberOrUndefined(it.editedAt),
        deletedAt,
        deletedBySub: typeof it.deletedBySub === 'string' ? it.deletedBySub : undefined,
        reactions: opts.normalizeReactions(it.reactions),
        mentions,
        replyToCreatedAt: toNumberOrUndefined(it.replyToCreatedAt),
        replyToMessageId: typeof it.replyToMessageId === 'string' ? it.replyToMessageId : undefined,
        replyToUserSub: typeof it.replyToUserSub === 'string' ? it.replyToUserSub : undefined,
        replyToPreview: typeof it.replyToPreview === 'string' ? it.replyToPreview : undefined,
        rawText,
        encrypted: encrypted ?? undefined,
        groupEncrypted: groupEncrypted ?? undefined,
        text: deletedAt ? '' : encrypted || groupEncrypted ? opts.encryptedPlaceholder : rawText,
        createdAt,
        expiresAt: toNumberOrUndefined(it.expiresAt),
        ttlSeconds: toNumberOrUndefined(it.ttlSeconds),
      };
    })
    .filter((m) => m.text.length > 0)
    .sort((a, b) => b.createdAt - a.createdAt);

  return normalized;
}

