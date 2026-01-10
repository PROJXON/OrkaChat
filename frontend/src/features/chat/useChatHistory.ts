import * as React from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import type { EncryptedChatPayloadV1 } from '../../types/crypto';
import type { ReactionMap } from '../../types/reactions';
import type { ChatMessage, EncryptedGroupPayloadV1 } from './types';
import { buildHistoryMessagesFromApiItems } from './buildHistoryMessages';
import { appendUniqueById, dedupeById } from '../../utils/listMerge';

export function useChatHistory(opts: {
  apiUrl: string | null | undefined;
  activeConversationId: string;
  hiddenMessageIds: Record<string, true>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  encryptedPlaceholder: string;
  parseEncrypted: (rawText: string) => EncryptedChatPayloadV1 | null;
  parseGroupEncrypted: (rawText: string) => EncryptedGroupPayloadV1 | null;
  normalizeUser: (v: unknown) => string;
  normalizeReactions: (v: unknown) => ReactionMap | undefined;
  pageSize?: number;
}): {
  historyCursor: number | null;
  historyHasMore: boolean;
  historyLoading: boolean;
  loadOlderHistory: () => void;
} {
  const PAGE_SIZE = typeof opts.pageSize === 'number' && Number.isFinite(opts.pageSize) ? opts.pageSize : 50;

  const [historyCursor, setHistoryCursor] = React.useState<number | null>(null);
  const [historyHasMore, setHistoryHasMore] = React.useState<boolean>(true);
  const [historyLoading, setHistoryLoading] = React.useState<boolean>(false);
  const historyLoadingRef = React.useRef<boolean>(false);

  const fetchHistoryPage = React.useCallback(
    async ({ before, reset }: { before?: number | null; reset?: boolean }) => {
      if (!opts.apiUrl) return;
      if (historyLoadingRef.current) return;
      historyLoadingRef.current = true;
      setHistoryLoading(true);
      try {
        // Some deployments protect GET /messages behind a Cognito authorizer.
        // Include the idToken when available; harmless if the route is public.
        const { tokens } = await fetchAuthSession().catch(() => ({ tokens: undefined }));
        const idToken = tokens?.idToken?.toString();
        const base = opts.apiUrl.replace(/\/$/, '');
        const qs =
          `conversationId=${encodeURIComponent(opts.activeConversationId)}` +
          `&limit=${PAGE_SIZE}` +
          `&cursor=1` +
          (typeof before === 'number' && Number.isFinite(before) && before > 0 ? `&before=${encodeURIComponent(String(before))}` : '');
        const url = `${base}/messages?${qs}`;

        const res = await fetch(url, idToken ? { headers: { Authorization: `Bearer ${idToken}` } } : undefined);
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          console.warn('fetchHistory failed', res.status, text);
          opts.setError(`History fetch failed (${res.status})`);
          return;
        }

        const json = await res.json();
        const rawItems = Array.isArray(json) ? json : Array.isArray(json?.items) ? json.items : [];
        const hasMoreFromServer = typeof json?.hasMore === 'boolean' ? json.hasMore : null;
        const nextCursorFromServer =
          typeof json?.nextCursor === 'number' && Number.isFinite(json.nextCursor) ? json.nextCursor : null;

        const normalized: ChatMessage[] = buildHistoryMessagesFromApiItems({
          rawItems,
          encryptedPlaceholder: opts.encryptedPlaceholder,
          parseEncrypted: opts.parseEncrypted,
          parseGroupEncrypted: opts.parseGroupEncrypted,
          normalizeUser: opts.normalizeUser,
          normalizeReactions: opts.normalizeReactions,
        });

        // Deduplicate by id (history may overlap with WS delivery)
        const deduped = dedupeById(normalized).filter((m: ChatMessage) => !opts.hiddenMessageIds[m.id]);

        if (reset) {
          opts.setMessages(deduped);
        } else {
          opts.setMessages((prev) => {
            return appendUniqueById(prev, deduped).merged;
          });
        }

        const nextCursor =
          typeof nextCursorFromServer === 'number' && Number.isFinite(nextCursorFromServer)
            ? nextCursorFromServer
            : normalized.length
              ? normalized[normalized.length - 1].createdAt
              : null;

        const hasMore =
          typeof hasMoreFromServer === 'boolean'
            ? hasMoreFromServer
            : Array.isArray(rawItems)
              ? rawItems.length >= PAGE_SIZE && typeof nextCursor === 'number' && Number.isFinite(nextCursor)
              : false;

        setHistoryHasMore(!!hasMore);
        setHistoryCursor(typeof nextCursor === 'number' && Number.isFinite(nextCursor) ? nextCursor : null);
      } catch {
        // ignore fetch errors; WS will still populate
      } finally {
        historyLoadingRef.current = false;
        setHistoryLoading(false);
      }
    },
    [
      opts.apiUrl,
      opts.activeConversationId,
      opts.encryptedPlaceholder,
      opts.hiddenMessageIds,
      opts.normalizeReactions,
      opts.normalizeUser,
      opts.parseEncrypted,
      opts.parseGroupEncrypted,
      opts.setError,
      opts.setMessages,
      PAGE_SIZE,
    ],
  );

  // Fetch recent history from HTTP API (if configured)
  React.useEffect(() => {
    if (!opts.apiUrl) return;
    // Reset + fetch first page for the active conversation.
    opts.setMessages([]);
    setHistoryCursor(null);
    setHistoryHasMore(true);
    fetchHistoryPage({ reset: true });
  }, [opts.apiUrl, opts.activeConversationId, opts.hiddenMessageIds, fetchHistoryPage, opts.setMessages]);

  const loadOlderHistory = React.useCallback(() => {
    if (!opts.apiUrl) return;
    if (!historyHasMore) return;
    fetchHistoryPage({ before: historyCursor, reset: false });
  }, [opts.apiUrl, fetchHistoryPage, historyCursor, historyHasMore]);

  return { historyCursor, historyHasMore, historyLoading, loadOlderHistory };
}

