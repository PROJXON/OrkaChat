import * as React from 'react';

import type { MediaItem } from '../types/media';
import type { GlobalViewerItem } from '../utils/openGlobalViewer';
import { openGlobalViewerFromMediaList } from '../utils/openGlobalViewer';

type NoInfer<T> = [T][T extends unknown ? 0 : never];

export function useOpenGlobalViewer<TViewerState>(opts: {
  resolveUrlForPath: (path: string) => Promise<string | null> | string | null;
  includeFilesInViewer: boolean;
  openExternalIfFile: boolean;
  openExternalUrl?: (args: {
    url: string;
    fileName?: string;
    contentType?: string;
  }) => Promise<void> | void;
  viewer: {
    setState: React.Dispatch<React.SetStateAction<TViewerState | null>>;
    setOpen: (v: boolean) => void;
  };
  buildGlobalState: (args: { index: number; items: GlobalViewerItem[] }) => NoInfer<TViewerState>;
}) {
  const {
    resolveUrlForPath,
    includeFilesInViewer,
    openExternalIfFile,
    openExternalUrl,
    viewer,
    buildGlobalState,
  } = opts;

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
        if (openExternalUrl)
          await openExternalUrl({
            url: result.url,
            fileName: result.fileName,
            contentType: result.contentType,
          });
        return;
      }
      viewer.setState(buildGlobalState({ index: result.index, items: result.items }));
      viewer.setOpen(true);
    },
    [
      includeFilesInViewer,
      openExternalIfFile,
      openExternalUrl,
      resolveUrlForPath,
      viewer,
      buildGlobalState,
    ],
  );
}
