import * as React from 'react';

import { audioTitleFromFileName, makeAudioKey } from './audioPlaybackQueue';
import type { ChatMessage } from './types';
import type { ChatAudioPlayback } from './useChatAudioPlayback';

type ShowAlert = (title: string, message: string) => void;

function toUserFacingAudioError(e: unknown): string {
  if (e instanceof Error) return e.message || 'Could not play audio';
  if (typeof e === 'string') return e || 'Could not play audio';
  return 'Could not play audio';
}

export function buildChatAudioPlaybackForRender(args: {
  audioPlayback: ChatAudioPlayback;
  showAlert: ShowAlert;
}): ChatAudioPlayback & {
  getAudioKey: (msg: ChatMessage, idx: number, media: { path: string }) => string;
  getAudioTitle: (media: { fileName?: string }) => string;
  onPressAudio: (args: { key: string }) => Promise<void>;
} {
  const { audioPlayback, showAlert } = args;

  return {
    ...audioPlayback,
    getAudioKey: (msg: ChatMessage, idx: number, media: { path: string }) =>
      makeAudioKey(msg.id, media.path, idx),
    getAudioTitle: (media: { fileName?: string }) =>
      audioTitleFromFileName(media.fileName, 'Audio'),
    onPressAudio: async (args: { key: string }) => {
      try {
        await audioPlayback.toggle(args.key);
      } catch (e: unknown) {
        const msg = toUserFacingAudioError(e);
        showAlert('Audio', msg);
        console.warn('audio playback failed', e);
      }
    },
  };
}

export function buildGuestAudioPlaybackForRender(args: {
  audioPlayback: ChatAudioPlayback;
  showAlert: ShowAlert;
}): ChatAudioPlayback & {
  getKey: (msgId: string, idx: number, media: { path: string }) => string;
  onPress: (key: string) => Promise<void>;
} {
  const { audioPlayback, showAlert } = args;

  return {
    ...audioPlayback,
    getKey: (msgId: string, idx: number, media: { path: string }) =>
      makeAudioKey(msgId, media.path, idx),
    onPress: async (key: string) => {
      try {
        await audioPlayback.toggle(key);
      } catch (e: unknown) {
        const msg = toUserFacingAudioError(e);
        showAlert('Audio', msg);
        console.warn('guest audio playback failed', e);
      }
    },
  };
}

/**
 * Convenience hook wrappers (optional).
 * Keeping them here ensures stable memoization defaults.
 */
export function useChatAudioPlaybackForRender(
  audioPlayback: ChatAudioPlayback,
  showAlert: ShowAlert,
) {
  return React.useMemo(
    () => buildChatAudioPlaybackForRender({ audioPlayback, showAlert }),
    [audioPlayback, showAlert],
  );
}

export function useGuestAudioPlaybackForRender(
  audioPlayback: ChatAudioPlayback,
  showAlert: ShowAlert,
) {
  return React.useMemo(
    () => buildGuestAudioPlaybackForRender({ audioPlayback, showAlert }),
    [audioPlayback, showAlert],
  );
}
