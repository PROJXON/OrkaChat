import * as React from 'react';

import {
  normalizeDmMediaItems,
  normalizeGroupMediaItems,
  parseDmMediaEnvelope,
  parseGroupMediaEnvelope,
} from './parsers';
import type { ChatMessage, DmMediaEnvelopeV1 } from './types';

export function usePrefetchDmDecryptedThumbs(opts: {
  enabled: boolean;
  messages: ChatMessage[];
  dmThumbUriByPath: Record<string, string>;
  decryptDmThumbToDataUri: (
    msg: ChatMessage,
    it: { media: DmMediaEnvelopeV1['media']; wrap: DmMediaEnvelopeV1['wrap'] },
  ) => Promise<string | null>;
}): void {
  const enabled = !!opts.enabled;
  const messages = opts.messages;
  const dmThumbUriByPath = opts.dmThumbUriByPath;
  const decryptDmThumbToDataUri = opts.decryptDmThumbToDataUri;

  // DM: decrypt thumbnails once messages are decrypted (so we can render inline previews).
  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const run = async () => {
      for (const m of messages) {
        if (cancelled) return;
        if (!m.decryptedText) continue;
        const env = parseDmMediaEnvelope(m.decryptedText);
        const items = normalizeDmMediaItems(env);
        for (const it of items) {
          if (cancelled) return;
          if (!it.media.thumbPath || !it.media.thumbIv) continue;
          if (dmThumbUriByPath[it.media.thumbPath]) continue;
          try {
            await decryptDmThumbToDataUri(m, it);
          } catch {
            // ignore
          }
        }
      }
    };
    setTimeout(() => void run(), 0);
    return () => {
      cancelled = true;
    };
  }, [enabled, messages, dmThumbUriByPath, decryptDmThumbToDataUri]);
}

export function usePrefetchGroupDecryptedThumbs(opts: {
  enabled: boolean;
  messages: ChatMessage[];
  dmThumbUriByPath: Record<string, string>;
  decryptGroupThumbToDataUri: (
    msg: ChatMessage,
    it: { media: DmMediaEnvelopeV1['media']; wrap: DmMediaEnvelopeV1['wrap'] },
  ) => Promise<string | null>;
}): void {
  const enabled = !!opts.enabled;
  const messages = opts.messages;
  const dmThumbUriByPath = opts.dmThumbUriByPath;
  const decryptGroupThumbToDataUri = opts.decryptGroupThumbToDataUri;

  // Group DM: decrypt thumbnails once messages are decrypted.
  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const run = async () => {
      for (const m of messages) {
        if (cancelled) return;
        if (!m.decryptedText || !m.groupKeyHex) continue;
        const env = parseGroupMediaEnvelope(m.decryptedText);
        const items = normalizeGroupMediaItems(env);
        for (const it of items) {
          if (cancelled) return;
          if (!it.media.thumbPath || !it.media.thumbIv) continue;
          if (dmThumbUriByPath[it.media.thumbPath]) continue;
          try {
            await decryptGroupThumbToDataUri(m, it);
          } catch {
            // ignore
          }
        }
      }
    };
    setTimeout(() => void run(), 0);
    return () => {
      cancelled = true;
    };
  }, [enabled, messages, dmThumbUriByPath, decryptGroupThumbToDataUri]);
}
