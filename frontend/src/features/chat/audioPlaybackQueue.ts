export type AudioQueueItem = {
  key: string;
  createdAt: number;
  idx: number;
  title: string;
  /**
   * Autoplay grouping key: only autoplay to the next clip if its runKey matches.
   * This allows "autoplay consecutive clips from the same sender" while stopping
   * when another sender (or a non-audio message) interrupts the sequence.
   */
  runKey: string;
  resolveUri: () => Promise<string>;
};

export function normalizeContentType(ct: unknown): string {
  return String(ct || '')
    .trim()
    .toLowerCase()
    .split(';')[0]
    .trim();
}

export function isAudioContentType(ct: unknown): boolean {
  return normalizeContentType(ct).startsWith('audio/');
}

export function makeAudioKey(messageId: unknown, path: unknown, idx: number): string {
  return `${String(messageId)}:${String(path || '')}:${idx}`;
}

export function audioTitleFromFileName(fileName: unknown, fallback = 'Audio'): string {
  const raw = String(fileName || '').trim();
  if (!raw) return fallback;
  // Remove common extensions so titles are cleaner in-chat.
  const noExt = raw.replace(/\.[a-z0-9]{1,6}$/i, '').trim();
  const v = (noExt || raw).trim();
  const lower = v.toLowerCase();

  // Normalize our generated voice note filenames to a friendly label.
  // e.g. "voice-1700000000000", "voice_1700000000000", etc.
  if (/^voice[-_ ]\d{6,}$/.test(lower)) return 'Voice Clip';
  if (lower === 'voice clip' || lower === 'voiceclip') return 'Voice Clip';

  return v;
}

export function sortAudioQueue(items: AudioQueueItem[]): AudioQueueItem[] {
  // Always use chronological order for "autoplay next", regardless of list inversion on native.
  return [...items].sort(
    (a, b) => a.createdAt - b.createdAt || a.idx - b.idx || a.key.localeCompare(b.key),
  );
}
