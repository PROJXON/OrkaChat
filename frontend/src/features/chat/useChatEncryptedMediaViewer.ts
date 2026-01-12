import * as React from 'react';

import type {
  ChatMessage,
  DmMediaEnvelope,
  DmMediaEnvelopeV1,
  GroupMediaEnvelope,
  GroupMediaEnvelopeV1,
} from './types';
import type { ChatMediaViewerState } from './viewerTypes';

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message || 'Unknown error';
  if (typeof err === 'string') return err || 'Unknown error';
  if (!err) return 'Unknown error';
  try {
    const rec = err as Record<string, unknown>;
    const msg = rec?.message;
    return typeof msg === 'string' && msg ? msg : 'Unknown error';
  } catch {
    return 'Unknown error';
  }
}

type DmMediaItem = { media: DmMediaEnvelopeV1['media']; wrap: DmMediaEnvelopeV1['wrap'] };
type GroupMediaItem = { media: GroupMediaEnvelopeV1['media']; wrap: GroupMediaEnvelopeV1['wrap'] };

export function useChatEncryptedMediaViewer(opts: {
  isDm: boolean;
  isGroup: boolean;
  viewer: {
    setState: (next: NonNullable<ChatMediaViewerState>) => void;
    setOpen: (next: boolean) => void;
  };
  showAlert: (title: string, message: string) => void;
  parseDmMediaEnvelope: (raw: string) => DmMediaEnvelope | null;
  parseGroupMediaEnvelope: (raw: string) => GroupMediaEnvelope | null;
  normalizeDmMediaItems: (env: DmMediaEnvelope | null) => DmMediaItem[];
  normalizeGroupMediaItems: (env: GroupMediaEnvelope | null) => GroupMediaItem[];
  decryptDmFileToCacheUri: (msg: ChatMessage, it: DmMediaItem) => Promise<string>;
  decryptGroupFileToCacheUri: (msg: ChatMessage, it: GroupMediaItem) => Promise<string>;
}): {
  openDmMediaViewer: (msg: ChatMessage, idx?: number) => Promise<void>;
  openGroupMediaViewer: (msg: ChatMessage, idx?: number) => Promise<void>;
} {
  const {
    isDm,
    isGroup,
    viewer,
    showAlert,
    parseDmMediaEnvelope,
    parseGroupMediaEnvelope,
    normalizeDmMediaItems,
    normalizeGroupMediaItems,
    decryptDmFileToCacheUri,
    decryptGroupFileToCacheUri,
  } = opts;

  const openGroupMediaViewer = React.useCallback(
    async (msg: ChatMessage, idx: number = 0) => {
      if (!isGroup) return;
      if (!msg.decryptedText || !msg.groupKeyHex) return;
      const env = parseGroupMediaEnvelope(msg.decryptedText);
      if (!env) return;
      const items = normalizeGroupMediaItems(env);
      const it = items[idx];
      if (!it) return;
      try {
        // Intentionally await so we fail fast if decrypt is impossible.
        await decryptGroupFileToCacheUri(msg, it);
        viewer.setState({
          mode: 'gdm',
          index: Math.max(0, Math.min(items.length - 1, idx)),
          gdmMsg: msg,
          gdmItems: items,
          title: it.media.fileName,
        });
        viewer.setOpen(true);
      } catch (e: unknown) {
        showAlert('Open failed', getErrorMessage(e) || 'Could not decrypt attachment');
      }
    },
    [
      isGroup,
      decryptGroupFileToCacheUri,
      showAlert,
      viewer,
      parseGroupMediaEnvelope,
      normalizeGroupMediaItems,
    ],
  );

  const openDmMediaViewer = React.useCallback(
    async (msg: ChatMessage, idx: number = 0) => {
      if (!isDm) return;
      if (!msg.decryptedText) return;
      const env = parseDmMediaEnvelope(msg.decryptedText);
      if (!env) return;
      const items = normalizeDmMediaItems(env);
      const it = items[idx];
      if (!it) return;
      try {
        // Start viewer in DM mode; additional pages will decrypt lazily.
        await decryptDmFileToCacheUri(msg, it);
        viewer.setState({
          mode: 'dm',
          index: Math.max(0, Math.min(items.length - 1, idx)),
          dmMsg: msg,
          dmItems: items,
          title: it.media.fileName,
        });
        viewer.setOpen(true);
      } catch (e: unknown) {
        showAlert('Open failed', getErrorMessage(e) || 'Could not decrypt attachment');
      }
    },
    [isDm, decryptDmFileToCacheUri, showAlert, viewer, parseDmMediaEnvelope, normalizeDmMediaItems],
  );

  return { openDmMediaViewer, openGroupMediaViewer };
}
