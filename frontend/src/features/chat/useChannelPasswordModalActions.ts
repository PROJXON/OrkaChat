import * as React from 'react';

export function useChannelPasswordModalActions(opts: {
  channelPasswordDraft: string;
  channelUpdate: (op: any, args: any) => Promise<any> | void;
  setChannelMeta: React.Dispatch<React.SetStateAction<any>>;
  setChannelPasswordEditOpen: (v: boolean) => void;
  setChannelPasswordDraft: (v: string) => void;
  showAlert: (title: string, body: string) => void;
}) {
  const {
    channelPasswordDraft,
    channelUpdate,
    setChannelMeta,
    setChannelPasswordEditOpen,
    setChannelPasswordDraft,
    showAlert,
  } = opts;

  const onSave = React.useCallback(() => {
    const pw = String(channelPasswordDraft || '').trim();
    if (!pw) {
      showAlert('Password required', 'Enter a password.');
      return;
    }
    void channelUpdate('setPassword', { password: pw });
    setChannelMeta((prev: any) => (prev ? { ...prev, hasPassword: true } : prev));
    setChannelPasswordEditOpen(false);
    setChannelPasswordDraft('');
  }, [channelPasswordDraft, channelUpdate, setChannelMeta, setChannelPasswordDraft, setChannelPasswordEditOpen, showAlert]);

  const onCancel = React.useCallback(() => setChannelPasswordEditOpen(false), [setChannelPasswordEditOpen]);

  return { onSave, onCancel };
}

