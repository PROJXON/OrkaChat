import React from 'react';
import { Linking } from 'react-native';

import { ConfirmLinkModal } from '../components/ConfirmLinkModal';
import { useConfirmLink } from './useConfirmLink';

export function useConfirmLinkModal(isDark: boolean): {
  requestOpenLink: (url: string) => void;
  requestOpenFile: (args: { url: string; fileName?: string }) => void;
  closeConfirmLink: () => void;
  onLinkConfirmOpened: () => void;
  confirmLinkModal: React.JSX.Element | null;
} {
  const { state, requestOpenLink, requestOpenFile, close, onOpened } = useConfirmLink();

  const confirmLinkModal = state.open ? (
    <ConfirmLinkModal
      open={state.open}
      isDark={isDark}
      url={state.url}
      domain={state.domain}
      title={state.mode === 'file' ? 'Open Attachment?' : 'Open External Link?'}
      fileName={state.mode === 'file' ? state.fileName : undefined}
      // For attachments, hide the raw URL (local decrypted URLs like blob:... aren't meaningful to users).
      hideUrl={state.mode === 'file'}
      onCancel={close}
      onOpen={() => {
        const u = String(state.url || '').trim();
        onOpened();
        if (!u) return;
        // Web: Linking.openURL can be unreliable for blob/data URLs; open directly.
        if (
          typeof window !== 'undefined' &&
          (u.startsWith('blob:') || u.startsWith('data:') || u.startsWith('file:'))
        ) {
          try {
            window.open(u, '_blank', 'noopener,noreferrer');
            return;
          } catch {
            // fall back below
          }
        }
        void Linking.openURL(u).catch(() => {});
      }}
    />
  ) : null;

  return {
    requestOpenLink,
    requestOpenFile,
    closeConfirmLink: close,
    onLinkConfirmOpened: onOpened,
    confirmLinkModal,
  };
}
