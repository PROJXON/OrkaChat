import * as React from 'react';
import { getChannelAboutSeenVersion } from '../utils/channelAboutSeen';

export function useAutoPopupChannelAbout({
  enabled,
  scope,
  channelId,
  aboutText,
  aboutVersion,
  onOpen,
}: {
  enabled: boolean;
  scope: 'member' | 'guest';
  channelId: string;
  aboutText: string;
  aboutVersion: number;
  onOpen: () => void;
}): void {
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!enabled) return;
      const cid = String(channelId || '').trim();
      if (!cid) return;
      const text = typeof aboutText === 'string' ? aboutText : '';
      const ver = typeof aboutVersion === 'number' && Number.isFinite(aboutVersion) ? aboutVersion : 0;
      if (!text.trim()) return;
      if (!ver || ver <= 0) return;

      try {
        const seen = await getChannelAboutSeenVersion(scope, cid);
        if (cancelled) return;
        if (seen < ver) onOpen();
      } catch {
        if (!cancelled) onOpen();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [aboutText, aboutVersion, channelId, enabled, onOpen, scope]);
}

