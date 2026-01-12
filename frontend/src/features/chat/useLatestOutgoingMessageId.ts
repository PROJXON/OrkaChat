import * as React from 'react';

import type { ChatMessage } from './types';

/**
 * Signal-style: show a tiny send-status indicator only on the most recent outgoing message.
 * Outgoing detection prefers stable identity (userSub / senderPublicKey) over username.
 */
export function useLatestOutgoingMessageId(opts: {
  messages: ChatMessage[];
  myUserId: string | null | undefined;
  myPublicKey: string | null | undefined;
  displayName: string;
  normalizeUser: (v: unknown) => string;
}): string | null {
  const { messages, myUserId, myPublicKey, displayName, normalizeUser } = opts;

  return React.useMemo(() => {
    const myLower = normalizeUser(displayName);
    for (const m of messages) {
      // IMPORTANT:
      // Use author identity (userSub) to determine outgoing vs incoming whenever possible.
      // Recovery resets rotate our keypair; old encrypted messages should still be "outgoing"
      // if they were sent by this account, even if we can no longer decrypt them.
      const isOutgoingByUserSub =
        !!myUserId && !!m.userSub && String(m.userSub) === String(myUserId);
      const isEncryptedOutgoing =
        !!m.encrypted && !!myPublicKey && m.encrypted.senderPublicKey === myPublicKey;
      const isPlainOutgoing =
        !m.encrypted &&
        (isOutgoingByUserSub ? true : normalizeUser(m.userLower ?? m.user ?? 'anon') === myLower);
      if (isOutgoingByUserSub || isEncryptedOutgoing || isPlainOutgoing) return m.id;
    }
    return null;
  }, [messages, myPublicKey, myUserId, displayName, normalizeUser]);
}
