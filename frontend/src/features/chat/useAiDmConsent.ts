import * as React from 'react';

export function useAiDmConsentGate(opts: { isDm: boolean }) {
  const { isDm } = opts;

  const [open, setOpen] = React.useState<boolean>(false);
  const [action, setAction] = React.useState<null | 'summary' | 'helper'>(null);
  const [dmAiConsentGranted, setDmAiConsentGranted] = React.useState<boolean>(false);

  const request = React.useCallback(
    (next: 'summary' | 'helper', run: (action: 'summary' | 'helper') => void) => {
      const needsConsent = isDm && !dmAiConsentGranted;
      if (needsConsent) {
        setAction(next);
        setOpen(true);
        return;
      }
      run(next);
    },
    [dmAiConsentGranted, isDm],
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

