import React from 'react';
import { Platform, Text, View } from 'react-native';

import { MediaStackCarousel } from '../../components/MediaStackCarousel';
import type { MediaItem } from '../../types/media';
import { isImageLike as isImageLikeMedia, isVideoLike as isVideoLikeMedia } from '../../utils/mediaKinds';
import { getOlderNeighbor } from '../../utils/listNeighbors';
import { shouldShowIncomingAvatar } from '../../utils/avatarGrouping';
import { getChatSenderKey } from '../../utils/senderKeys';
import type { ChatMessage } from './types';
import { normalizeChatMediaList, parseChatEnvelope } from './parsers';
import { ChatMessageRow } from './components/ChatMessageRow';

type Anchor = { x: number; y: number };

export function renderChatListItem(args: {
  styles: any;
  item: ChatMessage;
  index: number;
  messageListData: ChatMessage[];
  visibleMessages: ChatMessage[];

  isDark: boolean;
  isDm: boolean;
  isGroup: boolean;
  isEncryptedChat: boolean;

  myUserId: string | null | undefined;
  myPublicKey: string | null | undefined;
  displayName: string;
  nameBySub: Record<string, string>;
  avatarProfileBySub: Record<string, any>;
  avatarUrlByPath: Record<string, string>;

  peerSeenAtByCreatedAt: Record<string, number>;
  getSeenLabelFor: (peerSeenAtByCreatedAt: Record<string, number>, createdAt: number) => string | null;
  normalizeUser: (v: unknown) => string;

  nowSec: number;
  formatRemaining: (seconds: number) => string;

  mediaUrlByPath: Record<string, string>;
  dmThumbUriByPath: Record<string, string>;
  imageAspectByPath: Record<string, number>;
  EMPTY_URI_BY_PATH: Record<string, string>;

  AVATAR_GUTTER: number;
  chatViewportWidth: number;
  getCappedMediaSize: (aspect: number | undefined, maxW: number) => { w: number; h: number };

  inlineEditTargetId: string | null;
  inlineEditDraft: string;
  setInlineEditDraft: (v: string) => void;
  inlineEditUploading: boolean;
  inlineEditAttachmentMode: 'keep' | 'remove' | 'replace';
  pendingMedia: any[];
  commitInlineEdit: () => void | Promise<void>;
  cancelInlineEdit: () => void;

  openReactionInfo: (m: ChatMessage, emoji: string, userSubs: string[]) => void | Promise<void>;
  sendReaction: (m: ChatMessage, emoji: string) => void | Promise<void>;

  openViewer: (mediaList: MediaItem[], startIdx: number) => void;
  openDmMediaViewer: (m: ChatMessage, startIdx: number) => void | Promise<void>;
  openGroupMediaViewer: (m: ChatMessage, startIdx: number) => void | Promise<void>;
  requestOpenLink: (url: string) => void;

  onPressMessage: (m: ChatMessage) => void;
  openMessageActions: (m: ChatMessage, anchor: Anchor) => void;
  latestOutgoingMessageId: string | null;
  retryFailedMessage: (m: ChatMessage) => void;
}): React.JSX.Element {
  const {
    styles,
    item,
    index,
    messageListData,
    visibleMessages,
    isDark,
    isDm,
    isGroup,
    isEncryptedChat,
    myUserId,
    myPublicKey,
    displayName,
    nameBySub,
    avatarProfileBySub,
    avatarUrlByPath,
    peerSeenAtByCreatedAt,
    getSeenLabelFor,
    normalizeUser,
    nowSec,
    formatRemaining,
    mediaUrlByPath,
    dmThumbUriByPath,
    imageAspectByPath,
    EMPTY_URI_BY_PATH,
    AVATAR_GUTTER,
    chatViewportWidth,
    getCappedMediaSize,
    inlineEditTargetId,
    inlineEditDraft,
    setInlineEditDraft,
    inlineEditUploading,
    inlineEditAttachmentMode,
    pendingMedia,
    commitInlineEdit,
    cancelInlineEdit,
    openReactionInfo,
    sendReaction,
    openViewer,
    openDmMediaViewer,
    openGroupMediaViewer,
    requestOpenLink,
    onPressMessage,
    openMessageActions,
    latestOutgoingMessageId,
    retryFailedMessage,
  } = args;

  if (item.kind === 'system') {
    return (
      <View style={{ paddingVertical: 10, alignItems: 'center' }}>
        <Text
          style={{
            color: isDark ? '#a7a7b4' : '#666',
            fontStyle: 'italic',
            fontWeight: '500',
            textAlign: 'center',
            paddingHorizontal: 18,
          }}
        >
          {String(item.text || '').trim() || '-'}
        </Text>
      </View>
    );
  }

  const timestamp = new Date(item.createdAt);
  const now = new Date();
  const isToday =
    timestamp.getFullYear() === now.getFullYear() &&
    timestamp.getMonth() === now.getMonth() &&
    timestamp.getDate() === now.getDate();
  const time = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatted = isToday ? time : `${timestamp.toLocaleDateString()} · ${time}`;
  const expiresIn = isDm && typeof item.expiresAt === 'number' ? item.expiresAt - nowSec : null;

  const isOutgoingByUserSub = !!myUserId && !!item.userSub && String(item.userSub) === String(myUserId);
  const isEncryptedOutgoing = !!item.encrypted && !!myPublicKey && item.encrypted.senderPublicKey === myPublicKey;
  const isPlainOutgoing =
    !item.encrypted &&
    (isOutgoingByUserSub ? true : normalizeUser(item.userLower ?? item.user ?? 'anon') === normalizeUser(displayName));
  const isOutgoing = isOutgoingByUserSub || isEncryptedOutgoing || isPlainOutgoing;

  const outgoingSeenLabel = isDm ? getSeenLabelFor(peerSeenAtByCreatedAt, item.createdAt) : null;
  // Keep receipts lightweight: show "seen" only on outgoing messages.
  // Incoming "you saw this" is redundant and adds clutter.
  const seenLabel = isOutgoing ? outgoingSeenLabel : null;

  const envelope =
    !item.encrypted && !item.groupEncrypted && !isDm ? parseChatEnvelope(item.rawText ?? item.text) : null;
  const envMediaList = envelope ? normalizeChatMediaList(envelope.media) : [];
  // Only treat it as a "media envelope" if it actually has media.
  // (Otherwise a random JSON message could parse as an envelope and we'd hide the text.)
  const mediaEnvelope = envelope && envMediaList.length ? envelope : null;
  // If it's a media envelope, the caption is ONLY env.text (optional).
  // Do NOT fall back to item.text, because for envelopes item.text often contains the full JSON.
  const captionText = mediaEnvelope ? String(mediaEnvelope.text ?? '') : item.text;
  const captionHasText = !!captionText && String(captionText).trim().length > 0;
  const isDeleted = typeof item.deletedAt === 'number' && Number.isFinite(item.deletedAt);
  const displayText = isDeleted ? 'This message has been deleted' : captionText;
  const isEdited = !isDeleted && typeof item.editedAt === 'number' && Number.isFinite(item.editedAt);

  const reactionEntries = item.reactions
    ? Object.entries(item.reactions)
        .map(([emoji, info]) => ({ emoji, count: info?.count ?? 0, userSubs: info?.userSubs ?? [] }))
        .filter((r) => r.emoji && r.count > 0)
        .sort((a, b) => b.count - a.count)
    : [];

  const mediaList: MediaItem[] = mediaEnvelope
    ? envMediaList
    : item.mediaList
      ? item.mediaList
      : item.media
        ? [item.media]
        : [];
  const media = mediaList.length ? mediaList[0] : null;
  const mediaLooksImage = !!media && isImageLikeMedia(media);
  const mediaLooksVideo = !!media && isVideoLikeMedia(media);
  // IMPORTANT: if the message is still encrypted (not decrypted yet),
  // always render it as a normal encrypted-text bubble so media placeholders
  // don't appear larger than encrypted text placeholders.
  const isStillEncrypted = (!!item.encrypted || !!item.groupEncrypted) && !item.decryptedText;
  const hasMedia = !!mediaList.length && !isStillEncrypted;
  const thumbKeyPath = mediaLooksImage || mediaLooksVideo ? media?.thumbPath || media?.path : undefined;
  const thumbAspect = thumbKeyPath && imageAspectByPath[thumbKeyPath] ? imageAspectByPath[thumbKeyPath] : undefined;

  const senderKey = getChatSenderKey(item, normalizeUser);
  // IMPORTANT: `index` is relative to the FlatList `data` prop.
  // On web we reverse the data (oldest-first), so the "older neighbor" is `index - 1`.
  // On native we keep newest-first (inverted list), so the "older neighbor" is `index + 1`.
  const olderNeighbor = getOlderNeighbor(messageListData, index);
  const olderSenderKey = olderNeighbor ? getChatSenderKey(olderNeighbor, normalizeUser) : '';
  const showAvatarForIncoming = shouldShowIncomingAvatar({
    isOutgoing,
    senderKey,
    olderSenderKey,
    hasOlder: !!olderNeighbor,
  });

  const prof = item.userSub ? avatarProfileBySub[String(item.userSub)] : undefined;
  const avatarImageUri = prof?.avatarImagePath ? avatarUrlByPath[String(prof.avatarImagePath)] : undefined;

  const rowGutter = !isOutgoing && showAvatarForIncoming ? AVATAR_GUTTER : 0;
  const capped = getCappedMediaSize(thumbAspect, isOutgoing ? chatViewportWidth : chatViewportWidth - rowGutter);
  const hideMetaUntilDecrypted = isStillEncrypted;
  const canReact = !isDeleted && !isStillEncrypted;
  const reactionEntriesVisible = canReact ? reactionEntries : [];
  const metaPrefix = hideMetaUntilDecrypted || isOutgoing ? '' : `${item.user ?? 'anon'} · `;
  const metaLine = hideMetaUntilDecrypted
    ? ''
    : `${metaPrefix}${formatted}${expiresIn != null ? ` · disappears in ${formatRemaining(expiresIn)}` : ''}`;

  const renderMediaCarousel =
    mediaList.length && hasMedia && !isDeleted ? (
      <MediaStackCarousel
        messageId={item.id}
        mediaList={mediaList}
        width={capped.w}
        height={capped.h}
        isDark={isDark}
        loop
        uriByPath={isEncryptedChat ? EMPTY_URI_BY_PATH : mediaUrlByPath}
        thumbUriByPath={isEncryptedChat ? dmThumbUriByPath : undefined}
        loadingTextColor={isOutgoing ? 'rgba(255,255,255,0.9)' : isDark ? '#b7b7c2' : '#555'}
        loadingDotsColor={isOutgoing ? 'rgba(255,255,255,0.9)' : isDark ? '#b7b7c2' : '#555'}
        onOpen={(idx) => {
          if (isDm) void openDmMediaViewer(item, idx);
          else if (isGroup) void openGroupMediaViewer(item, idx);
          else openViewer(mediaList, idx);
        }}
      />
    ) : null;

  return (
    <ChatMessageRow
      styles={styles}
      item={item}
      index={index}
      messageListData={messageListData}
      visibleMessages={visibleMessages}
      isDark={isDark}
      isDm={isDm}
      isGroup={isGroup}
      isEncryptedChat={isEncryptedChat}
      myUserId={myUserId || null}
      avatarProfileBySub={avatarProfileBySub}
      nameBySub={nameBySub}
      avatarUrlByPath={avatarUrlByPath}
      senderKey={senderKey}
      isOutgoing={isOutgoing}
      showAvatarForIncoming={showAvatarForIncoming}
      avatarImageUri={avatarImageUri}
      metaLine={metaLine}
      formatted={formatted}
      nowSec={nowSec}
      expiresIn={expiresIn}
      seenLabel={seenLabel}
      captionText={captionText}
      captionHasText={captionHasText}
      isDeleted={isDeleted}
      displayText={displayText}
      isEdited={isEdited}
      isStillEncrypted={isStillEncrypted}
      inlineEditTargetId={inlineEditTargetId}
      inlineEditDraft={inlineEditDraft}
      setInlineEditDraft={setInlineEditDraft}
      inlineEditUploading={inlineEditUploading}
      inlineEditAttachmentMode={inlineEditAttachmentMode}
      pendingMedia={pendingMedia}
      commitInlineEdit={commitInlineEdit}
      cancelInlineEdit={cancelInlineEdit}
      canReact={canReact}
      reactionEntriesVisible={reactionEntriesVisible}
      openReactionInfo={openReactionInfo}
      sendReaction={sendReaction}
      hasMedia={hasMedia}
      mediaList={mediaList}
      mediaUrlByPath={mediaUrlByPath}
      dmThumbUriByPath={dmThumbUriByPath}
      capped={capped}
      openViewer={openViewer}
      openDmMediaViewer={openDmMediaViewer}
      openGroupMediaViewer={openGroupMediaViewer}
      requestOpenLink={requestOpenLink}
      onPressMessage={onPressMessage}
      onLongPressMessage={(e: unknown) => {
        if (!e || typeof e !== 'object') {
          openMessageActions(item, { x: 0, y: 0 });
          return;
        }
        const ne = (e as Record<string, unknown>).nativeEvent;
        const neRec = ne && typeof ne === 'object' ? (ne as Record<string, unknown>) : {};
        const xRaw = Platform.OS === 'web' ? (neRec.clientX ?? neRec.pageX ?? 0) : (neRec.pageX ?? 0);
        const yRaw = Platform.OS === 'web' ? (neRec.clientY ?? neRec.pageY ?? 0) : (neRec.pageY ?? 0);
        const x = Number(xRaw) || 0;
        const y = Number(yRaw) || 0;
        openMessageActions(item, { x, y });
      }}
      latestOutgoingMessageId={latestOutgoingMessageId}
      retryFailedMessage={retryFailedMessage}
      renderMediaCarousel={renderMediaCarousel}
    />
  );
}
