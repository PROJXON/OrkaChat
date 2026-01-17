import * as React from 'react';

export function useAiDmConsentGate(opts: { isDm: boolean; isGroup?: boolean }) {
  const { isDm, isGroup } = opts;
  const isEncryptedChat = !!isDm || !!isGroup;

  const [open, setOpen] = React.useState<boolean>(false);
  const [action, setAction] = React.useState<null | 'summary' | 'helper'>(null);
  const [dmAiConsentGranted, setDmAiConsentGranted] = React.useState<boolean>(false);

  const request = React.useCallback(
    (next: 'summary' | 'helper', run: (action: 'summary' | 'helper') => void) => {
      const needsConsent = isEncryptedChat && !dmAiConsentGranted;
      if (needsConsent) {
        setAction(next);
        setOpen(true);
        return;
      }
      run(next);
    },
    [dmAiConsentGranted, isEncryptedChat],
  );

  const onProceed = React.useCallback(
    (run: (action: 'summary' | 'helper') => void) => {
      const a = action;
      setOpen(false);
      setAction(null);
      setDmAiConsentGranted(true);
      if (!a) return;
      run(a);
    },
    [action],
  );

  const onCancel = React.useCallback(() => {
    setOpen(false);
    setAction(null);
  }, []);

  return {
    dmAiConsentGranted,
    open,
    action,
    request,
    onProceed,
    onCancel,
  };
}
