import * as React from 'react';
import type { ChatMessage, DmMediaEnvelopeV1 } from './types';

type DmViewerState = {
  mode: 'dm';
  index: number;
  dmMsg?: ChatMessage;
  dmItems?: Array<{ media: DmMediaEnvelopeV1['media']; wrap: DmMediaEnvelopeV1['wrap'] }>;
};

type GroupViewerState = {
  mode: 'gdm';
  index: number;
  gdmMsg?: ChatMessage;
  gdmItems?: Array<{ media: DmMediaEnvelopeV1['media']; wrap: DmMediaEnvelopeV1['wrap'] }>;
};

type ViewerStateLike = { mode: 'global' } | DmViewerState | GroupViewerState;

export function useLazyDecryptDmViewerPages(opts: {
  viewerOpen: boolean;
  viewerState: ViewerStateLike | null | undefined;
  dmFileUriByPath: Record<string, string>;
  inFlightRef: React.MutableRefObject<Set<string>>;
  decryptDmFileToCacheUri: (msg: ChatMessage, it: { media: DmMediaEnvelopeV1['media']; wrap: DmMediaEnvelopeV1['wrap'] }) => Promise<string>;
}): void {
  const { viewerOpen, viewerState, dmFileUriByPath, inFlightRef, decryptDmFileToCacheUri } = opts;

  // Fullscreen DM viewer: lazily decrypt the currently visible page (and a neighbor).
  React.useEffect(() => {
    if (!viewerOpen) return;
    const vs = viewerState;
    if (!vs || vs.mode !== 'dm') return;
    const msg = vs.dmMsg;
    const items = vs.dmItems;
    if (!msg || !items || !items.length) return;

    const want = [vs.index, vs.index + 1, vs.index - 1]
      .filter((i) => typeof i === 'number' && i >= 0 && i < items.length)
      .slice(0, 3);

    want.forEach((i) => {
      const it = items[i];
      const key = it?.media?.path;
      if (!key) return;
      if (dmFileUriByPath[key]) return;
      if (inFlightRef.current.has(key)) return;
      inFlightRef.current.add(key);
      decryptDmFileToCacheUri(msg, it)
        .catch(() => {})
        .finally(() => {
          inFlightRef.current.delete(key);
        });
    });
  }, [viewerOpen, viewerState, dmFileUriByPath, decryptDmFileToCacheUri, inFlightRef]);
}

export function useLazyDecryptGroupViewerPages(opts: {
  viewerOpen: boolean;
  viewerState: ViewerStateLike | null | undefined;
  dmFileUriByPath: Record<string, string>;
  inFlightRef: React.MutableRefObject<Set<string>>;
  decryptGroupFileToCacheUri: (msg: ChatMessage, it: { media: DmMediaEnvelopeV1['media']; wrap: DmMediaEnvelopeV1['wrap'] }) => Promise<string>;
}): void {
  const { viewerOpen, viewerState, dmFileUriByPath, inFlightRef, decryptGroupFileToCacheUri } = opts;

  // Fullscreen Group viewer: lazily decrypt the currently visible page (and a neighbor).
  React.useEffect(() => {
    if (!viewerOpen) return;
    const vs = viewerState;
    if (!vs || vs.mode !== 'gdm') return;
    const msg = vs.gdmMsg;
    const items = vs.gdmItems;
    if (!msg || !items || !items.length) return;

    const want = [vs.index, vs.index + 1, vs.index - 1]
      .filter((i) => typeof i === 'number' && i >= 0 && i < items.length)
      .slice(0, 3);
    want.forEach((i) => {
      const it = items[i];
      const key = it?.media?.path;
      if (!key) return;
      if (dmFileUriByPath[key]) return;
      if (inFlightRef.current.has(key)) return;
      inFlightRef.current.add(key);
      decryptGroupFileToCacheUri(msg, it)
        .catch(() => {})
        .finally(() => {
          inFlightRef.current.delete(key);
        });
    });
  }, [viewerOpen, viewerState, dmFileUriByPath, decryptGroupFileToCacheUri, inFlightRef]);
}

