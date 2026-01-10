import * as React from 'react';

export function useGuestChannelAboutModalActions(opts: {
  activeChannelId: string;
  aboutVersion: number;
  markChannelAboutSeen: (scope: 'guest', channelId: string, version: number) => Promise<void>;
  setChannelAboutOpen: (v: boolean) => void;
}) {
  const { activeChannelId, aboutVersion, markChannelAboutSeen, setChannelAboutOpen } = opts;

  const markSeen = React.useCallback(async () => {
    try {
      const cid = String(activeChannelId || '').trim();
      const v = typeof aboutVersion === 'number' && Number.isFinite(aboutVersion) ? aboutVersion : 0;
      await markChannelAboutSeen('guest', cid, v);
    } catch {
      // ignore
    }
  }, [aboutVersion, activeChannelId, markChannelAboutSeen]);

  const close = React.useCallback(async () => {
    await markSeen();
    setChannelAboutOpen(false);
  }, [markSeen, setChannelAboutOpen]);

  const onRequestClose = React.useCallback(() => {
    void close();
  }, [close]);

  const onBackdropPress = React.useCallback(() => {
    void close();
  }, [close]);

  const onGotIt = React.useCallback(async () => {
    await close();
  }, [close]);

  return { onRequestClose, onBackdropPress, onGotIt };
}

