import type { MediaItem, MediaKind } from '../../types/media';
import type { ReactionMap, ReactionUsersMap } from '../../types/reactions';
import { formatMessageMetaTimestamp } from '../../utils/chatDates';
import type { GuestChatEnvelope, GuestMessage } from './types';

export function formatGuestTimestamp(ms: number): string {
  const t = Number(ms);
  if (!Number.isFinite(t) || t <= 0) return '';
  return formatMessageMetaTimestamp(t);
}

export function normalizeGuestReactions(raw: unknown): ReactionMap | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const out: ReactionMap = {};
  for (const [emoji, info] of Object.entries(obj)) {
    const rec = info && typeof info === 'object' ? (info as Record<string, unknown>) : null;
    const count = Number(rec?.count);
    const subsRaw: unknown[] = Array.isArray(rec?.userSubs) ? rec.userSubs : [];
    const subs = subsRaw.map(String).filter(Boolean);
    const safeCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : subs.length;
    if (safeCount <= 0 && subs.length === 0) continue;
    out[String(emoji)] = { count: safeCount, userSubs: subs };
  }
  return Object.keys(out).length ? out : undefined;
}

export function normalizeGuestMediaList(raw: GuestChatEnvelope['media']): MediaItem[] {
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
}

export function tryParseChatEnvelope(
  rawText: string,
): { text: string; mediaList: MediaItem[] } | null {
  const t = (rawText || '').trim();
  if (!t || !t.startsWith('{') || !t.endsWith('}')) return null;
  try {
    const obj: unknown = JSON.parse(t);
    if (!obj || typeof obj !== 'object') return null;
    const rec = obj as Record<string, unknown>;
    if (rec.type !== 'chat') return null;
    const env = rec as GuestChatEnvelope;
    const text = typeof env.text === 'string' ? env.text : '';
    const mediaList = normalizeGuestMediaList(env.media);
    if (!text && mediaList.length === 0) return null;
    return { text, mediaList };
  } catch {
    return null;
  }
}

export function normalizeGuestMessages(items: unknown[]): GuestMessage[] {
  const out: GuestMessage[] = [];
  for (const it of items) {
    const rec = it && typeof it === 'object' ? (it as Record<string, unknown>) : null;
    const createdAt = Number(rec?.createdAt ?? Date.now());
    const messageId =
      typeof rec?.messageId === 'string' || typeof rec?.messageId === 'number'
        ? String(rec.messageId)
        : String(createdAt);
    const user = typeof rec?.user === 'string' ? (rec.user as string) : 'anon';
    const userSub = typeof rec?.userSub === 'string' ? String(rec.userSub) : undefined;
    const deletedAt = typeof rec?.deletedAt === 'number' ? (rec.deletedAt as number) : undefined;
    if (deletedAt) continue;
    const rawText = typeof rec?.text === 'string' ? (rec.text as string) : '';
    const parsed = tryParseChatEnvelope(rawText);
    const text = parsed ? parsed.text : rawText;
    const mediaList = parsed?.mediaList ?? [];
    const media = mediaList.length ? mediaList[0] : undefined;
    if (!text.trim() && mediaList.length === 0) continue;

    const reactionUsers: ReactionUsersMap | undefined =
      rec?.reactionUsers && typeof rec.reactionUsers === 'object'
        ? Object.fromEntries(
            Object.entries(rec.reactionUsers as Record<string, unknown>).map(([k, v]) => [
              String(k),
              String(v),
            ]),
          )
        : undefined;

    out.push({
      id: messageId,
      user,
      userSub,
      avatarBgColor: typeof rec?.avatarBgColor === 'string' ? String(rec.avatarBgColor) : undefined,
      avatarTextColor:
        typeof rec?.avatarTextColor === 'string' ? String(rec.avatarTextColor) : undefined,
      avatarImagePath:
        typeof rec?.avatarImagePath === 'string' ? String(rec.avatarImagePath) : undefined,
      text,
      createdAt,
      editedAt: typeof rec?.editedAt === 'number' ? (rec.editedAt as number) : undefined,
      reactions: normalizeGuestReactions(rec?.reactions),
      reactionUsers,
      media,
      mediaList: mediaList.length ? mediaList : undefined,
    });
  }

  // Ensure newest-first for inverted list behavior.
  out.sort((a, b) => b.createdAt - a.createdAt);

  // Deduplicate by id (in case of overlapping history windows)
  const seen = new Set<string>();
  return out.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
}
