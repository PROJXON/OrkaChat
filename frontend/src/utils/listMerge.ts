export type HasId = { id: string };

/** Stable first-wins dedupe by `id`, preserving order. */
export function dedupeById<T extends HasId>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const id = String(it?.id ?? '');
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(it);
  }
  return out;
}

/** Append only items whose `id` is not already present in `prev`. */
export function appendUniqueById<T extends HasId>(
  prev: readonly T[],
  incoming: readonly T[],
): { merged: T[]; appendedCount: number } {
  if (!incoming.length) return { merged: prev.slice() as T[], appendedCount: 0 };
  const prevSeen = new Set(prev.map((m) => String(m.id)));
  const filtered: T[] = [];
  for (const it of incoming) {
    const id = String(it?.id ?? '');
    if (!id) continue;
    if (prevSeen.has(id)) continue;
    filtered.push(it);
  }
  return {
    merged: filtered.length ? [...prev, ...filtered] : (prev.slice() as T[]),
    appendedCount: filtered.length,
  };
}

/** Prepend only items whose `id` is not already present in `prev`. */
export function prependUniqueById<T extends HasId>(
  incoming: readonly T[],
  prev: readonly T[],
): T[] {
  if (!incoming.length) return prev.slice() as T[];
  const prevSeen = new Set(prev.map((m) => String(m.id)));
  const filtered: T[] = [];
  for (const it of incoming) {
    const id = String(it?.id ?? '');
    if (!id) continue;
    if (prevSeen.has(id)) continue;
    filtered.push(it);
  }
  return filtered.length ? [...filtered, ...prev] : (prev.slice() as T[]);
}
