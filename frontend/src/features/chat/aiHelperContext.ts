import { normalizeChatMediaList, parseChatEnvelope } from './parsers';
import type { ChatMessage } from './types';
import { formatBytes } from './uploads';

export type AiTranscriptItem = {
  user: string;
  text: string;
  createdAt?: number;
};

export type AiAttachmentForAi = {
  kind: 'image' | 'video';
  thumbKey: string;
  thumbUrl: string;
  fileName?: string;
  size?: number;
  user?: string;
  createdAt?: number;
};

export function buildAiHelperContext(opts: {
  // messages[] is newest-first (FlatList inverted)
  messages: ChatMessage[];
  isDm: boolean;
  mediaUrlByPath: Record<string, string>;
  cdnResolve: (path: string) => string;
  maxMessages?: number;
  maxThumbs?: number;
}): { transcript: AiTranscriptItem[]; attachments: AiAttachmentForAi[] } {
  const { messages, isDm, mediaUrlByPath, cdnResolve, maxMessages = 50, maxThumbs = 3 } = opts;

  const recentNewestFirst = Array.isArray(messages) ? messages.slice(0, maxMessages) : [];
  const recent = recentNewestFirst.slice().reverse();

  const resolvedThumbUrlByKey: Record<string, string> = {};
  const attachmentsForAi: AiAttachmentForAi[] = [];

  // Collect up to N *most recent* attachment thumbnails (Global only).
  // If the thumb URL isn't already in `mediaUrlByPath`, resolve it on-demand.
  if (!isDm) {
    for (const m of recentNewestFirst) {
      if (attachmentsForAi.length >= maxThumbs) break;
      if (m?.encrypted) continue; // never send encrypted payloads to AI
      const raw = m?.decryptedText ?? m?.rawText ?? m?.text;
      const env = parseChatEnvelope(String(raw || ''));
      const list = env
        ? normalizeChatMediaList(env.media)
        : m?.mediaList
          ? m.mediaList
          : m?.media
            ? [m.media]
            : [];

      for (const media of list) {
        if (attachmentsForAi.length >= maxThumbs) break;
        if (!(media?.kind === 'image' || media?.kind === 'video')) continue;

        const thumbKey = String(media?.thumbPath || media?.path || '');
        if (!thumbKey) continue;

        let thumbUrl = resolvedThumbUrlByKey[thumbKey] || mediaUrlByPath[thumbKey] || '';
        if (!thumbUrl) {
          try {
            thumbUrl = cdnResolve(thumbKey) || '';
            if (thumbUrl) resolvedThumbUrlByKey[thumbKey] = thumbUrl;
          } catch {
            // ignore URL resolution failures; AI will fall back to text-only description
          }
        }
        if (!thumbUrl) continue;

        attachmentsForAi.push({
          kind: media.kind,
          thumbKey,
          thumbUrl,
          fileName: media.fileName,
          size: media.size,
          user: m?.user,
          createdAt: m?.createdAt,
        });
      }
    }
  }

  const transcript: AiTranscriptItem[] = recent
    .map((m) => {
      // Only send plaintext. If message is still encrypted, skip it.
      const raw = m?.decryptedText ?? (m?.encrypted ? '' : (m?.rawText ?? m?.text));
      const env = !m?.encrypted && !isDm ? parseChatEnvelope(raw) : null;
      const list = env
        ? normalizeChatMediaList(env.media)
        : m?.mediaList
          ? m.mediaList
          : m?.media
            ? [m.media]
            : [];

      // If the message includes media, add a better text description.
      const mediaDesc = (() => {
        if (!list.length) return '';
        if (list.length === 1) {
          const media = list[0];
          const kindLabel =
            media.kind === 'image' ? 'Image' : media.kind === 'video' ? 'Video' : 'File';
          const name = media.fileName ? ` "${media.fileName}"` : '';
          const size = typeof media.size === 'number' ? ` (${formatBytes(media.size)})` : '';
          return `${kindLabel} attachment${name}${size}`;
        }
        return `${list.length} attachments`;
      })();

      const rawText = String(raw || '');
      const baseText = rawText.length ? rawText : mediaDesc;
      const text = baseText.length > 500 ? `${baseText.slice(0, 500)}…` : baseText;

      return text
        ? {
            user: m?.user ?? 'anon',
            text,
            createdAt: m?.createdAt,
          }
        : null;
    })
    .filter(Boolean) as AiTranscriptItem[];

  return { transcript, attachments: attachmentsForAi.slice(0, maxThumbs) };
}
