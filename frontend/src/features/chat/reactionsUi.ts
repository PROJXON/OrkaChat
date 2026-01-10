export function formatReactionSubLabel(opts: {
  sub: string;
  myUserId?: string | null;
  nameBySub?: Record<string, string>;
}): string {
  const sub = String(opts.sub || '').trim();
  const me = opts.myUserId ? String(opts.myUserId).trim() : '';
  if (me && sub === me) return 'You';
  const name = opts.nameBySub && opts.nameBySub[sub] ? String(opts.nameBySub[sub]).trim() : '';
  if (name) return name;
  // Match existing fallback: first 6 … last 4
  return `${sub.slice(0, 6)}…${sub.slice(-4)}`;
}

export function sortReactionSubs(opts: {
  subs: string[];
  myUserId?: string | null;
  nameBySub?: Record<string, string>;
}): string[] {
  const subs = Array.isArray(opts.subs) ? opts.subs.slice().map((s) => String(s || '').trim()).filter(Boolean) : [];
  const me = opts.myUserId ? String(opts.myUserId).trim() : '';
  const labelFor = (sub: string) => formatReactionSubLabel({ sub, myUserId: me, nameBySub: opts.nameBySub });
  subs.sort((a, b) => {
    const aIsMe = !!me && a === me;
    const bIsMe = !!me && b === me;
    if (aIsMe && !bIsMe) return -1;
    if (!aIsMe && bIsMe) return 1;
    return labelFor(a).toLowerCase().localeCompare(labelFor(b).toLowerCase());
  });
  return subs;
}

