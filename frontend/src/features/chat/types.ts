import type { EncryptedChatPayloadV1 } from '../../types/crypto';
import type { MediaItem, MediaKind } from '../../types/media';
import type { ReactionMap } from '../../types/reactions';

export type ChatEnvelope = {
  type: 'chat';
  text?: string;
  // Backward-compat: `media` may be a single object (v1) or an array (v2+).
  media?: MediaItem | MediaItem[];
};

export type EncryptedGroupPayloadV1 = {
  type: 'gdm_v1';
  v: 1;
  alg: 'aes-256-gcm+wraps-v1';
  iv: string; // hex (12 bytes)
  ciphertext: string; // hex (ciphertext + authTag)
  // Wraps map: recipientSub -> EncryptedChatPayloadV1 encrypting messageKeyHex
  wraps: Record<string, EncryptedChatPayloadV1>;
};

export type ChatMessage = {
  id: string;
  user?: string;
  // Stable identity key for comparisons (lowercased username). Prefer this over `user` for logic.
  userLower?: string;
  // Stable identity key for comparisons (Cognito sub). Prefer this over display strings for logic.
  userSub?: string;
  // System messages are server-authored "events" (e.g. kicked/banned/left).
  kind?: 'system';
  systemKind?: string;
  actorSub?: string;
  actorUser?: string;
  targetSub?: string;
  targetUser?: string;
  avatarBgColor?: string;
  avatarTextColor?: string;
  avatarImagePath?: string;
  text: string;
  rawText?: string;
  encrypted?: EncryptedChatPayloadV1;
  groupEncrypted?: EncryptedGroupPayloadV1;
  decryptedText?: string;
  // Group-only: derived from wraps[mySub] after decrypt; used to decrypt group media.
  groupKeyHex?: string;
  decryptFailed?: boolean;
  expiresAt?: number; // epoch seconds
  ttlSeconds?: number; // duration, seconds (TTL-from-read)
  editedAt?: number; // epoch ms
  deletedAt?: number; // epoch ms
  deletedBySub?: string;
  // Channels (plaintext) metadata
  mentions?: string[];
  replyToCreatedAt?: number;
  replyToMessageId?: string;
  replyToUserSub?: string;
  replyToPreview?: string;
  reactions?: ReactionMap;
  // Backward-compat: historically we supported only a single attachment per message.
  // New messages can include multiple attachments; use `mediaList` when present.
  media?: MediaItem;
  mediaList?: MediaItem[];
  createdAt: number;
  // Local-only UI state for optimistic sends.
  localStatus?: 'sending' | 'sent' | 'failed';
};

export type DmMediaEnvelopeV1 = {
  type: 'dm_media_v1';
  v: 1;
  caption?: string;
  media: {
    kind: MediaKind;
    contentType?: string;
    fileName?: string;
    size?: number;
    durationMs?: number;
    path: string; // encrypted blob
    iv: string; // hex
    thumbPath?: string; // encrypted thumb blob
    thumbIv?: string; // hex
    thumbContentType?: string; // e.g. image/jpeg
  };
  wrap: {
    iv: string; // hex
    ciphertext: string; // hex (wrapped fileKey)
  };
};

export type DmMediaEnvelopeV2 = {
  type: 'dm_media_v2';
  v: 2;
  caption?: string;
  // Each item wraps its own per-attachment file key (Signal-style).
  items: Array<{
    media: DmMediaEnvelopeV1['media'];
    wrap: DmMediaEnvelopeV1['wrap'];
  }>;
};

export type DmMediaEnvelope = DmMediaEnvelopeV1 | DmMediaEnvelopeV2;

// Group DM media envelope:
// - The outer group message is encrypted with messageKey.
// - Each attachment fileKey is wrapped with messageKey (AES-GCM), not ECDH.
export type GroupMediaEnvelopeV1 = {
  type: 'gdm_media_v1';
  v: 1;
  caption?: string;
  media: DmMediaEnvelopeV1['media'];
  wrap: DmMediaEnvelopeV1['wrap']; // aesGcmEncryptBytes(messageKey, fileKey)
};

export type GroupMediaEnvelopeV2 = {
  type: 'gdm_media_v2';
  v: 2;
  caption?: string;
  items: Array<{ media: DmMediaEnvelopeV1['media']; wrap: DmMediaEnvelopeV1['wrap'] }>;
};

export type GroupMediaEnvelope = GroupMediaEnvelopeV1 | GroupMediaEnvelopeV2;
