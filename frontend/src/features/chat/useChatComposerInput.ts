import * as React from 'react';

export function useChatComposerInput(opts: {
  setInput: (v: string) => void;
  inputRef: { current: string };
  isTypingRef: { current: boolean };
  sendTyping: (isTyping: boolean) => void;
}): { onChangeInput: (next: string) => void } {
  const { setInput, inputRef, isTypingRef, sendTyping } = opts;

  const onChangeInput = React.useCallback(
    (next: string) => {
      setInput(next);
      inputRef.current = next;
      const nextHasText = next.trim().length > 0;
      if (nextHasText) sendTyping(true);
      else if (isTypingRef.current) sendTyping(false);
    },
    [isTypingRef, inputRef, sendTyping, setInput],
  );

  return { onChangeInput };
}

