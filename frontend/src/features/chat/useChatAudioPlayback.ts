import type { AudioPlayer, AudioStatus } from 'expo-audio';
import { createAudioPlayer } from 'expo-audio';
import * as React from 'react';

import { setChatPlaybackAudioModeAsync } from './chatAudioMode';

export type ChatAudioQueueItem = {
  key: string;
  createdAt: number;
  idx: number; // stable within message (tie-break)
  title: string;
  subtitle?: string;
  runKey: string;
  resolveUri: () => Promise<string>;
};

export type ChatAudioPlayback = {
  currentKey: string | null;
  loadingKey: string | null;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number | null;
  /**
   * Immediately stop playback and unload any currently loaded clip.
   * Intended for flows like voice recording where audio output must cease.
   */
  stopAll: () => Promise<void>;
  toggle: (key: string) => Promise<void>;
  seek: (ms: number) => Promise<void>;
  /**
   * Seek a specific clip. If it's not current, it will be loaded/selected first.
   * This prevents scrubbing one clip from moving another clip's slider.
   */
  seekFor: (key: string, ms: number) => Promise<void>;
};

function safeNowMs(): number {
  return Date.now();
}

export function useChatAudioPlayback(opts: { queue: ChatAudioQueueItem[] }): ChatAudioPlayback {
  const { queue } = opts;

  const [currentKey, setCurrentKey] = React.useState<string | null>(null);
  const [loadingKey, setLoadingKey] = React.useState<string | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [positionMs, setPositionMs] = React.useState(0);
  const [durationMs, setDurationMs] = React.useState<number | null>(null);

  const playerRef = React.useRef<AudioPlayer | null>(null);
  const playerSubRef = React.useRef<{ remove?: () => void } | null>(null);
  const lastStatusAtRef = React.useRef<number>(0);
  const currentKeyRef = React.useRef<string | null>(null);
  currentKeyRef.current = currentKey;

  const disposePlayerOnly = React.useCallback(() => {
    try {
      playerSubRef.current?.remove?.();
    } catch {
      // ignore
    }
    playerSubRef.current = null;

    const p = playerRef.current;
    playerRef.current = null;
    if (p) {
      try {
        // IMPORTANT: On some Android devices/emulators, `remove()` alone may not stop
        // audio immediately. Always pause first to enforce one-at-a-time playback.
        try {
          p.pause();
        } catch {
          // ignore
        }
        p.remove();
      } catch {
        // ignore
      }
    }
  }, []);

  const stopAndUnload = React.useCallback(async () => {
    setIsPlaying(false);
    setPositionMs(0);
    setDurationMs(null);
    setLoadingKey(null);
    setCurrentKey(null);
    currentKeyRef.current = null;
    disposePlayerOnly();
  }, [disposePlayerOnly]);

  // Cleanup on unmount.
  React.useEffect(() => {
    return () => {
      void stopAndUnload();
    };
  }, [stopAndUnload]);

  // Keep audio mode set for background playback on native.
  React.useEffect(() => {
    void setChatPlaybackAudioModeAsync();
  }, []);

  const loadKey = React.useCallback(
    async (key: string, opts: { autoplay: boolean }) => {
      try {
        const it = queue.find((q) => q.key === key);
        if (!it) return;

        setCurrentKey(key);
        currentKeyRef.current = key;
        setLoadingKey(key);
        setIsPlaying(false);
        setPositionMs(0);
        setDurationMs(null);

        const uri = String(await it.resolveUri()).trim();
        if (!uri) throw new Error('Missing audio URL');

        // Keep logging minimal; this flow is high-frequency during normal usage.

        // Recreate a fresh player per track for reliability across platforms (esp. web).
        disposePlayerOnly();
        const p = createAudioPlayer({ uri }, { updateInterval: 200 });
        playerRef.current = p;

        const onStatus = (st: AudioStatus) => {
          const now = safeNowMs();
          if (now - lastStatusAtRef.current < 150) return;
          lastStatusAtRef.current = now;

          setPositionMs(Math.floor((Number(st.currentTime) || 0) * 1000));
          setDurationMs(st.duration > 0 ? Math.floor(st.duration * 1000) : null);
          setIsPlaying(!!st.playing);
          if (st.isLoaded) setLoadingKey(null);

          if (st.didJustFinish) {
            setIsPlaying(false);
            const endedKey = currentKeyRef.current;
            if (!endedKey) return;
            const idx = queue.findIndex((q) => q.key === endedKey);
            const next = idx >= 0 ? queue[idx + 1] : null;
            const cur = idx >= 0 ? queue[idx] : null;
            // Only autoplay "runs" of consecutive audio from the same sender.
            if (next && cur && next.runKey && cur.runKey && next.runKey === cur.runKey) {
              // Avoid capturing `playKey` inside this callback to keep hook deps simple.
              void loadKey(next.key, { autoplay: true });
            }
          }
        };

        // SharedObject typically exposes addListener; types come from expo-modules-core.
        const sub = (p as any).addListener?.('playbackStatusUpdate', onStatus);
        playerSubRef.current = sub || null;

        if (opts.autoplay) {
          // Attempt playback. On web this can silently fail (CORS, blocked playback, bad URL).
          // We'll warn if we don't become "playing" shortly after.
          p.play();
        } else {
          // Keep paused; user may be scrubbing before pressing play.
          try {
            p.pause();
          } catch {
            // ignore
          }
          // If we don't press play, some platforms won't emit status updates immediately.
          // Clear "loading" quickly so other sliders stay interactive, and best-effort read duration.
          setTimeout(() => {
            if (currentKeyRef.current !== key) return;
            setLoadingKey((prev) => (prev === key ? null : prev));
            try {
              const d = Number((playerRef.current as any)?.duration || 0);
              if (Number.isFinite(d) && d > 0) setDurationMs(Math.floor(d * 1000));
            } catch {
              // ignore
            }
          }, 350);
        }
        setTimeout(() => {
          if (currentKeyRef.current !== key) return;
          if (!playerRef.current) return;
          if (opts.autoplay && !playerRef.current.playing) {
            console.warn(
              'Audio did not start playing. This is often caused by an invalid URL, blocked playback, or CORS.',
              { uri },
            );
          }
        }, 900);
      } catch (e) {
        // Ensure UI doesn't get stuck "loading".
        setLoadingKey(null);

        console.warn('playKey failed', e);
        throw e;
      }
    },
    [disposePlayerOnly, queue],
  );

  const playKey = React.useCallback(
    async (key: string) => {
      await loadKey(key, { autoplay: true });
    },
    [loadKey],
  );

  const toggle = React.useCallback(
    async (key: string) => {
      // If tapping the currently playing item, toggle pause/resume.
      if (currentKey && key === currentKey) {
        const p = playerRef.current;
        if (!p) return;
        if (p.playing) {
          p.pause();
          setIsPlaying(false);
        } else {
          p.play();
          setIsPlaying(true);
        }
        return;
      }

      // Switching items: load and play.
      await playKey(key);
    },
    [currentKey, playKey],
  );

  const seek = React.useCallback(
    async (ms: number) => {
      const target = Math.max(0, Math.floor(Number(ms) || 0));
      if (!currentKey) return;
      try {
        const p = playerRef.current;
        if (!p) return;
        await p.seekTo(target / 1000);
        setPositionMs(target);
      } catch {
        // ignore
      }
    },
    [currentKey],
  );

  const seekFor = React.useCallback(
    async (key: string, ms: number) => {
      const target = Math.max(0, Math.floor(Number(ms) || 0));
      if (!key) return;
      if (currentKeyRef.current !== key || !playerRef.current) {
        await loadKey(key, { autoplay: false });
      }
      try {
        const p = playerRef.current;
        if (!p) return;
        await p.seekTo(target / 1000);
        setPositionMs(target);
      } catch {
        // ignore
      }
    },
    [loadKey],
  );

  return {
    currentKey,
    loadingKey,
    isPlaying,
    positionMs,
    durationMs,
    stopAll: stopAndUnload,
    toggle,
    seek,
    seekFor,
  };
}
