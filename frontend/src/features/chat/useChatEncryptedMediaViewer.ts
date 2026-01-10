import * as React from 'react';
import type { ChatMessage, DmMediaEnvelopeV1, GroupMediaEnvelopeV1 } from './types';

export function useChatEncryptedMediaViewer(opts: {
  isDm: boolean;
  isGroup: boolean;
  viewer: { setState: (next: any) => void; setOpen: (next: boolean) => void };
  showAlert: (title: string, message: string) => void;
  parseDmMediaEnvelope: (raw: string) => any | null;
  parseGroupMediaEnvelope: (raw: string) => any | null;
  normalizeDmMediaItems: (env: any) => Array<{ media: DmMediaEnvelopeV1['media']; wrap: DmMediaEnvelopeV1['wrap'] }>;
  normalizeGroupMediaItems: (env: any) => Array<{ media: GroupMediaEnvelopeV1['media']; wrap: GroupMediaEnvelopeV1['wrap'] }>;
  decryptDmFileToCacheUri: (msg: ChatMessage, it: any) => Promise<string>;
  decryptGroupFileToCacheUri: (msg: ChatMessage, it: any) => Promise<string>;
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
        } as any);
        viewer.setOpen(true);
      } catch (e: any) {
        showAlert('Open failed', e?.message ?? 'Could not decrypt attachment');
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
        } as any);
        viewer.setOpen(true);
      } catch (e: any) {
        showAlert('Open failed', e?.message ?? 'Could not decrypt attachment');
      }
    },
    [isDm, decryptDmFileToCacheUri, showAlert, viewer, parseDmMediaEnvelope, normalizeDmMediaItems],
  );

  return { openDmMediaViewer, openGroupMediaViewer };
}

