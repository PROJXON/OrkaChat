import React from 'react';
import { Platform, Text, View } from 'react-native';

import { AttachmentTilesList } from '../../components/media/AttachmentTilesList';
import { MediaStackCarousel } from '../../components/MediaStackCarousel';
import type { PublicAvatarProfileLite } from '../../hooks/usePublicAvatarProfiles';
import type { ChatScreenStyles } from '../../screens/ChatScreen.styles';
import { APP_COLORS, PALETTE, withAlpha } from '../../theme/colors';
import type { MediaItem } from '../../types/media';
import { shouldShowIncomingAvatar } from '../../utils/avatarGrouping';
import { formatMessageMetaTimestamp } from '../../utils/chatDates';
import { getOlderNeighbor } from '../../utils/listNeighbors';
import {
  isImageLike as isImageLikeMedia,
  isPreviewableMedia,
  isVideoLike as isVideoLikeMedia,
} from '../../utils/mediaKinds';
import { getChatSenderKey } from '../../utils/senderKeys';
import type { PendingMediaItem } from './attachments';
import { ChatMessageRow } from './components/ChatMessageRow';
import {
  normalizeChatMediaList,
  normalizeDmMediaItems,
  normalizeGroupMediaItems,
  parseChatEnvelope,
  parseDmMediaEnvelope,
  parseGroupMediaEnvelope,
} from './parsers';
import type { ChatMessage, DmMediaEnvelopeV1 } from './types';
import type { ChatAudioPlayback } from './useChatAudioPlayback';

type Anchor = { x: number; y: number };

function toastErr(showToast: (m: string, kind?: 'success' | 'error') => void, msg: string) {
  const m = String(msg || '').trim();
  showToast(m.length > 120 ? `${m.slice(0, 120)}…` : m, 'error');
}

