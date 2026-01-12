import * as React from 'react';
import type { ChannelMeta } from './useChannelRoster';

type ToastKind = 'success' | 'error';
type ChannelUpdateFn = (op: string, args: Record<string, unknown>) => Promise<unknown> | void;

export function useChannelSettingsPanelActions(opts: {
  channelMeta: ChannelMeta | null;
  setChannelMeta: React.Dispatch<React.SetStateAction<ChannelMeta | null>>;
  setChannelActionBusy: (v: boolean) => void;
  channelUpdate: ChannelUpdateFn;
  showToast: (msg: string, kind?: ToastKind) => void;
  uiAlert: (title: string, body: string) => Promise<void> | void;
  setChannelPasswordDraft: (v: string) => void;
  setChannelPasswordEditOpen: (v: boolean) => void;
}) {
  const {
    channelMeta,
    setChannelMeta,
    setChannelActionBusy,
    channelUpdate,
    showToast,
    uiAlert,
    setChannelPasswordDraft,
    setChannelPasswordEditOpen,
  } = opts;

  const onTogglePublic = React.useCallback(
    (v: boolean) => {
      (async () => {
        if (!channelMeta) return;
        const next = !!v;
        const prev = !!channelMeta.isPublic;
        if (next === prev) return;

        setChannelActionBusy(true);
        try {
          setChannelMeta((p) => (p ? { ...p, isPublic: next } : p));
          await channelUpdate('setPublic', { isPublic: next });
          showToast(next ? 'Channel is now public' : 'Channel is now private', 'success');
          // Theme-appropriate FYI modal (not a gate).
          void uiAlert(
            next ? 'Channel is public' : 'Channel is Private',
            next
              ? 'This channel is now discoverable in search, and people can join publicly'
              : 'This channel is no longer discoverable in search, and people cannot join it',
          );
        } finally {
          setChannelActionBusy(false);
        }
      })().catch(() => {});
    },
    [channelMeta, channelUpdate, setChannelActionBusy, setChannelMeta, showToast, uiAlert],
  );

  const onPressPassword = React.useCallback(() => {
    if (channelMeta?.hasPassword) {
      void channelUpdate('clearPassword', {});
      setChannelMeta((prev) => (prev ? { ...prev, hasPassword: false } : prev));
      showToast('Password cleared', 'success');
      return;
    }
    setChannelPasswordDraft('');
    setChannelPasswordEditOpen(true);
  }, [channelMeta?.hasPassword, channelUpdate, setChannelMeta, setChannelPasswordDraft, setChannelPasswordEditOpen, showToast]);

  return { onTogglePublic, onPressPassword };
}

