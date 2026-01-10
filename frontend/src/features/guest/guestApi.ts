import { API_URL } from '../../config/env';
import type { GuestHistoryPage } from './types';
import { normalizeGuestMessages } from './parsers';

const GUEST_HISTORY_PAGE_SIZE = 50;

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
      const json = await res.json();
      const rawItems = Array.isArray(json) ? json : Array.isArray((json as any)?.items) ? (json as any).items : [];
      const items = normalizeGuestMessages(rawItems);

      const channelMetaRaw = !Array.isArray(json) && json && typeof json === 'object' ? (json as any)?.channel : null;
      const channelMeta =
        channelMetaRaw && typeof channelMetaRaw === 'object'
          ? {
              channelId: typeof channelMetaRaw.channelId === 'string' ? String(channelMetaRaw.channelId) : '',
              conversationId:
                typeof channelMetaRaw.conversationId === 'string'
                  ? String(channelMetaRaw.conversationId)
                  : conversationId,
              name: typeof channelMetaRaw.name === 'string' ? String(channelMetaRaw.name) : undefined,
              aboutText: typeof channelMetaRaw.aboutText === 'string' ? String(channelMetaRaw.aboutText) : undefined,
              aboutVersion:
                typeof channelMetaRaw.aboutVersion === 'number' && Number.isFinite(channelMetaRaw.aboutVersion)
                  ? channelMetaRaw.aboutVersion
                  : undefined,
            }
          : undefined;

      const hasMoreFromServer = typeof (json as any)?.hasMore === 'boolean' ? (json as any).hasMore : null;
      const nextCursorFromServer =
        typeof (json as any)?.nextCursor === 'number' && Number.isFinite((json as any).nextCursor)
          ? (json as any).nextCursor
          : null;

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
