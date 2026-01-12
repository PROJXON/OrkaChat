import * as React from 'react';

import { normalizeChatMediaList, parseChatEnvelope } from './parsers';
import type { ChatMessage } from './types';

/**
 * Prefetch unsigned/public CDN URLs for channel/global media paths.
 * (DM/group media uses signed/decrypted flows, so this is disabled for DMs.)
 */
export function useChatCdnMediaPrefetch(opts: {
  enabled: boolean;
  messages: ChatMessage[];
  mediaUrlByPath: Record<string, string>;
  ensure: (paths: string[]) => void;
}): void {
  const { enabled, messages, mediaUrlByPath, ensure } = opts;

  React.useEffect(() => {
    if (!enabled) return;
    const needed: string[] = [];

    for (const m of messages) {
      const env = !m.encrypted ? parseChatEnvelope(m.rawText ?? m.text) : null;
      const list = env
        ? normalizeChatMediaList(env.media)
        : m.mediaList
          ? m.mediaList
          : m.media
            ? [m.media]
            : [];
      for (const media of list) {
        const paths: string[] = [];
        if (media?.path) paths.push(media.path);
        if (media?.thumbPath) paths.push(media.thumbPath);
        for (const path of paths) {
          if (!path) continue;
          if (mediaUrlByPath[path]) continue;
          needed.push(path);
        }
      }
    }

    if (!needed.length) return;
    ensure(needed);
  }, [enabled, messages, mediaUrlByPath, ensure]);
}
