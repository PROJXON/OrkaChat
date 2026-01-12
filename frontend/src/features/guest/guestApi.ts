import { API_URL } from '../../config/env';
import type { GuestHistoryPage } from './types';
import { normalizeGuestMessages } from './parsers';

const GUEST_HISTORY_PAGE_SIZE = 50;

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
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
      const rec = isRecord(json) ? json : {};
      const rawItems: unknown[] = Array.isArray(json) ? (json as unknown[]) : Array.isArray(rec.items) ? rec.items : [];
      const items = normalizeGuestMessages(rawItems);

      const channelMetaRaw = !Array.isArray(json) && isRecord(json) ? json.channel : null;
      const channelMeta =
        channelMetaRaw && typeof channelMetaRaw === 'object' && channelMetaRaw != null
          ? {
              channelId:
                typeof (channelMetaRaw as Record<string, unknown>).channelId === 'string'
                  ? String((channelMetaRaw as Record<string, unknown>).channelId)
                  : '',
              conversationId:
                typeof (channelMetaRaw as Record<string, unknown>).conversationId === 'string'
                  ? String((channelMetaRaw as Record<string, unknown>).conversationId)
                  : conversationId,
              name:
                typeof (channelMetaRaw as Record<string, unknown>).name === 'string'
                  ? String((channelMetaRaw as Record<string, unknown>).name)
                  : undefined,
              aboutText:
                typeof (channelMetaRaw as Record<string, unknown>).aboutText === 'string'
                  ? String((channelMetaRaw as Record<string, unknown>).aboutText)
                  : undefined,
              aboutVersion:
                typeof (channelMetaRaw as Record<string, unknown>).aboutVersion === 'number' &&
                Number.isFinite((channelMetaRaw as Record<string, unknown>).aboutVersion)
                  ? ((channelMetaRaw as Record<string, unknown>).aboutVersion as number)
                  : undefined,
            }
          : undefined;

      const hasMoreFromServer = typeof rec.hasMore === 'boolean' ? rec.hasMore : null;
      const nextCursorFromServer = typeof rec.nextCursor === 'number' && Number.isFinite(rec.nextCursor) ? rec.nextCursor : null;

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
        channelMeta: channelMeta && channelMeta.channelId ? channelMeta : undefined,
      };
    } catch (err) {
      errors.push(`GET ${url} threw: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(errors.length ? errors.join('\n') : 'Guest history fetch failed');
}
