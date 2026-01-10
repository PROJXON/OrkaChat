import * as React from 'react';
import type { MediaItem } from '../types/media';
import { openGlobalViewerFromMediaList } from '../utils/openGlobalViewer';

export function useOpenGlobalViewer(opts: {
  resolveUrlForPath: (path: string) => Promise<string | null> | string | null;
  includeFilesInViewer: boolean;
  openExternalIfFile: boolean;
  openExternalUrl?: (url: string) => Promise<void> | void;
  viewer: {
    setState: (v: any) => void;
    setOpen: (v: boolean) => void;
  };
}) {
  const { resolveUrlForPath, includeFilesInViewer, openExternalIfFile, openExternalUrl, viewer } = opts;

  return React.useCallback(
    async (mediaList: MediaItem[], startIdx: number) => {
      const result = await openGlobalViewerFromMediaList({
        mediaList,
        startIdx,
        resolveUrlForPath,
        openExternalIfFile,
        includeFilesInViewer,
      });
      if (!result) return;
      if (result.mode === 'external') {
        if (openExternalUrl) await openExternalUrl(result.url);
        return;
      }
      viewer.setState({ mode: 'global', index: result.index, globalItems: result.items } as any);
      viewer.setOpen(true);
    },
    [includeFilesInViewer, openExternalIfFile, openExternalUrl, resolveUrlForPath, viewer],
  );
}

