import * as React from 'react';

import type { ChatMessage } from './types';

export function useChatReplyActions(opts: {
  isDm: boolean;
  encryptedPlaceholder: string;
  dmThumbUriByPath: Record<string, string>;
  mediaUrlByPath: Record<string, string>;
  closeMessageActions: () => void;
  focusComposer: () => void;
  setReplyTarget: (v: any) => void;

  // parsing/normalizing (passed in to avoid deep imports)
  parseDmMediaEnvelope: (raw: string) => any;
  parseGroupMediaEnvelope: (raw: string) => any;
  normalizeDmMediaItems: (env: any) => any[];
  normalizeGroupMediaItems: (env: any) => any[];
  parseChatEnvelope: (raw: string) => any;
  normalizeChatMediaList: (media: any) => any[];
  getPreviewKind: (m: any) => 'image' | 'video' | 'file';
}) {
  const {
    isDm,
    encryptedPlaceholder,
    dmThumbUriByPath,
    mediaUrlByPath,
    closeMessageActions,
    focusComposer,
    setReplyTarget,
    parseDmMediaEnvelope,
    parseGroupMediaEnvelope,
    normalizeDmMediaItems,
    normalizeGroupMediaItems,
    parseChatEnvelope,
    normalizeChatMediaList,
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

      // Best-effort: attach a tiny thumbnail/count for media replies.
      try {
        if (target.encrypted || target.groupEncrypted) {
          const plain = String(target.decryptedText || '');
          const dmEnv = target.encrypted ? parseDmMediaEnvelope(plain) : null;
          const dmItems = dmEnv ? normalizeDmMediaItems(dmEnv) : [];
          const gEnv = target.groupEncrypted ? parseGroupMediaEnvelope(plain) : null;
          const gItems = gEnv ? normalizeGroupMediaItems(gEnv) : [];
          const items = (dmItems.length ? dmItems : gItems) as any[];
          if (items.length) {
            mediaCount = items.length;
            const first = (items[0]?.media ?? items[0]) as any;
            const k = (first?.kind as any) || 'file';
            mediaKind = k === 'video' ? 'video' : k === 'image' ? 'image' : 'file';
            const thumbPath = first?.thumbPath ? String(first.thumbPath) : '';
            mediaThumbUri = thumbPath && dmThumbUriByPath[thumbPath] ? dmThumbUriByPath[thumbPath] : null;
          }
        } else {
          const raw = String(target.rawText ?? target.text ?? '');
          const env = !isDm ? parseChatEnvelope(raw) : null;
          const envList = env ? normalizeChatMediaList(env.media) : [];
          if (envList.length) {
            mediaCount = envList.length;
            const first = envList[0];
            mediaKind = getPreviewKind(first);
            const key = String(first.thumbPath || first.path);
            mediaThumbUri = mediaUrlByPath[key] ? mediaUrlByPath[key] : null;
          }
        }
      } catch {
        // ignore
      }

      if (target.encrypted || target.groupEncrypted) {
        // For encrypted messages, only allow reply preview if we already decrypted.
        preview = String(target.decryptedText || encryptedPlaceholder);
      } else {
        const raw = String(target.rawText ?? target.text ?? '');
        const env = !isDm ? parseChatEnvelope(raw) : null;
        preview = env ? String(env.text || '') : raw;
      }
      preview = preview.replace(/\s+/g, ' ').trim();
      if (preview.length > 160) preview = `${preview.slice(0, 160)}…`;
      if (!preview && mediaCount && mediaCount > 0) {
        const base = mediaKind === 'image' ? 'Photo' : mediaKind === 'video' ? 'Video' : 'Attachment';
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
      normalizeChatMediaList,
      normalizeDmMediaItems,
      normalizeGroupMediaItems,
      parseChatEnvelope,
      parseDmMediaEnvelope,
      parseGroupMediaEnvelope,
      setReplyTarget,
    ],
  );

  return { beginReply };
}

