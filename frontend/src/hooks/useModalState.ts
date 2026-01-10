import * as React from 'react';

export function useModalState<T>(): {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  state: T | null;
  setState: React.Dispatch<React.SetStateAction<T | null>>;
  close: () => void;
} {
  const [open, setOpen] = React.useState<boolean>(false);
  const [state, setState] = React.useState<T | null>(null);

  const close = React.useCallback(() => {
    setOpen(false);
    setState(null);
  }, []);

  return { open, setOpen, state, setState, close };
}

