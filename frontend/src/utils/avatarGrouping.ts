export function shouldShowThreadAvatar(args: {
  senderKey: string;
  olderSenderKey: string;
  hasOlder: boolean;
}): boolean {
  return !args.hasOlder || args.olderSenderKey !== args.senderKey;
}

// Chat-specific rule: only show avatars on incoming messages.
export function shouldShowIncomingAvatar(args: {
  isOutgoing: boolean;
  senderKey: string;
  olderSenderKey: string;
  hasOlder: boolean;
}): boolean {
  if (args.isOutgoing) return false;
  return shouldShowThreadAvatar(args);
}

export function getAvatarGutterPx(args: { showAvatar: boolean; size: number; gap: number }): number {
  return args.showAvatar ? args.size + args.gap : 0;
}