export function renderChatListItem(args: {
  styles: ChatScreenStyles;
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
  avatarProfileBySub: Record<string, PublicAvatarProfileLite>;
  avatarUrlByPath: Record<string, string>;

  peerSeenAtByCreatedAt: Record<string, number>;
  getSeenLabelFor: (
    peerSeenAtByCreatedAt: Record<string, number>,
    createdAt: number,
  ) => string | null;
  normalizeUser: (v: unknown) => string;

  nowSec: number;
  formatRemaining: (seconds: number) => string;
  showToast: (message: string, kind?: 'success' | 'error') => void;

  mediaUrlByPath: Record<string, string>;
  dmThumbUriByPath: Record<string, string>;
  imageAspectByPath: Record<string, number>;
  setImageAspectByPath: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  EMPTY_URI_BY_PATH: Record<string, string>;

  AVATAR_GUTTER: number;
  chatViewportWidth: number;
  getCappedMediaSize: (aspect: number | undefined, maxW: number) => { w: number; h: number };

  inlineEditTargetId: string | null;
  inlineEditDraft: string;
  setInlineEditDraft: (v: string) => void;
  inlineEditUploading: boolean;
  inlineEditAttachmentMode: 'keep' | 'remove' | 'replace';
  pendingMedia: PendingMediaItem[];
  commitInlineEdit: () => void | Promise<void>;
  cancelInlineEdit: () => void;

  openReactionInfo: (m: ChatMessage, emoji: string, userSubs: string[]) => void | Promise<void>;
  sendReaction: (m: ChatMessage, emoji: string) => void | Promise<void>;

  openViewer: (mediaList: MediaItem[], startIdx: number) => void;
  openDmMediaViewer: (m: ChatMessage, startIdx: number) => void | Promise<void>;
  openGroupMediaViewer: (m: ChatMessage, startIdx: number) => void | Promise<void>;
  requestOpenLink: (url: string) => void;

  // Encrypted attachments: resolve decrypted file URIs for download/export.
  decryptDmFileToCacheUri: (
    msg: ChatMessage,
    it: { media: DmMediaEnvelopeV1['media']; wrap: DmMediaEnvelopeV1['wrap'] },
  ) => Promise<string>;
  decryptGroupFileToCacheUri: (
    msg: ChatMessage,
    it: { media: DmMediaEnvelopeV1['media']; wrap: DmMediaEnvelopeV1['wrap'] },
  ) => Promise<string>;

  audioPlayback?: ChatAudioPlayback & {
    getAudioKey: (msg: ChatMessage, idx: number, media: MediaItem) => string;
    getAudioTitle: (media: MediaItem) => string;
    onPressAudio: (args: {
      msg: ChatMessage;
      idx: number;
      key: string;
      media: MediaItem;
    }) => void | Promise<void>;
  };

  onPressMessage: (m: ChatMessage) => void;
  openMessageActions: (m: ChatMessage, anchor: Anchor) => void;
  latestOutgoingMessageId: string | null;
  retryFailedMessage: (m: ChatMessage) => void;

  // Multi-select mode
  selectionActive: boolean;
  selectedIdSet: Set<string>;
  toggleSelectedMessageId: (id: string) => void;
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
    showToast,
    mediaUrlByPath,
    dmThumbUriByPath,
    imageAspectByPath,
    setImageAspectByPath,
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
    audioPlayback,
    onPressMessage,
    openMessageActions,
    latestOutgoingMessageId,
    retryFailedMessage,
    selectionActive,
    selectedIdSet,
    toggleSelectedMessageId,
  } = args;

  if (item.kind === 'system') {
    return (
      <View style={{ paddingVertical: 10, alignItems: 'center' }}>
        <Text
          style={{
            color: isDark ? APP_COLORS.dark.text.muted : APP_COLORS.light.text.muted,
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

  const formatted = formatMessageMetaTimestamp(item.createdAt);
  const expiresIn = isDm && typeof item.expiresAt === 'number' ? item.expiresAt - nowSec : null;

  const isOutgoingByUserSub =
    !!myUserId && !!item.userSub && String(item.userSub) === String(myUserId);
  const isEncryptedOutgoing =
    !!item.encrypted && !!myPublicKey && item.encrypted.senderPublicKey === myPublicKey;
  const isPlainOutgoing =
    !item.encrypted &&
    (isOutgoingByUserSub
      ? true
      : normalizeUser(item.userLower ?? item.user ?? 'anon') === normalizeUser(displayName));
  const isOutgoing = isOutgoingByUserSub || isEncryptedOutgoing || isPlainOutgoing;

  const outgoingSeenLabel = isDm ? getSeenLabelFor(peerSeenAtByCreatedAt, item.createdAt) : null;
  // Keep receipts lightweight: show "seen" only on outgoing messages.
  // Incoming "you saw this" is redundant and adds clutter.
  const seenLabel = isOutgoing ? outgoingSeenLabel : null;

  const envelope =
    !item.encrypted && !item.groupEncrypted && !isDm
      ? parseChatEnvelope(item.rawText ?? item.text)
      : null;
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
  const isEdited =
    !isDeleted && typeof item.editedAt === 'number' && Number.isFinite(item.editedAt);
  // IMPORTANT: if the message is still encrypted (not decrypted yet),
  // always render it as a normal encrypted-text bubble so media placeholders
  // don't appear larger than encrypted text placeholders.
  const isStillEncrypted = (!!item.encrypted || !!item.groupEncrypted) && !item.decryptedText;

  const reactionEntries = item.reactions
    ? Object.entries(item.reactions)
        .map(([emoji, info]) => ({
          emoji,
          count: info?.count ?? 0,
          userSubs: info?.userSubs ?? [],
        }))
        .filter((r) => r.emoji && r.count > 0)
        .sort((a, b) => b.count - a.count)
    : [];

  const decryptedMediaList: MediaItem[] = (() => {
    if (!item.decryptedText) return [];
    if (isDm) {
      const env = parseDmMediaEnvelope(String(item.decryptedText || ''));
      const items = normalizeDmMediaItems(env);
      if (!items.length) return [];
      return items.map(({ media }) => ({
        path: String(media.path || ''),
        thumbPath: typeof media.thumbPath === 'string' ? String(media.thumbPath) : undefined,
        kind: media.kind === 'video' ? 'video' : media.kind === 'image' ? 'image' : 'file',
        contentType: typeof media.contentType === 'string' ? String(media.contentType) : undefined,
        thumbContentType:
          typeof media.thumbContentType === 'string' ? String(media.thumbContentType) : undefined,
        fileName: typeof media.fileName === 'string' ? String(media.fileName) : undefined,
        size:
          typeof media.size === 'number' && Number.isFinite(media.size) ? media.size : undefined,
        durationMs:
          typeof media.durationMs === 'number' && Number.isFinite(media.durationMs)
            ? Math.max(0, Math.floor(media.durationMs))
            : undefined,
      }));
    }
    if (isGroup) {
      const env = parseGroupMediaEnvelope(String(item.decryptedText || ''));
      const items = normalizeGroupMediaItems(env);
      if (!items.length) return [];
      return items.map(({ media }) => ({
        path: String(media.path || ''),
        thumbPath: typeof media.thumbPath === 'string' ? String(media.thumbPath) : undefined,
        kind: media.kind === 'video' ? 'video' : media.kind === 'image' ? 'image' : 'file',
        contentType: typeof media.contentType === 'string' ? String(media.contentType) : undefined,
        thumbContentType:
          typeof media.thumbContentType === 'string' ? String(media.thumbContentType) : undefined,
        fileName: typeof media.fileName === 'string' ? String(media.fileName) : undefined,
        size:
          typeof media.size === 'number' && Number.isFinite(media.size) ? media.size : undefined,
        durationMs:
          typeof media.durationMs === 'number' && Number.isFinite(media.durationMs)
            ? Math.max(0, Math.floor(media.durationMs))
            : undefined,
      }));
    }
    return [];
  })();

  const mediaList: MediaItem[] = mediaEnvelope
    ? envMediaList
    : !isStillEncrypted && (isDm || isGroup) && decryptedMediaList.length
      ? decryptedMediaList
      : item.mediaList
        ? item.mediaList
        : item.media
          ? [item.media]
          : [];
  const previewableWithOriginalIdx = mediaList
    .map((m, idx) => ({ m, idx }))
    .filter(({ m }) => isPreviewableMedia(m));
  const fileLikeWithOriginalIdx = mediaList
    .map((m, idx) => ({ m, idx }))
    .filter(({ m }) => !isPreviewableMedia(m));
  const primaryPreviewable = previewableWithOriginalIdx.length
    ? previewableWithOriginalIdx[0].m
    : null;
  const mediaLooksImage = !!primaryPreviewable && isImageLikeMedia(primaryPreviewable);
  const mediaLooksVideo = !!primaryPreviewable && isVideoLikeMedia(primaryPreviewable);
  const hasAnyPreviewableMedia = previewableWithOriginalIdx.length > 0;
  // Only images/videos should render in the large "media card" UI.
  // File-only messages render as normal bubbles with attachment tiles.
  const hasMedia = hasAnyPreviewableMedia && !isStillEncrypted;
  const thumbKeyPath =
    mediaLooksImage || mediaLooksVideo
      ? primaryPreviewable?.thumbPath || primaryPreviewable?.path
      : undefined;
  const thumbAspect =
    thumbKeyPath && imageAspectByPath[thumbKeyPath] ? imageAspectByPath[thumbKeyPath] : undefined;

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
  const avatarImageUri = prof?.avatarImagePath
    ? avatarUrlByPath[String(prof.avatarImagePath)]
    : undefined;

  const rowGutter = !isOutgoing && showAvatarForIncoming ? AVATAR_GUTTER : 0;
  const capped = getCappedMediaSize(
    thumbAspect,
    isOutgoing ? chatViewportWidth : chatViewportWidth - rowGutter,
  );
  const hideMetaUntilDecrypted = isStillEncrypted;
  const canReact = !isDeleted && !isStillEncrypted;
  const reactionEntriesVisible = canReact ? reactionEntries : [];
  const metaPrefix = hideMetaUntilDecrypted || isOutgoing ? '' : `${item.user ?? 'anon'} · `;
  const metaLine = hideMetaUntilDecrypted
    ? ''
    : `${metaPrefix}${formatted}${expiresIn != null ? ` · disappears in ${formatRemaining(expiresIn)}` : ''}`;

  // NOTE: This file is a render helper, not a React component, so we MUST NOT use hooks here.

  const handleOpenMessageActionsFromEvent = (e: unknown) => {
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
  };

  const openFileAtOriginalIdx = (originalIdx: number) => {
    if (isDm) return void openDmMediaViewer(item, originalIdx);
    if (isGroup) return void openGroupMediaViewer(item, originalIdx);
    return void openViewer(mediaList, originalIdx);
  };

  const resolveEncryptedFileUriByIdx = async (originalIdx: number): Promise<string | null> => {
    if (!isEncryptedChat) return null;
    if (!item.decryptedText) return null;
    const idx = Math.max(0, Math.floor(originalIdx || 0));
    if (isDm) {
      const env = parseDmMediaEnvelope(String(item.decryptedText || ''));
      const arr = normalizeDmMediaItems(env);
      const it = arr[idx];
      if (!it) return null;
      return await args.decryptDmFileToCacheUri(item, it);
    }
    if (isGroup) {
      const env = parseGroupMediaEnvelope(String(item.decryptedText || ''));
      const arr = normalizeGroupMediaItems(env);
      const it = arr[idx];
      if (!it) return null;
      return await args.decryptGroupFileToCacheUri(item, it);
    }
    return null;
  };

  const renderMediaCarousel =
    mediaList.length && hasMedia && !isDeleted ? (
      <MediaStackCarousel
        messageId={item.id}
        mediaList={mediaList}
        width={capped.w}
        height={capped.h}
        isDark={isDark}
        onToast={showToast}
        audioSlide={
          audioPlayback
            ? {
                isOutgoing,
                currentKey: audioPlayback.currentKey,
                loadingKey: audioPlayback.loadingKey,
                isPlaying: audioPlayback.isPlaying,
                positionMs: audioPlayback.positionMs,
                durationMs: audioPlayback.durationMs,
                getKey: (idx, media) => audioPlayback.getAudioKey(item, idx, media),
                getTitle: (media) => audioPlayback.getAudioTitle(media),
                onToggle: (key, idx, media) =>
                  audioPlayback.onPressAudio({ msg: item, idx, key, media }),
                onSeek: (key, ms) => audioPlayback.seekFor(key, ms),
                getDownloadUrl: isEncryptedChat
                  ? async (idx, _media) => await resolveEncryptedFileUriByIdx(idx)
                  : undefined,
              }
            : undefined
        }
        cornerRadius={0}
        loop
        // Avoid letterboxing seams/bars in chat thumbnails (esp. outgoing on mobile).
        imageResizeMode="cover"
        containOnAspectMismatch
        aspectByPath={imageAspectByPath}
        uriByPath={isEncryptedChat ? EMPTY_URI_BY_PATH : mediaUrlByPath}
        thumbUriByPath={isEncryptedChat ? dmThumbUriByPath : undefined}
        onImageAspect={(keyPath, aspect) => {
          if (!keyPath) return;
          // Only update if we don't have one yet, or if this corrects a bad value (e.g., EXIF-rotated images).
          setImageAspectByPath((prev) => {
            const cur = prev[keyPath];
            if (typeof cur === 'number' && Number.isFinite(cur) && cur > 0) {
              // If the measured aspect is materially different, prefer the measured value.
              if (Math.abs(cur - aspect) < 0.02) return prev;
              return { ...prev, [keyPath]: aspect };
            }
            return { ...prev, [keyPath]: aspect };
          });
        }}
        loadingTextColor={
          isOutgoing
            ? withAlpha(PALETTE.white, 0.9)
            : isDark
              ? APP_COLORS.dark.text.secondary
              : APP_COLORS.light.text.secondary
        }
        loadingDotsColor={
          isOutgoing
            ? withAlpha(PALETTE.white, 0.9)
            : isDark
              ? APP_COLORS.dark.text.secondary
              : APP_COLORS.light.text.secondary
        }
        onOpen={(idx, tapped) => {
          const originalIdx = Math.max(0, Math.min(mediaList.length - 1, idx));
          const ct = String(tapped?.contentType || '')
            .trim()
            .toLowerCase()
            .split(';')[0]
            .trim();
          if (ct.startsWith('audio/') && audioPlayback) {
            void audioPlayback.onPressAudio({
              msg: item,
              idx: originalIdx,
              key: audioPlayback.getAudioKey(item, originalIdx, tapped),
              media: tapped,
            });
            return;
          }
          if (isDm) void openDmMediaViewer(item, originalIdx);
          else if (isGroup) void openGroupMediaViewer(item, originalIdx);
          else openViewer(mediaList, originalIdx);
        }}
        onLongPress={(e) => handleOpenMessageActionsFromEvent(e)}
      />
    ) : null;

  // If the message contains previewable media, keep all attachments in the carousel
  // (files/audio show as "chips" pages there). Only show attachment tiles for file-only messages.
  const attachmentsToRender =
    isDeleted || isStillEncrypted || hasMedia
      ? []
      : fileLikeWithOriginalIdx.map(({ m, idx }) => ({ m, idx }));

  const renderAttachments =
    attachmentsToRender.length && !isDeleted && !isStillEncrypted ? (
      <AttachmentTilesList
        messageId={String(item.id)}
        items={attachmentsToRender.map(({ m, idx }) => ({ media: m, idx }))}
        isDark={isDark}
        isOutgoing={isOutgoing}
        audio={
          audioPlayback
            ? {
                currentKey: audioPlayback.currentKey,
                loadingKey: audioPlayback.loadingKey,
                isPlaying: audioPlayback.isPlaying,
                positionMs: audioPlayback.positionMs,
                durationMs: audioPlayback.durationMs,
                getKey: (idx, media) => audioPlayback.getAudioKey(item, idx, media),
                getTitle: (media) => audioPlayback.getAudioTitle(media),
                onToggle: ({ key, idx, media }) =>
                  audioPlayback.onPressAudio({ msg: item, idx, key, media }),
                onSeek: (key, ms) => audioPlayback.seekFor(key, ms),
              }
            : undefined
        }
        onPressFile={(idx) => openFileAtOriginalIdx(idx)}
        onLongPressFile={(e) => handleOpenMessageActionsFromEvent(e)}
        getDownloadUrl={async (media, idx) => {
          if (!String(media?.path || '').trim()) return null;
          if (!isEncryptedChat) return mediaUrlByPath[String(media.path)] || null;
          return await resolveEncryptedFileUriByIdx(idx);
        }}
        onDownloadSuccess={() => showToast('Media saved', 'success')}
        onDownloadError={(m) => toastErr(showToast, m)}
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
      onLongPressMessage={(e: unknown) => handleOpenMessageActionsFromEvent(e)}
      selectionActive={selectionActive}
      isSelected={selectedIdSet.has(String(item.id))}
      onToggleSelected={() => toggleSelectedMessageId(String(item.id))}
      latestOutgoingMessageId={latestOutgoingMessageId}
      retryFailedMessage={retryFailedMessage}
      renderMediaCarousel={renderMediaCarousel}
      renderAttachments={renderAttachments}
    />
  );
}
