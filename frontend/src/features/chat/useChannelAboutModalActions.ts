import * as React from 'react';
import type { RefObject } from 'react';

export function useChannelAboutModalActions(opts: {
  activeConversationId: string;
  channelMeta: any;
  channelAboutEdit: boolean;
  channelAboutDraft: string;
  setChannelAboutDraft: (v: string) => void;
  setChannelAboutEdit: (v: boolean) => void;
  setChannelAboutOpen: (v: boolean) => void;
  channelUpdate: (op: any, args: any) => Promise<any>;
  markChannelAboutSeen: (kind: 'member', channelId: string, version: number) => Promise<void>;
  wsRef: RefObject<WebSocket | null>;
}) {
  const {
    activeConversationId,
    channelMeta,
    channelAboutEdit,
    channelAboutDraft,
    setChannelAboutDraft,
    setChannelAboutEdit,
    setChannelAboutOpen,
    channelUpdate,
    markChannelAboutSeen,
    wsRef,
  } = opts;

  const channelId = React.useMemo(() => String(activeConversationId).slice('ch#'.length).trim(), [activeConversationId]);

  const markSeenCurrentVersion = React.useCallback(async () => {
    try {
      const v = typeof channelMeta?.aboutVersion === 'number' ? channelMeta.aboutVersion : 0;
      await markChannelAboutSeen('member', channelId, v);
    } catch {
      // ignore
    }
  }, [channelId, channelMeta?.aboutVersion, markChannelAboutSeen]);

  const closeViewMode = React.useCallback(async () => {
    // Treat dismiss as "Got it" in view mode (mark seen).
    if (!channelAboutEdit) {
      await markSeenCurrentVersion();
    }
    setChannelAboutEdit(false);
    setChannelAboutOpen(false);
  }, [channelAboutEdit, markSeenCurrentVersion, setChannelAboutEdit, setChannelAboutOpen]);

  const onRequestClose = React.useCallback(() => {
    void closeViewMode();
  }, [closeViewMode]);

  const onBackdropPress = React.useCallback(() => {
    void closeViewMode();
  }, [closeViewMode]);

  const onGotIt = React.useCallback(async () => {
    await markSeenCurrentVersion();
    setChannelAboutEdit(false);
    setChannelAboutOpen(false);
  }, [markSeenCurrentVersion, setChannelAboutEdit, setChannelAboutOpen]);

  const onCancelEdit = React.useCallback(() => {
    setChannelAboutDraft(String(channelMeta?.aboutText || ''));
    setChannelAboutEdit(false);
    setChannelAboutOpen(false);
  }, [channelMeta?.aboutText, setChannelAboutDraft, setChannelAboutEdit, setChannelAboutOpen]);

  const onSave = React.useCallback(async () => {
    const next = String(channelAboutDraft || '').slice(0, 4000);
    const upd: any = await channelUpdate('setAbout', { aboutText: next });
    // Broadcast an "update" hint so others refresh promptly.
    try {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            action: 'system',
            conversationId: activeConversationId,
            systemKind: 'update',
            updateField: 'about',
            createdAt: Date.now(),
          }),
        );
      }
    } catch {
      // ignore
    }
    // Mark the *new* version as seen (use server-returned aboutVersion when available).
    try {
      const v =
        typeof upd?.aboutVersion === 'number' && Number.isFinite(upd.aboutVersion)
          ? upd.aboutVersion
          : typeof channelMeta?.aboutVersion === 'number'
            ? channelMeta.aboutVersion
            : 0;
      await markChannelAboutSeen('member', channelId, v);
    } catch {
      // ignore
    }
    setChannelAboutEdit(false);
  }, [activeConversationId, channelAboutDraft, channelId, channelMeta?.aboutVersion, channelUpdate, markChannelAboutSeen, setChannelAboutEdit, wsRef]);

  return { onRequestClose, onBackdropPress, onSave, onCancelEdit, onGotIt };
}

