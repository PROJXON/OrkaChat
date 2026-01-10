import * as React from 'react';
import { searchChannels } from '../../utils/channelSearch';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

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
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message || 'Failed to load channels'));
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

