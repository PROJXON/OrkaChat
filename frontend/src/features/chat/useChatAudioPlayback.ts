import type { AudioPlayer, AudioStatus } from 'expo-audio';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as React from 'react';

export type ChatAudioQueueItem = {
  key: string;
  createdAt: number;
  idx: number; // stable within message (tie-break)
  title: string;
  subtitle?: string;
  resolveUri: () => Promise<string>;
};

export type ChatAudioPlayback = {
  currentKey: string | null;
  loadingKey: string | null;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number | null;
  toggle: (key: string) => Promise<void>;
  seek: (ms: number) => Promise<void>;
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
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'duckOthers',
      allowsRecording: false,
      shouldRouteThroughEarpiece: false,
    }).catch(() => {});
  }, []);

  const playKey = React.useCallback(
    async (key: string) => {
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

        if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('audio play', { key, uri });

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
            if (next) void playKey(next.key);
          }
        };

        // SharedObject typically exposes addListener; types come from expo-modules-core.
        const sub = (p as any).addListener?.('playbackStatusUpdate', onStatus);
        playerSubRef.current = sub || null;

        // Attempt playback. On web this can silently fail (CORS, blocked playback, bad URL).
        // We'll warn if we don't become "playing" shortly after.
        p.play();
        setTimeout(() => {
          if (currentKeyRef.current !== key) return;
          if (!playerRef.current) return;
          if (!playerRef.current.playing) {
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

  return {
    currentKey,
    loadingKey,
    isPlaying,
    positionMs,
    durationMs,
    toggle,
    seek,
  };
}
