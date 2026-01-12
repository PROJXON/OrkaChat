import * as React from 'react';
import { searchChannels } from '../../utils/channelSearch';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message || 'Unknown error';
  if (typeof err === 'string') return err || 'Unknown error';
  if (!err) return 'Unknown error';
  try {
    const rec = err as Record<string, unknown>;
    const msg = rec?.message;
    return typeof msg === 'string' && msg ? msg : 'Unknown error';
  } catch {
    return 'Unknown error';
  }
}

export function useGuestChannelSearch(opts: {
  apiUrl: string | null | undefined;
  enabled: boolean;
  query: string;
  debounceMs?: number;
}) {
  const { apiUrl, enabled, query, debounceMs } = opts;
  const debouncedQuery = useDebouncedValue(query, typeof debounceMs === 'number' ? debounceMs : 150, enabled);

  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [globalUserCount, setGlobalUserCount] = React.useState<number | null>(null);
  const [results, setResults] = React.useState<
    Array<{ channelId: string; name: string; activeMemberCount?: number; hasPassword?: boolean }>
  >([]);

  React.useEffect(() => {
    if (!enabled) return;
    if (!apiUrl) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const q = String(debouncedQuery || '').trim();
        const r = await searchChannels({ apiUrl, query: q, limit: 50, preferPublic: true });
        if (typeof r.globalUserCount === 'number') {
          if (!cancelled) setGlobalUserCount(r.globalUserCount);
        } else if (!q) {
          if (!cancelled) setGlobalUserCount(null);
        }
        const normalized = r.channels.map((c) => ({
          channelId: c.channelId,
          name: c.name,
          activeMemberCount: c.activeMemberCount,
          hasPassword: c.hasPassword,
        }));
        if (!cancelled) setResults(normalized);
      } catch (e: unknown) {
        const msg = getErrorMessage(e) || 'Failed to load channels';
        // Common deployment gap: some backends don't expose a guest/public channel search endpoint.
        // Make the UX explicit instead of a generic "failed".
        const lower = msg.toLowerCase();
        if (lower.trim() === 'channel search failed') {
          if (!cancelled) setError('Channel browsing requires sign-in on this server.');
        } else if (lower.includes('/public/channels/search') && (lower.includes('404') || lower.includes('not found'))) {
          if (!cancelled) setError('Channel browsing requires sign-in on this server.');
        } else if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('not authenticated')) {
          if (!cancelled) setError('Channel browsing requires sign-in.');
        } else {
          if (!cancelled) setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [apiUrl, enabled, debouncedQuery]);

  return { loading, error, globalUserCount, results };
}

