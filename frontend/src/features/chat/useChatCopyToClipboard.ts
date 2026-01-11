import * as React from 'react';

import { copyToClipboardSafe } from '../../utils/clipboard';

export function useChatCopyToClipboard(opts: {
  openInfo: (title: string, body: string) => void;
}): { copyToClipboard: (text: string) => Promise<void> } {
  const { openInfo } = opts;

  const copyToClipboard = React.useCallback(
    async (text: string) => {
      await copyToClipboardSafe({
        text,
        onUnavailable: () => {
          openInfo(
            'Copy unavailable',
            'Your current build does not include clipboard support yet. Rebuild the dev client to enable Copy.',
          );
        },
      });
    },
    [openInfo],
  );

  return { copyToClipboard };
}

