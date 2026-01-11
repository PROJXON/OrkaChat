import * as React from 'react';

export function usePushGroupTitleToParent(opts: {
  enabled: boolean;
  activeConversationId: string;
  groupName: string | null | undefined;
  computeDefaultTitle: () => string;
  onConversationTitleChanged?: (conversationId: string, title: string) => void;
}): void {
  const { enabled, activeConversationId, groupName, computeDefaultTitle, onConversationTitleChanged } = opts;

  // Keep parent Chats list/unreads in sync whenever the effective group title changes
  // (e.g. another admin renamed the group and we refreshed group meta).
  const lastPushedTitleRef = React.useRef<string>('');

  React.useEffect(() => {
    if (!enabled) return;
    const effective =
      groupName && String(groupName).trim() ? String(groupName).trim() : String(computeDefaultTitle() || '').trim();
    if (!effective) return;
    if (effective === lastPushedTitleRef.current) return;
    lastPushedTitleRef.current = effective;
    try {
      onConversationTitleChanged?.(activeConversationId, effective);
    } catch {
      // ignore
    }
  }, [enabled, activeConversationId, groupName, computeDefaultTitle, onConversationTitleChanged]);
}

