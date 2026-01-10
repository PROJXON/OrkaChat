import * as React from 'react';
import type { PendingMediaItem } from './attachments';

export function useChatAttachments(args: {
  inlineEditAttachmentMode: 'keep' | 'replace' | 'remove';
  maxAttachmentsPerMessage: number;
  showAlert: (title: string, message: string) => void;
}): {
  pendingMedia: PendingMediaItem[];
  pendingMediaRef: React.MutableRefObject<PendingMediaItem[]>;
  setPendingMediaItems: (items: PendingMediaItem[] | null | undefined) => void;
  clearPendingMedia: () => void;
  addPickedMediaItems: (items: PendingMediaItem[] | null | undefined) => void;
  mergeRecoveredPickerItems: (items: PendingMediaItem[] | null | undefined) => void;
} {
  const { inlineEditAttachmentMode, maxAttachmentsPerMessage, showAlert } = args;

  const [pendingMedia, setPendingMedia] = React.useState<PendingMediaItem[]>([]);
  const pendingMediaRef = React.useRef<PendingMediaItem[]>([]);

  React.useEffect(() => {
    pendingMediaRef.current = pendingMedia;
  }, [pendingMedia]);

  const setPendingMediaItems = React.useCallback((items: PendingMediaItem[] | null | undefined) => {
    const next = Array.isArray(items) ? items : [];
    setPendingMedia(next);
    pendingMediaRef.current = next;
  }, []);

  const clearPendingMedia = React.useCallback(() => {
    setPendingMediaItems([]);
  }, [setPendingMediaItems]);

  const addPickedMediaItems = React.useCallback(
    (items: PendingMediaItem[] | null | undefined) => {
      const incoming = Array.isArray(items) ? items : [];
      if (!incoming.length) return;

      setPendingMedia((prev) => {
        const max = Math.max(0, Math.floor(maxAttachmentsPerMessage || 0));
        const isReplace = inlineEditAttachmentMode === 'replace';

        if (isReplace) {
          const capped = incoming.slice(0, max);
          pendingMediaRef.current = capped;
          if (incoming.length > capped.length) {
            showAlert('Attachment limit', `Only ${maxAttachmentsPerMessage} items allowed per message.`);
          }
          return capped;
        }

        const base = prev;
        const remaining = Math.max(0, max - base.length);
        if (remaining <= 0) {
          showAlert('Attachment limit', `You can attach up to ${maxAttachmentsPerMessage} items per message.`);
          pendingMediaRef.current = base;
          return base;
        }

        const toAdd = incoming.slice(0, remaining);
        if (incoming.length > remaining) {
          showAlert(
            'Attachment limit',
            `Only the first ${remaining} item${remaining === 1 ? '' : 's'} were added (limit ${maxAttachmentsPerMessage})`,
          );
        }
        const next = [...base, ...toAdd];
        pendingMediaRef.current = next;
        return next;
      });
    },
    [inlineEditAttachmentMode, maxAttachmentsPerMessage, showAlert],
  );

  const mergeRecoveredPickerItems = React.useCallback(
    (items: PendingMediaItem[] | null | undefined) => {
      const incoming = Array.isArray(items) ? items : [];
      if (!incoming.length) return;
      setPendingMedia((prev) => {
        const next = inlineEditAttachmentMode === 'replace' ? incoming : [...prev, ...incoming];
        pendingMediaRef.current = next;
        return next;
      });
    },
    [inlineEditAttachmentMode],
  );

  return {
    pendingMedia,
    pendingMediaRef,
    setPendingMediaItems,
    clearPendingMedia,
    addPickedMediaItems,
    mergeRecoveredPickerItems,
  };
}
