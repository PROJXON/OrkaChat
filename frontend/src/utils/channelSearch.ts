export type ChannelSearchItem = {
  channelId: string;
  name: string;
  nameLower?: string;
  isPublic: boolean;
  hasPassword?: boolean;
  activeMemberCount?: number;
  isMember?: boolean;
};

export type ChannelSearchResponse = {
  globalUserCount: number | null;
  channels: ChannelSearchItem[];
};

async function parseErrorMessage(resp: Response, fallback: string): Promise<string> {
  const text = await resp.text().catch(() => '');
  let msg = `${fallback} (${resp.status})`;
  try {
    const parsed = text ? JSON.parse(text) : null;
    if (parsed && typeof parsed.message === 'string') return String(parsed.message);
  } catch {
    // ignore
  }
  if (text.trim()) msg = `${msg}: ${text.trim()}`;
  return msg;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

function toFiniteIntOrNull(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  return i >= 0 ? i : null;
}

function normalizeChannelList(data: unknown): ChannelSearchResponse {
  const rec = isRecord(data) ? data : {};
  const listRaw = rec.channels;
  const list: unknown[] = Array.isArray(listRaw) ? listRaw : [];
  const channels: ChannelSearchItem[] = list
    .map((raw): ChannelSearchItem | null => {
      const c = isRecord(raw) ? raw : {};
      const channelId = String(c.channelId || '').trim();
      const name = String(c.name || '').trim();
      if (!channelId || !name) return null;
      return {
        channelId,
        name,
        nameLower: typeof c.nameLower === 'string' ? String(c.nameLower) : undefined,
        isPublic: !!c.isPublic,
        hasPassword: typeof c.hasPassword === 'boolean' ? c.hasPassword : undefined,
        activeMemberCount: toFiniteIntOrNull(c.activeMemberCount) ?? undefined,
        isMember: typeof c.isMember === 'boolean' ? c.isMember : undefined,
      };
    })
    .filter((c): c is ChannelSearchItem => !!c);

  const globalUserCount = toFiniteIntOrNull(rec.globalUserCount);

  return { globalUserCount, channels };
}

export async function searchChannels(opts: {
  apiUrl: string;
  query: string;
  limit?: number;
  /** If provided, we'll call the authed endpoint with Authorization header. */
  token?: string | null;
  /** If true, we try the public endpoint before the authed endpoint (when both are applicable). */
  preferPublic?: boolean;
  /** Control which endpoints to try (defaults: both). */
  includePublic?: boolean;
  includeAuthed?: boolean;
  /** Override endpoints used. */
  paths?: { publicSearch?: string; authedSearch?: string };
}): Promise<ChannelSearchResponse> {
  const base = String(opts.apiUrl || '').replace(/\/$/, '');
  if (!base) return { globalUserCount: null, channels: [] };

  const q = String(opts.query || '').trim();
  const limit =
    typeof opts.limit === 'number' && Number.isFinite(opts.limit) && opts.limit > 0
      ? Math.floor(opts.limit)
      : 50;

  const qs = `limit=${encodeURIComponent(String(limit))}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
  const publicPath = opts.paths?.publicSearch ?? '/public/channels/search';
  const authedPath = opts.paths?.authedSearch ?? '/channels/search';

  const candidates: Array<{
    url: string;
    headers?: Record<string, string>;
    label: string;
    kind: 'public' | 'authed';
  }> = [];
  const publicUrl = `${base}${publicPath}?${qs}`;
  const authedUrl = `${base}${authedPath}?${qs}`;
  const hasToken = !!(opts.token && String(opts.token).trim());

  const addPublic = () =>
    candidates.push({ url: publicUrl, label: `GET ${publicPath}`, kind: 'public' });
  const addAuthed = () =>
    candidates.push({
      url: authedUrl,
      label: `GET ${authedPath}`,
      kind: 'authed',
      headers: hasToken ? { Authorization: `Bearer ${String(opts.token)}` } : undefined,
    });

  const includePublic = opts.includePublic !== false;
  const includeAuthed = opts.includeAuthed !== false;

  if (opts.preferPublic) {
    if (includePublic) addPublic();
    if (includeAuthed) addAuthed();
  } else {
    if (includeAuthed) addAuthed();
    if (includePublic) addPublic();
  }

  const errors: string[] = [];
  for (const c of candidates) {
    try {
      // If the authed candidate has no token, skip it (guest mode).
      // IMPORTANT: don't use string matching here because `/public/channels/search`
      // contains `/channels/search` as a suffix and would be incorrectly skipped.
      if (c.kind === 'authed' && !hasToken) {
        continue;
      }
      const resp = await fetch(c.url, c.headers ? { headers: c.headers } : undefined);
      if (!resp.ok) {
        errors.push(await parseErrorMessage(resp, `${c.label} failed`));
        continue;
      }
      const data = await resp.json().catch(() => ({}));
      return normalizeChannelList(data);
    } catch (e) {
      errors.push(`${c.label} threw: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  throw new Error(errors.length ? errors.join('\n') : 'Channel search failed');
}

/**
 * Shared "Global" visibility rule for channel search UIs.
 *
 * - Show Global as a suggestion when the query is empty
 * - Otherwise only show Global when the query is clearly trying to find "Global"
 *   (so it doesn't feel "pinned" during unrelated searches)
 */
export function shouldShowGlobalForChannelSearch(query: string): boolean {
  const q = String(query || '').trim();
  if (!q) return true;
  const lower = q.toLowerCase();
  // Keep the behavior conservative to avoid showing Global on 1-char searches.
  if (lower.length < 2) return false;
  return 'global'.includes(lower);
}
