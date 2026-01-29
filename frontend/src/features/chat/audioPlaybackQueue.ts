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

type BuildAudioQueueItemInput = {
  key: string;
  idx: number;
  title: string;
  resolveUri: () => Promise<string>;
};

/**
 * Build a stable, chronological inline-audio queue with Signal-style "run" autoplay grouping.
 *
 * Notes:
 * - Messages that don't yield audio items break the current run (text-only, non-audio attachments,
 *   encrypted-not-decrypted, etc).
 * - `runKey` is used by `useChatAudioPlayback` to decide whether to autoplay the next clip.
 */
export function buildAudioQueueFromMessages<M>(
  messages: M[],
  opts: {
    getCreatedAt: (msg: M) => number;
    getSenderKey: (msg: M) => string;
    getAudioItemsForMessage: (msg: M) => BuildAudioQueueItemInput[];
  },
): AudioQueueItem[] {
  const { getCreatedAt, getSenderKey, getAudioItemsForMessage } = opts;

  const items: AudioQueueItem[] = [];
  const msgsChrono = [...messages].sort((a, b) => {
    return (Number(getCreatedAt(a)) || 0) - (Number(getCreatedAt(b)) || 0);
  });

  let runSeq = 0;
  let prevSenderKey: string | null = null;
  let prevMsgHadAudio = false;

  for (const msg of msgsChrono) {
    const audioItems = getAudioItemsForMessage(msg) || [];
    if (!audioItems.length) {
      // Any non-audio message breaks the "consecutive voice clips" run.
      prevMsgHadAudio = false;
      prevSenderKey = null;
      continue;
    }

    const senderKey = String(getSenderKey(msg) || 'anon');
    if (!(prevMsgHadAudio && prevSenderKey === senderKey)) runSeq += 1;
    const runKey = `${senderKey}:${runSeq}`;
    prevSenderKey = senderKey;
    prevMsgHadAudio = true;

    const createdAt = Number(getCreatedAt(msg)) || 0;
    for (const it of audioItems) {
      items.push({
        key: it.key,
        createdAt,
        idx: it.idx,
        title: it.title,
        runKey,
        resolveUri: it.resolveUri,
      });
    }
  }

  return sortAudioQueue(items);
}
