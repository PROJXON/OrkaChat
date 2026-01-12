import * as React from 'react';

export function useGuestRequestSignIn(args: {
  onSignIn: () => void;
  setMenuOpen: (v: boolean) => void;
  setChannelPickerOpen: (v: boolean) => void;
  setReactionInfoOpen: (v: boolean) => void;
  closeViewer: () => void;
  closeConfirmLink: () => void;
}) {
  const {
    onSignIn,
    setMenuOpen,
    setChannelPickerOpen,
    setReactionInfoOpen,
    closeViewer,
    closeConfirmLink,
  } = args;

  return React.useCallback(() => {
    // Avoid stacked modals on Android (can get into a state where a transparent modal blocks touches).
    setMenuOpen(false);
    setChannelPickerOpen(false);
    setReactionInfoOpen(false);
    closeViewer();
    closeConfirmLink();
    // Defer so modal close animations/state flush first.
    setTimeout(() => {
      try {
        onSignIn();
      } catch {
        // ignore
      }
    }, 0);
  }, [
    closeConfirmLink,
    closeViewer,
    onSignIn,
    setChannelPickerOpen,
    setMenuOpen,
    setReactionInfoOpen,
  ]);
}
