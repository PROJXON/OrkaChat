export type AudioQueueItem = {
  key: string;
  createdAt: number;
  idx: number;
  title: string;
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
  return String(fileName || '').trim() || fallback;
}

export function sortAudioQueue(items: AudioQueueItem[]): AudioQueueItem[] {
  // Always use chronological order for "autoplay next", regardless of list inversion on native.
  return [...items].sort(
    (a, b) => a.createdAt - b.createdAt || a.idx - b.idx || a.key.localeCompare(b.key),
  );
}
