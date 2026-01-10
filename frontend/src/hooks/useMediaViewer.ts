import * as React from 'react';

import { useModalState } from './useModalState';
import { saveMediaUrlToDevice } from '../utils/saveMediaToDevice';

export type MediaViewerSaveItem = {
  url: string;
  kind: 'image' | 'video' | 'file';
  fileName?: string;
};

export function useMediaViewer<TState>(opts: {
  getSaveItem: (state: TState | null) => MediaViewerSaveItem | null;
  onPermissionDenied?: () => void;
  onSuccess?: () => void;
  onError?: (msg: string) => void;
}) {
  const modal = useModalState<TState>();
  const { getSaveItem, onError, onPermissionDenied, onSuccess } = opts;

  const [saving, setSaving] = React.useState<boolean>(false);

  const saveToDevice = React.useCallback(async () => {
    if (saving) return;
    const item = getSaveItem(modal.state);
    if (!item?.url) return;
    setSaving(true);
    try {
      await saveMediaUrlToDevice({
        url: item.url,
        kind: item.kind,
        fileName: item.fileName,
        onPermissionDenied,
        onSuccess,
        onError,
      });
    } finally {
      setSaving(false);
    }
  }, [saving, getSaveItem, modal.state, onPermissionDenied, onSuccess, onError]);

  return {
    open: modal.open,
    setOpen: modal.setOpen,
    state: modal.state,
    setState: modal.setState,
    close: modal.close,
    saving,
    saveToDevice,
  };
}

