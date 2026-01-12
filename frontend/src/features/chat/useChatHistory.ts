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
  const apiUrl = opts.apiUrl;
  const activeConversationId = opts.activeConversationId;
  const hiddenMessageIds = opts.hiddenMessageIds;
  const setMessages = opts.setMessages;
  const setError = opts.setError;
  const encryptedPlaceholder = opts.encryptedPlaceholder;
  const parseEncrypted = opts.parseEncrypted;
  const parseGroupEncrypted = opts.parseGroupEncrypted;
  const normalizeUser = opts.normalizeUser;
  const normalizeReactions = opts.normalizeReactions;

  const [historyCursor, setHistoryCursor] = React.useState<number | null>(null);
  const [historyHasMore, setHistoryHasMore] = React.useState<boolean>(true);
  const [historyLoading, setHistoryLoading] = React.useState<boolean>(false);
  const historyLoadingRef = React.useRef<boolean>(false);

  const fetchHistoryPage = React.useCallback(
    async ({ before, reset }: { before?: number | null; reset?: boolean }) => {
      if (!apiUrl) return;
      if (historyLoadingRef.current) return;
      historyLoadingRef.current = true;
      setHistoryLoading(true);
      try {
        // Some deployments protect GET /messages behind a Cognito authorizer.
        // Include the idToken when available; harmless if the route is public.
        const { tokens } = await fetchAuthSession().catch(() => ({ tokens: undefined }));
        const idToken = tokens?.idToken?.toString();
        const base = apiUrl.replace(/\/$/, '');
        const qs =
          `conversationId=${encodeURIComponent(activeConversationId)}` +
          `&limit=${PAGE_SIZE}` +
          `&cursor=1` +
          (typeof before === 'number' && Number.isFinite(before) && before > 0 ? `&before=${encodeURIComponent(String(before))}` : '');
        const url = `${base}/messages?${qs}`;

        const res = await fetch(url, idToken ? { headers: { Authorization: `Bearer ${idToken}` } } : undefined);
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          console.warn('fetchHistory failed', res.status, text);
          setError(`History fetch failed (${res.status})`);
          return;
        }

        const json = await res.json();
        const rawItems = Array.isArray(json) ? json : Array.isArray(json?.items) ? json.items : [];
        const hasMoreFromServer = typeof json?.hasMore === 'boolean' ? json.hasMore : null;
        const nextCursorFromServer =
          typeof json?.nextCursor === 'number' && Number.isFinite(json.nextCursor) ? json.nextCursor : null;

        const normalized: ChatMessage[] = buildHistoryMessagesFromApiItems({
          rawItems,
          encryptedPlaceholder,
          parseEncrypted,
          parseGroupEncrypted,
          normalizeUser,
          normalizeReactions,
        });

        // Deduplicate by id (history may overlap with WS delivery)
        const deduped = dedupeById(normalized).filter((m: ChatMessage) => !hiddenMessageIds[m.id]);

        if (reset) {
          setMessages(deduped);
        } else {
          setMessages((prev) => {
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
      apiUrl,
      activeConversationId,
      encryptedPlaceholder,
      hiddenMessageIds,
      normalizeReactions,
      normalizeUser,
      parseEncrypted,
      parseGroupEncrypted,
      setError,
      setMessages,
      PAGE_SIZE,
    ],
  );

  // Fetch recent history from HTTP API (if configured)
  React.useEffect(() => {
    if (!apiUrl) return;
    // Reset + fetch first page for the active conversation.
    setMessages([]);
    setHistoryCursor(null);
    setHistoryHasMore(true);
    fetchHistoryPage({ reset: true });
  }, [apiUrl, activeConversationId, hiddenMessageIds, fetchHistoryPage, setMessages]);

  const loadOlderHistory = React.useCallback(() => {
    if (!apiUrl) return;
    if (!historyHasMore) return;
    fetchHistoryPage({ before: historyCursor, reset: false });
  }, [apiUrl, fetchHistoryPage, historyCursor, historyHasMore]);

  return { historyCursor, historyHasMore, historyLoading, loadOlderHistory };
}

