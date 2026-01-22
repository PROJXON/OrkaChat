import * as React from 'react';
import { Image } from 'react-native';

import { isImageLike, isVideoLike } from '../../utils/mediaKinds';
import { normalizeChatMediaList, parseChatEnvelope } from './parsers';
import type { ChatMessage } from './types';

/**
 * Best-effort image aspect ratio prefetch for non-encrypted (channel/global) media.
 * This helps thumbnails render with correct rounding/sizing without visible "jump" after load.
 */
export function useChatImageAspectPrefetch(opts: {
  enabled: boolean;
  messages: ChatMessage[];
  mediaUrlByPath: Record<string, string>;
  imageAspectByPath: Record<string, number>;
  setImageAspectByPath: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}): void {
  const { enabled, messages, mediaUrlByPath, imageAspectByPath, setImageAspectByPath } = opts;
  const inFlightRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    if (!enabled) return;
    const needed: Array<{ path: string; url: string }> = [];

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
        if (!media?.path) continue;
        // Prefetch aspect for both image thumbs and video thumbs.
        // For videos, only use the thumbnail path (the video itself can't be sized via Image.getSize).
        const keyPath = isImageLike(media)
          ? media.thumbPath || media.path
          : isVideoLike(media)
            ? media.thumbPath || ''
            : '';
        if (!keyPath) continue;
        const url = mediaUrlByPath[keyPath];
        if (!url) continue;
        if (imageAspectByPath[keyPath]) continue;
        if (inFlightRef.current.has(keyPath)) continue;
        needed.push({ path: keyPath, url });
      }
    }

    if (!needed.length) return;
    needed.forEach(({ path }) => inFlightRef.current.add(path));

    needed.forEach(({ path, url }) => {
      Image.getSize(
        url,
        (w, h) => {
          const aspect = w > 0 && h > 0 ? w / h : 1;
          setImageAspectByPath((prev) => ({ ...prev, [path]: aspect }));
          inFlightRef.current.delete(path);
        },
        () => {
          inFlightRef.current.delete(path);
        },
      );
    });
  }, [enabled, messages, mediaUrlByPath, imageAspectByPath, setImageAspectByPath]);
}
