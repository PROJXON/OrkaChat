import * as React from 'react';

import { type UiPromptApi, useUiPrompt } from '../providers/UiPromptProvider';

export function useUiPromptHelpers(): {
  uiAlert: (title: string, message: string) => Promise<void>;
  uiConfirm: (
    title: string,
    message: string,
    options?: { confirmText?: string; cancelText?: string; destructive?: boolean },
  ) => Promise<boolean>;
  uiChoice3: UiPromptApi['choice3'];
  showAlert: (title: string, message: string) => void;
} {
  const { alert: uiAlert, confirm: uiConfirm, choice3: uiChoice3 } = useUiPrompt();
  const showAlert = React.useCallback(
    (title: string, message: string) => {
      void uiAlert(title, message);
    },
    [uiAlert],
  );

  return { uiAlert, uiConfirm, uiChoice3, showAlert };
}
