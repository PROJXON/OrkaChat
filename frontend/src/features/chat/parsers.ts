import type { MediaItem, MediaKind } from '../../types/media';
import type { ReactionMap } from '../../types/reactions';
import type {
  ChatEnvelope,
  DmMediaEnvelope,
  DmMediaEnvelopeV1,
  DmMediaEnvelopeV2,
  EncryptedTextEnvelopeV1,
  GroupMediaEnvelope,
  GroupMediaEnvelopeV1,
  GroupMediaEnvelopeV2,
} from './types';

export const parseChatEnvelope = (raw: string): ChatEnvelope | null => {
  if (!raw) return null;
  try {
    const obj: unknown = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return null;
    const rec = obj as Record<string, unknown>;
    if (rec.type !== 'chat') return null;
    return rec as ChatEnvelope;
  } catch {
    return null;
  }
};

export const parseEncryptedTextEnvelope = (raw: string): EncryptedTextEnvelopeV1 | null => {
  if (!raw) return null;
  try {
    const obj: unknown = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return null;
    const rec = obj as Record<string, unknown>;
    if (rec.type !== 'enc_text_v1' || rec.v !== 1) return null;
    if (typeof rec.text !== 'string') return null;
    return rec as EncryptedTextEnvelopeV1;
  } catch {
    return null;
  }
};

export const normalizeReactions = (raw: unknown): ReactionMap | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const out: ReactionMap = {};
  for (const [emoji, info] of Object.entries(obj)) {
    if (!emoji) continue;
    const rec = info && typeof info === 'object' ? (info as Record<string, unknown>) : null;
    const count = Number(rec?.count);
    const subsRaw: unknown[] = Array.isArray(rec?.userSubs) ? rec.userSubs : [];
    const subs = subsRaw.map(String).filter(Boolean);
    const safeCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : subs.length;
    if (safeCount <= 0 && subs.length === 0) continue;
    out[String(emoji)] = { count: safeCount, userSubs: subs };
  }
  return Object.keys(out).length ? out : undefined;
};

export const normalizeChatMediaList = (raw: ChatEnvelope['media']): MediaItem[] => {
  if (!raw) return [];
  const arr: unknown[] = Array.isArray(raw) ? raw : [raw];
  const out: MediaItem[] = [];
  for (const m of arr) {
    if (!m || typeof m !== 'object') continue;
    const rec = m as Record<string, unknown>;
    if (typeof rec.path !== 'string') continue;
    const k = rec.kind;
    const kind: MediaKind = k === 'video' ? 'video' : k === 'image' ? 'image' : 'file';
    out.push({
      path: String(rec.path),
      thumbPath: typeof rec.thumbPath === 'string' ? String(rec.thumbPath) : undefined,
      kind,
      contentType: typeof rec.contentType === 'string' ? String(rec.contentType) : undefined,
      thumbContentType:
        typeof rec.thumbContentType === 'string' ? String(rec.thumbContentType) : undefined,
      fileName: typeof rec.fileName === 'string' ? String(rec.fileName) : undefined,
      size:
        typeof rec.size === 'number' && Number.isFinite(rec.size)
          ? (rec.size as number)
          : undefined,
      durationMs:
        typeof rec.durationMs === 'number' && Number.isFinite(rec.durationMs)
          ? Math.max(0, Math.floor(rec.durationMs as number))
          : undefined,
    });
  }
  return out;
};

export const parseDmMediaEnvelope = (raw: string): DmMediaEnvelope | null => {
  if (!raw) return null;
  try {
    const obj: unknown = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return null;
    const rec = obj as Record<string, unknown>;
    if (rec.type === 'dm_media_v1' && rec.v === 1) {
      const media = rec.media;
      const wrap = rec.wrap;
      if (!media || typeof media !== 'object') return null;
      if (!wrap || typeof wrap !== 'object') return null;
      const m = media as Record<string, unknown>;
      const w = wrap as Record<string, unknown>;
      if (typeof m.path !== 'string' || typeof m.iv !== 'string') return null;
      if (typeof w.iv !== 'string' || typeof w.ciphertext !== 'string') return null;
      return rec as DmMediaEnvelopeV1;
    }
    if (rec.type === 'dm_media_v2' && rec.v === 2) {
      const items = rec.items;
      if (!Array.isArray(items) || items.length === 0) return null;
      const itemsArr: unknown[] = items;
      for (const it of itemsArr) {
        if (!it || typeof it !== 'object') return null;
        const itRec = it as Record<string, unknown>;
        const media = itRec.media;
        const wrap = itRec.wrap;
        if (!media || typeof media !== 'object') return null;
        if (!wrap || typeof wrap !== 'object') return null;
        const m = media as Record<string, unknown>;
        const w = wrap as Record<string, unknown>;
        if (typeof m.path !== 'string' || typeof m.iv !== 'string') return null;
        if (typeof w.iv !== 'string' || typeof w.ciphertext !== 'string') return null;
      }
      return rec as DmMediaEnvelopeV2;
    }
    return null;
  } catch {
    return null;
  }
};

export const normalizeDmMediaItems = (
  env: DmMediaEnvelope | null,
): Array<{ media: DmMediaEnvelopeV1['media']; wrap: DmMediaEnvelopeV1['wrap'] }> => {
  if (!env) return [];
  if (env.type === 'dm_media_v1') return [{ media: env.media, wrap: env.wrap }];
  return Array.isArray(env.items) ? env.items : [];
};

export const parseGroupMediaEnvelope = (raw: string): GroupMediaEnvelope | null => {
  if (!raw) return null;
  try {
    const obj: unknown = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return null;
    const rec = obj as Record<string, unknown>;
    if (rec.type === 'gdm_media_v1' && rec.v === 1) {
      const media = rec.media;
      const wrap = rec.wrap;
      if (!media || typeof media !== 'object') return null;
      if (!wrap || typeof wrap !== 'object') return null;
      const m = media as Record<string, unknown>;
      const w = wrap as Record<string, unknown>;
      if (typeof m.path !== 'string' || typeof m.iv !== 'string') return null;
      if (typeof w.iv !== 'string' || typeof w.ciphertext !== 'string') return null;
      return rec as GroupMediaEnvelopeV1;
    }
    if (rec.type === 'gdm_media_v2' && rec.v === 2) {
      const items = rec.items;
      if (!Array.isArray(items) || items.length === 0) return null;
      const itemsArr: unknown[] = items;
      for (const it of itemsArr) {
        if (!it || typeof it !== 'object') return null;
        const itRec = it as Record<string, unknown>;
        const media = itRec.media;
        const wrap = itRec.wrap;
        if (!media || typeof media !== 'object') return null;
        if (!wrap || typeof wrap !== 'object') return null;
        const m = media as Record<string, unknown>;
        const w = wrap as Record<string, unknown>;
        if (typeof m.path !== 'string' || typeof m.iv !== 'string') return null;
        if (typeof w.iv !== 'string' || typeof w.ciphertext !== 'string') return null;
      }
      return rec as GroupMediaEnvelopeV2;
    }
    return null;
  } catch {
    return null;
  }
};

export const normalizeGroupMediaItems = (
  env: GroupMediaEnvelope | null,
): Array<{ media: DmMediaEnvelopeV1['media']; wrap: DmMediaEnvelopeV1['wrap'] }> => {
  if (!env) return [];
  if (env.type === 'gdm_media_v1') return [{ media: env.media, wrap: env.wrap }];
  return Array.isArray(env.items) ? env.items : [];
};
