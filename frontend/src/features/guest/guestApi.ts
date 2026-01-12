import { API_URL } from '../../config/env';
import type { GuestHistoryPage } from './types';
import type { GuestChannelMeta } from './types';
import { normalizeGuestMessages } from './parsers';

const GUEST_HISTORY_PAGE_SIZE = 50;

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

type GuestHistoryResponseObj = {
  items?: unknown;
  hasMore?: unknown;
  nextCursor?: unknown;
  channel?: unknown;
};

function getStringField(rec: Record<string, unknown>, key: string): string | null {
  const v = rec[key];
  return typeof v === 'string' ? v : v == null ? null : String(v);
}

function getOptionalFiniteNumberField(rec: Record<string, unknown>, key: string): number | undefined {
  const v = rec[key];
  if (typeof v !== 'number') return undefined;
  return Number.isFinite(v) ? v : undefined;
}

function parseGuestChannelMeta(raw: unknown, fallbackConversationId: string): GuestChannelMeta | undefined {
  if (!isRecord(raw)) return undefined;
  const channelId = String(getStringField(raw, 'channelId') || '').trim();
  if (!channelId) return undefined;

  const conversationId = String(getStringField(raw, 'conversationId') || fallbackConversationId || '').trim() || 'global';
  const name = getStringField(raw, 'name');
  const aboutText = getStringField(raw, 'aboutText');
  const aboutVersion = getOptionalFiniteNumberField(raw, 'aboutVersion');

  return {
    channelId,
    conversationId,
    name: name ? String(name) : undefined,
    aboutText: aboutText ? String(aboutText) : undefined,
    aboutVersion,
  };
}

function parseGuestHistoryResponse(
  json: unknown,
  conversationId: string,
): {
  rawItems: unknown[];
  channelMeta?: GuestChannelMeta;
  hasMoreFromServer: boolean | null;
  nextCursorFromServer: number | null;
} {
  // Backward compat: some deployments return the raw array of messages.
  if (Array.isArray(json)) {
    return {
      rawItems: json,
      channelMeta: undefined,
      hasMoreFromServer: null,
      nextCursorFromServer: null,
    };
  }

  const rec: GuestHistoryResponseObj = isRecord(json) ? (json as GuestHistoryResponseObj) : {};
  const rawItems: unknown[] = Array.isArray(rec.items) ? rec.items : [];

  const channelMeta = parseGuestChannelMeta(rec.channel, conversationId);
  const hasMoreFromServer = typeof rec.hasMore === 'boolean' ? rec.hasMore : null;
  const nextCursorFromServer = typeof rec.nextCursor === 'number' && Number.isFinite(rec.nextCursor) ? rec.nextCursor : null;

  return { rawItems, channelMeta, hasMoreFromServer, nextCursorFromServer };
}

export async function fetchGuestChannelHistoryPage(opts: {
  conversationId: string;
  before?: number | null;
}): Promise<GuestHistoryPage> {
  if (!API_URL) throw new Error('API_URL is not configured');
  const base = API_URL.replace(/\/$/, '');
  const conversationId = String(opts?.conversationId || 'global').trim() || 'global';
  const before = opts?.before;
  const qs =
    `conversationId=${encodeURIComponent(conversationId)}` +
    `&limit=${GUEST_HISTORY_PAGE_SIZE}` +
    `&cursor=1` +
    (typeof before === 'number' && Number.isFinite(before) && before > 0
      ? `&before=${encodeURIComponent(String(before))}`
      : '');

  const candidates =
    conversationId === 'global'
      ? [`${base}/public/messages?${qs}`, `${base}/messages?${qs}`]
      : [
          // New Channels public history endpoint (preferred).
          `${base}/public/channel/messages?${qs}`,
          // Fallbacks (may be forbidden for non-global; kept for flexibility across deployments).
          `${base}/public/messages?${qs}`,
          `${base}/messages?${qs}`,
        ];

  const errors: string[] = [];
  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        errors.push(`GET ${url} failed (${res.status}) ${text || ''}`.trim());
        continue;
      }
      const json: unknown = await res.json();
      const { rawItems, channelMeta, hasMoreFromServer, nextCursorFromServer } = parseGuestHistoryResponse(json, conversationId);
      const items = normalizeGuestMessages(rawItems);

      const nextCursor =
        typeof nextCursorFromServer === 'number' && Number.isFinite(nextCursorFromServer)
          ? nextCursorFromServer
          : items.length
            ? items[items.length - 1].createdAt
            : null;

      const hasMore =
        typeof hasMoreFromServer === 'boolean'
          ? hasMoreFromServer
          : rawItems.length >= GUEST_HISTORY_PAGE_SIZE && typeof nextCursor === 'number' && Number.isFinite(nextCursor);

      return {
        items,
        hasMore: !!hasMore,
        nextCursor: typeof nextCursor === 'number' && Number.isFinite(nextCursor) ? nextCursor : null,
        channelMeta,
      };
    } catch (err) {
      errors.push(`GET ${url} threw: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(errors.length ? errors.join('\n') : 'Guest history fetch failed');
}
