import * as React from 'react';

export type PublicAvatarProfileLite = {
  displayName?: string;
  avatarBgColor?: string;
  avatarTextColor?: string;
  avatarImagePath?: string;
  fetchedAt?: number;
};

type CdnLike = {
  get: (path: string) => string;
  ensure: (paths: Array<string | null | undefined>) => void;
};

export function usePublicAvatarProfiles(opts: {
  apiUrl: string | undefined | null;
  subs: Array<string | null | undefined>;
  ttlMs?: number; // If omitted/Infinity: only fetch missing.
  maxBatch?: number;
  resetKey?: string | number | null | undefined;
  cdn?: CdnLike;
}): {
  avatarProfileBySub: Record<string, PublicAvatarProfileLite>;
  invalidate: (sub: string) => void;
  upsertMany: (items: Array<{ sub: string; profile: Partial<PublicAvatarProfileLite> }>) => void;
  reset: () => void;
} {
  const apiUrl = String(opts.apiUrl || '').trim();
  const ttlMsRaw = opts.ttlMs;
  const ttlMs = typeof ttlMsRaw === 'number' && Number.isFinite(ttlMsRaw) ? ttlMsRaw : Number.POSITIVE_INFINITY;
  const maxBatch = typeof opts.maxBatch === 'number' && Number.isFinite(opts.maxBatch) ? Math.max(1, Math.floor(opts.maxBatch)) : 25;
  const resetKey = opts.resetKey;
  const cdn = opts.cdn;
  const cdnRef = React.useRef<CdnLike | undefined>(cdn);
  React.useEffect(() => {
    cdnRef.current = cdn;
  }, [cdn]);

  const [avatarProfileBySub, setAvatarProfileBySub] = React.useState<Record<string, PublicAvatarProfileLite>>({});
  const inFlightRef = React.useRef<Set<string>>(new Set());

  const reset = React.useCallback(() => {
    setAvatarProfileBySub({});
    inFlightRef.current = new Set();
  }, []);

  React.useEffect(() => {
    reset();
  }, [resetKey, reset]);

  const invalidate = React.useCallback((sub: string) => {
    const key = String(sub || '').trim();
    if (!key) return;
    inFlightRef.current.delete(key);
    setAvatarProfileBySub((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const upsertMany = React.useCallback((items: Array<{ sub: string; profile: Partial<PublicAvatarProfileLite> }>) => {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return;
    const now = Date.now();
    setAvatarProfileBySub((prev) => {
      let changed = false;
      const next: Record<string, PublicAvatarProfileLite> = { ...prev };
      for (const it of list) {
        const sub = typeof it?.sub === 'string' ? it.sub.trim() : String(it?.sub || '').trim();
        if (!sub) continue;
        inFlightRef.current.delete(sub);
        const patch = it?.profile && typeof it.profile === 'object' ? it.profile : {};
        next[sub] = { ...(prev[sub] || {}), ...patch, fetchedAt: now };
        changed = true;
      }
      return changed ? next : prev;
    });
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!apiUrl) return;
      const base = apiUrl.replace(/\/$/, '');

      const now = Date.now();
      const wanted: string[] = [];
      for (const s of opts.subs) {
        const sub = typeof s === 'string' ? s.trim() : String(s || '').trim();
        if (!sub) continue;
        wanted.push(sub);
      }
      if (!wanted.length) return;

      const uniqueWanted = Array.from(new Set(wanted));
      const missingOrStale: string[] = [];
      for (const sub of uniqueWanted) {
        if (inFlightRef.current.has(sub)) continue;
        const existing = avatarProfileBySub[sub];
        const fetchedAt = existing && typeof existing.fetchedAt === 'number' ? existing.fetchedAt : NaN;
        const stale =
          !existing ||
          (Number.isFinite(ttlMs) &&
            ttlMs !== Number.POSITIVE_INFINITY &&
            (!Number.isFinite(fetchedAt) || now - fetchedAt > ttlMs));
        if (!stale) continue;
        missingOrStale.push(sub);
      }

      if (!missingOrStale.length) return;
      const batch = missingOrStale.slice(0, maxBatch);
      batch.forEach((s) => inFlightRef.current.add(s));

      try {
        if (cancelled) return;
        const resp = await fetch(`${base}/public/users/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subs: batch }),
        });
        if (!resp.ok) return;
        const json = await resp.json();
        const users = Array.isArray(json?.users) ? json.users : [];
        if (!users.length) return;

        setAvatarProfileBySub((prev) => {
          const next = { ...prev };
          for (const u of users) {
            const sub = typeof u?.sub === 'string' ? String(u.sub).trim() : '';
            if (!sub) continue;
            next[sub] = {
              displayName: typeof u.displayName === 'string' ? String(u.displayName) : undefined,
              avatarBgColor: typeof u.avatarBgColor === 'string' ? String(u.avatarBgColor) : undefined,
              avatarTextColor: typeof u.avatarTextColor === 'string' ? String(u.avatarTextColor) : undefined,
              avatarImagePath: typeof u.avatarImagePath === 'string' ? String(u.avatarImagePath) : undefined,
              fetchedAt: now,
            };
          }
          return next;
        });
      } finally {
        batch.forEach((s) => inFlightRef.current.delete(s));
      }
    })();
    return () => {
      cancelled = true;
    };
     
  }, [apiUrl, ttlMs, maxBatch, avatarProfileBySub, opts.subs]);

  // Best-effort: prefetch avatar image URLs once profiles land.
  React.useEffect(() => {
    const cdnNow = cdnRef.current;
    if (!cdnNow) return;
    const needed: string[] = [];
    for (const prof of Object.values(avatarProfileBySub)) {
      const p = prof?.avatarImagePath;
      if (!p) continue;
      if (cdnNow.get(p)) continue;
      needed.push(p);
    }
    if (!needed.length) return;
    cdnNow.ensure(Array.from(new Set(needed)));
  }, [avatarProfileBySub]);

  return React.useMemo(
    () => ({ avatarProfileBySub, invalidate, upsertMany, reset }),
    [avatarProfileBySub, invalidate, upsertMany, reset],
  );
}

