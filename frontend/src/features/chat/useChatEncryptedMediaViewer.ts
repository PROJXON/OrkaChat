import * as React from 'react';

import { getPreviewKind } from '../../utils/mediaKinds';
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

function previewKindForEncryptedMedia(media: {
  kind: string;
  contentType?: string;
}): 'image' | 'video' | 'file' {
  return getPreviewKind({
    kind: media.kind === 'video' ? 'video' : media.kind === 'image' ? 'image' : 'file',
    contentType: media.contentType,
  });
}

export function useChatEncryptedMediaViewer(opts: {
  isDm: boolean;
  isGroup: boolean;
  /**
   * Called to open a URL externally (browser / OS viewer / download).
   * For example, ChatScreen passes `requestOpenLink`.
   */
  openExternalUrl?: (args: {
    url: string;
    fileName?: string;
    contentType?: string;
  }) => Promise<void> | void;
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
    openExternalUrl,
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
      const previewKind = previewKindForEncryptedMedia(it.media);
      // Web: keep a handle so we can close blank tab on failure.
      try {
        // Intentionally await so we fail fast if decrypt is impossible.
        const uri = await decryptGroupFileToCacheUri(msg, it);
        if (openExternalUrl && previewKind === 'file') {
          await openExternalUrl({
            url: uri,
            fileName: it.media.fileName,
            contentType: it.media.contentType,
          });
          return;
        }

        // Viewer should only include previewable media (image/video).
        // Files are opened externally via attachment tiles.
        const filtered: GroupMediaItem[] = [];
        const previewIdxByOriginalIdx: number[] = [];
        for (let i = 0; i < items.length; i++) {
          if (previewKindForEncryptedMedia(items[i].media) !== 'file') {
            previewIdxByOriginalIdx[i] = filtered.length;
            filtered.push(items[i]);
          }
        }
        const mappedIdx = previewIdxByOriginalIdx[idx] ?? 0;

        viewer.setState({
          mode: 'gdm',
          index: Math.max(0, Math.min(filtered.length - 1, mappedIdx)),
          gdmMsg: msg,
          gdmItems: filtered,
          title: it.media.fileName,
        });
        viewer.setOpen(true);
      } catch (e: unknown) {
        showAlert('Open Failed', getErrorMessage(e) || 'Could not decrypt attachment');
      }
    },
    [
      isGroup,
      decryptGroupFileToCacheUri,
      showAlert,
      viewer,
      parseGroupMediaEnvelope,
      normalizeGroupMediaItems,
      openExternalUrl,
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
      const previewKind = previewKindForEncryptedMedia(it.media);
      // Web: keep a handle so we can close blank tab on failure.
      try {
        // Start viewer in DM mode; additional pages will decrypt lazily.
        const uri = await decryptDmFileToCacheUri(msg, it);
        if (openExternalUrl && previewKind === 'file') {
          await openExternalUrl({
            url: uri,
            fileName: it.media.fileName,
            contentType: it.media.contentType,
          });
          return;
        }

        // Viewer should only include previewable media (image/video).
        // Files are opened externally via attachment tiles.
        const filtered: DmMediaItem[] = [];
        const previewIdxByOriginalIdx: number[] = [];
        for (let i = 0; i < items.length; i++) {
          if (previewKindForEncryptedMedia(items[i].media) !== 'file') {
            previewIdxByOriginalIdx[i] = filtered.length;
            filtered.push(items[i]);
          }
        }
        const mappedIdx = previewIdxByOriginalIdx[idx] ?? 0;

        viewer.setState({
          mode: 'dm',
          index: Math.max(0, Math.min(filtered.length - 1, mappedIdx)),
          dmMsg: msg,
          dmItems: filtered,
          title: it.media.fileName,
        });
        viewer.setOpen(true);
      } catch (e: unknown) {
        showAlert('Open Failed', getErrorMessage(e) || 'Could not decrypt attachment');
      }
    },
    [
      isDm,
      decryptDmFileToCacheUri,
      showAlert,
      viewer,
      parseDmMediaEnvelope,
      normalizeDmMediaItems,
      openExternalUrl,
    ],
  );

  return { openDmMediaViewer, openGroupMediaViewer };
}
