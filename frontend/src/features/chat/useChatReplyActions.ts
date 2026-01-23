import * as React from 'react';

import type { MediaItem } from '../../types/media';
import { attachmentLabelForMedia } from '../../utils/mediaKinds';
import {
  normalizeChatMediaList,
  normalizeDmMediaItems,
  normalizeGroupMediaItems,
  parseChatEnvelope,
  parseDmMediaEnvelope,
  parseEncryptedTextEnvelope,
  parseGroupMediaEnvelope,
} from './parsers';
import type { ChatMessage } from './types';
import type { ChatEnvelope, DmMediaEnvelope, GroupMediaEnvelope } from './types';
import type { ReplyTarget } from './useChatSendActions';

export function useChatReplyActions(opts: {
  isDm: boolean;
  encryptedPlaceholder: string;
  dmThumbUriByPath: Record<string, string>;
  mediaUrlByPath: Record<string, string>;
  closeMessageActions: () => void;
  focusComposer: () => void;
  setReplyTarget: (v: ReplyTarget | null) => void;
  getPreviewKind: (m: MediaItem) => 'image' | 'video' | 'file';
}) {
  const {
    isDm,
    encryptedPlaceholder,
    dmThumbUriByPath,
    mediaUrlByPath,
    closeMessageActions,
    focusComposer,
    setReplyTarget,
    getPreviewKind,
  } = opts;

  const beginReply = React.useCallback(
    (target: ChatMessage) => {
      if (!target) return;
      if (target.deletedAt) return;

      let preview = '';
      let mediaKind: 'image' | 'video' | 'file' | undefined;
      let mediaCount: number | undefined;
      let mediaThumbUri: string | null | undefined;
      let mediaFileName: string | undefined;
      let mediaContentType: string | undefined;

      // Best-effort: attach a tiny thumbnail/count for media replies.
      try {
        if (target.encrypted || target.groupEncrypted) {
          const plain = String(target.decryptedText || '');
          const dmEnv: DmMediaEnvelope | null = target.encrypted
            ? parseDmMediaEnvelope(plain)
            : null;
          const dmItems = dmEnv ? normalizeDmMediaItems(dmEnv) : [];
          const gEnv: GroupMediaEnvelope | null = target.groupEncrypted
            ? parseGroupMediaEnvelope(plain)
            : null;
          const gItems = gEnv ? normalizeGroupMediaItems(gEnv) : [];
          const items = dmItems.length ? dmItems : gItems;
          if (items.length) {
            mediaCount = items.length;
            const first = items[0]?.media;
            const k = first?.kind;
            mediaKind = k === 'video' ? 'video' : k === 'image' ? 'image' : 'file';
            mediaFileName =
              typeof first?.fileName === 'string' ? String(first.fileName) : undefined;
            mediaContentType =
              typeof first?.contentType === 'string' ? String(first.contentType) : undefined;
            const thumbPath = typeof first?.thumbPath === 'string' ? first.thumbPath : '';
            mediaThumbUri =
              thumbPath && dmThumbUriByPath[thumbPath] ? dmThumbUriByPath[thumbPath] : null;
          }
        } else {
          const raw = String(target.rawText ?? target.text ?? '');
          const env: ChatEnvelope | null = !isDm ? parseChatEnvelope(raw) : null;
          const envList = env ? normalizeChatMediaList(env.media) : [];
          if (envList.length) {
            mediaCount = envList.length;
            const first = envList[0];
            mediaKind = getPreviewKind(first);
            mediaFileName = typeof first.fileName === 'string' ? String(first.fileName) : undefined;
            mediaContentType =
              typeof first.contentType === 'string' ? String(first.contentType) : undefined;
            const key = String(first.thumbPath || first.path);
            mediaThumbUri = mediaUrlByPath[key] ? mediaUrlByPath[key] : null;
          }
        }
      } catch {
        // ignore
      }
      // Files (PDF/DOC/etc) can't render in <Image>. Force no thumb so UI uses placeholders.
      if (mediaKind === 'file') mediaThumbUri = null;

      if (target.encrypted || target.groupEncrypted) {
        // For encrypted messages, only allow reply preview if we already decrypted.
        // decryptedText can be a media envelope JSON or a text envelope JSON; extract the human text.
        const plain = String(target.decryptedText || '');
        const encEnv = parseEncryptedTextEnvelope(plain);
        const dmEnv: DmMediaEnvelope | null = target.encrypted ? parseDmMediaEnvelope(plain) : null;
        const gEnv: GroupMediaEnvelope | null = target.groupEncrypted
          ? parseGroupMediaEnvelope(plain)
          : null;
        // If it's a media envelope, NEVER use the raw JSON as preview; prefer caption and
        // otherwise allow our attachment-label fallback below to populate preview.
        if (dmEnv || gEnv) {
          preview = String((dmEnv?.caption ?? gEnv?.caption) || '');
        } else if (encEnv && typeof encEnv.text === 'string') {
          preview = String(encEnv.text || '');
        } else {
          preview = plain || encryptedPlaceholder;
        }
      } else {
        const raw = String(target.rawText ?? target.text ?? '');
        const env: ChatEnvelope | null = !isDm ? parseChatEnvelope(raw) : null;
        preview = env ? String(env.text || '') : raw;
      }
      preview = preview.replace(/\s+/g, ' ').trim();
      if (preview.length > 160) preview = `${preview.slice(0, 160)}…`;
      if (!preview && mediaCount && mediaCount > 0) {
        const base = attachmentLabelForMedia({
          kind: mediaKind ?? 'file',
          contentType: mediaContentType,
          fileName: mediaFileName,
        });
        preview = mediaCount > 1 ? `${base} · ${mediaCount} attachments` : base;
      }

      setReplyTarget({
        id: target.id,
        createdAt: Number(target.createdAt || Date.now()),
        user: target.user,
        userSub: target.userSub,
        preview,
        mediaKind,
        mediaCount,
        mediaThumbUri: typeof mediaThumbUri === 'string' ? mediaThumbUri : null,
        mediaContentType: mediaContentType ? String(mediaContentType) : undefined,
        mediaFileName: mediaFileName ? String(mediaFileName) : undefined,
      });
      closeMessageActions();
      try {
        focusComposer();
      } catch {
        // ignore
      }
    },
    [
      closeMessageActions,
      dmThumbUriByPath,
      encryptedPlaceholder,
      focusComposer,
      getPreviewKind,
      isDm,
      mediaUrlByPath,
      setReplyTarget,
    ],
  );

  return { beginReply };
}
