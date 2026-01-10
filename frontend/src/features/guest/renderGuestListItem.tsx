import React from 'react';

import { getAvatarGutterPx, shouldShowThreadAvatar } from '../../utils/avatarGrouping';
import { getOlderNeighbor } from '../../utils/listNeighbors';
import { getGuestSenderKey } from '../../utils/senderKeys';
import { GuestMessageRow } from './components/GuestMessageRow';
import type { GuestMessage } from './types';

export function renderGuestListItem(args: {
  item: GuestMessage;
  index: number;
  messageListData: GuestMessage[];
  isDark: boolean;
  viewportWidth: number;
  avatarProfileBySub: Record<string, any>;
  cdnGet: (path: string) => string;
  requestOpenLink: (url: string) => void;
  resolvePathUrl: (path: string) => Promise<string | null>;
  openReactionInfo: (emoji: string, subs: string[], namesBySub?: Record<string, string>) => void;
  openViewer: (mediaList: any[], startIdx: number) => void;
}): React.JSX.Element {
  const {
    item,
    index,
    messageListData,
    isDark,
    viewportWidth,
    avatarProfileBySub,
    cdnGet,
    requestOpenLink,
    resolvePathUrl,
    openReactionInfo,
    openViewer,
  } = args;

  const AVATAR_SIZE = 44;
  const AVATAR_GAP = 8;

  const senderKey = getGuestSenderKey(item);
  const olderNeighbor = getOlderNeighbor(messageListData, index);
  const olderSenderKey = getGuestSenderKey(olderNeighbor);
  const showAvatar = shouldShowThreadAvatar({
    senderKey,
    olderSenderKey,
    hasOlder: !!olderNeighbor,
  });
  const avatarGutter = getAvatarGutterPx({ showAvatar, size: AVATAR_SIZE, gap: AVATAR_GAP });

  const prof = item.userSub ? avatarProfileBySub[String(item.userSub)] : undefined;
  const avatarImageUri = prof?.avatarImagePath ? cdnGet(String(prof.avatarImagePath)) : undefined;

  return (
    <GuestMessageRow
      item={item}
      isDark={isDark}
      onOpenUrl={requestOpenLink}
      resolvePathUrl={resolvePathUrl}
      onOpenReactionInfo={openReactionInfo}
      onOpenViewer={openViewer as any}
      avatarSize={AVATAR_SIZE}
      avatarGutter={avatarGutter}
      avatarSeed={senderKey}
      avatarImageUri={avatarImageUri}
      avatarBgColor={prof?.avatarBgColor ?? item.avatarBgColor}
      avatarTextColor={prof?.avatarTextColor ?? item.avatarTextColor}
      showAvatar={showAvatar}
      viewportWidth={viewportWidth}
    />
  );
}
