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
      hideUrl={state.mode === 'file'}
      onCancel={close}
      onOpen={() => {
        const u = String(state.url || '').trim();
        onOpened();
        if (!u) return;
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
