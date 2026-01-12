import * as React from 'react';
import type { TextInput } from 'react-native';

export function useFocusGroupAddMembersInputOnOpen(opts: {
  enabled: boolean;
  groupMembersOpen: boolean;
  meIsAdmin: boolean;
  inputRef: React.MutableRefObject<TextInput | null>;
  delayMs?: number;
}): void {
  const { enabled, groupMembersOpen, meIsAdmin, inputRef, delayMs = 150 } = opts;

  // Focus the "Add usernames" input when Members modal opens (admin-only).
  React.useEffect(() => {
    if (!enabled) return;
    if (!groupMembersOpen) return;
    if (!meIsAdmin) return;
    const t = setTimeout(() => {
      try {
        inputRef.current?.focus?.();
      } catch {
        // ignore
      }
    }, delayMs);
    return () => clearTimeout(t);
  }, [delayMs, enabled, groupMembersOpen, inputRef, meIsAdmin]);
}

