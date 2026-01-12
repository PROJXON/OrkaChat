import * as React from 'react';

import { useUiPrompt } from '../providers/UiPromptProvider';

export function useUiPromptHelpers(): {
  uiAlert: (title: string, message: string) => Promise<void>;
  uiConfirm: (
    title: string,
    message: string,
    options?: { confirmText?: string; cancelText?: string; destructive?: boolean },
  ) => Promise<boolean>;
  showAlert: (title: string, message: string) => void;
} {
  const { alert: uiAlert, confirm: uiConfirm } = useUiPrompt();
  const showAlert = React.useCallback(
    (title: string, message: string) => {
      void uiAlert(title, message);
    },
    [uiAlert],
  );

  return { uiAlert, uiConfirm, showAlert };
}
