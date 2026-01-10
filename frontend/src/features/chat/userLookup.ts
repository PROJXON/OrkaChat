export type DisplayNameBySub = Record<string, string>;

export async function fetchDisplayNamesBySub(opts: {
  apiUrl: string;
  idToken: string;
  subs: string[];
  limit?: number;
}): Promise<DisplayNameBySub> {
  const apiUrl = String(opts.apiUrl || '').replace(/\/$/, '');
  const idToken = String(opts.idToken || '').trim();
  const subsRaw = Array.isArray(opts.subs) ? opts.subs : [];
  const limit = Math.max(0, Math.min(100, Math.floor(opts.limit ?? 25)));

  if (!apiUrl || !idToken || !subsRaw.length || limit <= 0) return {};

  const subs = subsRaw.map((s) => String(s || '').trim()).filter(Boolean).slice(0, limit);
  if (!subs.length) return {};

  const out: Record<string, string> = {};
  await Promise.all(
    subs.map(async (sub) => {
      try {
        const res = await fetch(`${apiUrl}/users?sub=${encodeURIComponent(sub)}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        const display =
          data && (data.displayName || data.preferred_username || data.username)
            ? String(data.displayName || data.preferred_username || data.username).trim()
            : '';
        if (display) out[sub] = display;
      } catch {
        // ignore
      }
    }),
  );

  return out;
}

