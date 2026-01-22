import { createAudioPlayer } from 'expo-audio';

function isAudioContentType(contentType?: string): boolean {
  const ct = String(contentType || '')
    .trim()
    .toLowerCase()
    .split(';')[0]
    .trim();
  return !!ct && ct.startsWith('audio/');
}

/**
 * Best-effort duration probe for audio attachments.
 * - Avoids blocking if duration can't be determined (returns null).
 * - Should work on web + native (expo-audio internally uses platform players).
 */
export async function tryGetAudioDurationMs(args: {
  uri: string;
  contentType?: string;
  timeoutMs?: number;
}): Promise<number | null> {
  const uri = String(args.uri || '').trim();
  if (!uri) return null;
  if (!isAudioContentType(args.contentType)) return null;

  const timeoutMs = Math.max(250, Math.min(8_000, Number(args.timeoutMs) || 2_000));

  let resolved = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let sub: { remove?: () => void } | null = null;
  let player: { duration?: number; remove?: () => void; addListener?: any } | null = null;

  const cleanup = () => {
    if (timer) {
      try {
        clearTimeout(timer);
      } catch {}
      timer = null;
    }
    if (sub) {
      try {
        sub.remove?.();
      } catch {}
      sub = null;
    }
    if (player) {
      try {
        player.remove?.();
      } catch {}
      player = null;
    }
  };

  try {
    const p = createAudioPlayer({ uri }, { updateInterval: 250 });
    player = p as any;

    const result = await new Promise<number | null>((resolve) => {
      const finish = (v: number | null) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve(v);
      };

      timer = setTimeout(() => finish(null), timeoutMs);

      // If duration is already known immediately, use it.
      const d0 = Number((p as any).duration || 0);
      if (Number.isFinite(d0) && d0 > 0) {
        finish(Math.floor(d0 * 1000));
        return;
      }

      // Listen for status updates until duration is available.
      sub = (p as any).addListener?.('playbackStatusUpdate', (st: any) => {
        const d = Number(st?.duration || (p as any).duration || 0);
        if (Number.isFinite(d) && d > 0) finish(Math.floor(d * 1000));
      });
    });

    return typeof result === 'number' && Number.isFinite(result) && result > 0 ? result : null;
  } catch {
    cleanup();
    return null;
  }
}
