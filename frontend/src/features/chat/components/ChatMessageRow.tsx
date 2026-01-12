import React from 'react';
import { Image, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { AnimatedDots } from '../../../components/AnimatedDots';
import { AvatarBubble } from '../../../components/AvatarBubble';
import { RichText } from '../../../components/RichText';
import type { MediaItem } from '../../../types/media';
import { getPreviewKind } from '../../../utils/mediaKinds';
import type { ChatMessage } from '../types';
import { normalizeChatMediaList, parseChatEnvelope } from '../parsers';
import type { ChatScreenStyles } from '../../../screens/ChatScreen.styles';
import type { PublicAvatarProfileLite } from '../../../hooks/usePublicAvatarProfiles';
import type { PendingMediaItem } from '../attachments';

// NOTE:
// This component is intentionally a “dumb view” extracted from `ChatScreen.tsx`.
// It takes a lot of props because we’re avoiding behavior changes while shrinking ChatScreen.
// We can progressively tighten the prop surface into a smaller view-model later.

export function ChatMessageRow(props: {
  styles: ChatScreenStyles;
  item: ChatMessage;
  index: number;
  messageListData: ChatMessage[];
  visibleMessages: ChatMessage[];

  isDark: boolean;
  isDm: boolean;
  isGroup: boolean;
  isEncryptedChat: boolean;

  myUserId: string | null;
  avatarProfileBySub: Record<string, PublicAvatarProfileLite>;
  nameBySub: Record<string, string>;
  avatarUrlByPath: Record<string, string>;

  senderKey: string;
  isOutgoing: boolean;
  showAvatarForIncoming: boolean;
  avatarImageUri?: string;

  metaLine: string;
  formatted: string;
  nowSec: number;
  expiresIn: number | null;
  seenLabel: string | null;

  // Message content / media envelope
  captionText: string;
  captionHasText: boolean;
  isDeleted: boolean;
  displayText: string;
  isEdited: boolean;
  isStillEncrypted: boolean;

  // Inline edit
  inlineEditTargetId: string | null;
  inlineEditDraft: string;
  setInlineEditDraft: (v: string) => void;
  inlineEditUploading: boolean;
  inlineEditAttachmentMode: 'keep' | 'remove' | 'replace';
  pendingMedia: PendingMediaItem[];
  commitInlineEdit: () => void | Promise<void>;
  cancelInlineEdit: () => void;

  // Reactions
  canReact: boolean;
  reactionEntriesVisible: Array<{ emoji: string; count: number; userSubs: string[] }>;
  openReactionInfo: (m: ChatMessage, emoji: string, userSubs: string[]) => void | Promise<void>;
  sendReaction: (m: ChatMessage, emoji: string) => void | Promise<void>;

  // Media rendering
  hasMedia: boolean;
  mediaList: MediaItem[];
  mediaUrlByPath: Record<string, string>;
  dmThumbUriByPath: Record<string, string>;
  capped: { w: number; h: number };
  openViewer: (mediaList: MediaItem[], startIdx: number) => void;
  openDmMediaViewer: (m: ChatMessage, startIdx: number) => void | Promise<void>;
  openGroupMediaViewer: (m: ChatMessage, startIdx: number) => void | Promise<void>;

  // Navigation / actions
  requestOpenLink: (url: string) => void;
  onPressMessage: (m: ChatMessage) => void;
  onLongPressMessage: (e: unknown) => void;
  latestOutgoingMessageId: string | null;
  retryFailedMessage: (m: ChatMessage) => void;

  renderMediaCarousel?: React.ReactNode;
}): React.JSX.Element {
  const {
    styles,
    item,
    visibleMessages,
    isDark,
    isDm,
    isGroup: _isGroup,
    isEncryptedChat,
    myUserId,
    avatarProfileBySub,
    nameBySub,
    avatarUrlByPath: _avatarUrlByPath,
    senderKey,
    isOutgoing,
    showAvatarForIncoming,
    avatarImageUri,
    metaLine,
    captionText,
    captionHasText: _captionHasText,
    isDeleted,
    displayText,
    isEdited,
    isStillEncrypted,
    inlineEditTargetId,
    inlineEditDraft,
    setInlineEditDraft,
    inlineEditUploading,
    inlineEditAttachmentMode,
    pendingMedia,
    commitInlineEdit,
    cancelInlineEdit,
    canReact,
    reactionEntriesVisible,
    openReactionInfo,
    sendReaction,
    hasMedia,
    mediaList: _mediaList,
    mediaUrlByPath,
    dmThumbUriByPath: _dmThumbUriByPath,
    capped,
    openViewer,
    openDmMediaViewer: _openDmMediaViewer,
    openGroupMediaViewer: _openGroupMediaViewer,
    requestOpenLink,
    onPressMessage,
    onLongPressMessage,
    latestOutgoingMessageId,
    retryFailedMessage,
    renderMediaCarousel,
  } = props;

  const prof = item.userSub ? avatarProfileBySub[String(item.userSub)] : undefined;

  const AVATAR_SIZE = 34;
  const AVATAR_TOP_OFFSET = 0;

  return (
    <Pressable
      onPress={() => {
        if (inlineEditTargetId && item.id === inlineEditTargetId) return;
        onPressMessage(item);
      }}
      onLongPress={(e) => {
        if (isDeleted) return;
        onLongPressMessage(e as unknown);
      }}
    >
      <View style={[styles.messageRow, isOutgoing ? styles.messageRowOutgoing : styles.messageRowIncoming]}>
        {!isOutgoing && showAvatarForIncoming ? (
          <View style={[styles.avatarGutter, { width: AVATAR_SIZE, marginTop: AVATAR_TOP_OFFSET }]}>
            <AvatarBubble
              size={AVATAR_SIZE}
              seed={senderKey}
              label={item.user ?? 'anon'}
              backgroundColor={prof?.avatarBgColor ?? item.avatarBgColor}
              textColor={prof?.avatarTextColor ?? item.avatarTextColor}
              imageUri={avatarImageUri}
              imageBgColor={isDark ? '#1c1c22' : '#f2f2f7'}
            />
          </View>
        ) : null}

        {hasMedia && !isDeleted ? (
          <View style={[styles.mediaMsg, isOutgoing ? styles.mediaMsgOutgoing : styles.mediaMsgIncoming]}>
            <View style={[styles.mediaCardOuter, { width: capped.w }]}>
              <View
                style={[
                  styles.mediaCard,
                  isOutgoing
                    ? styles.mediaCardOutgoing
                    : isDark
                      ? styles.mediaCardIncomingDark
                      : styles.mediaCardIncoming,
                ]}
              >
                <View
                  style={[
                    styles.mediaHeader,
                    isOutgoing
                      ? styles.mediaHeaderOutgoing
                      : isDark
                        ? styles.mediaHeaderIncomingDark
                        : styles.mediaHeaderIncoming,
                  ]}
                >
                  <View style={styles.mediaHeaderTopRow}>
                    <View style={styles.mediaHeaderTopLeft}>
                      {metaLine ? (
                        <Text
                          style={[
                            styles.mediaHeaderMeta,
                            isOutgoing
                              ? styles.mediaHeaderMetaOutgoing
                              : isDark
                                ? styles.mediaHeaderMetaIncomingDark
                                : styles.mediaHeaderMetaIncoming,
                          ]}
                        >
                          {metaLine}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {!isDeleted && item.replyToMessageId && item.replyToPreview
                    ? (() => {
                        const origin = visibleMessages.find((m) => m && m.id === item.replyToMessageId);
                        let thumbUri: string | null = null;
                        let count = 0;
                        let kind: 'image' | 'video' | 'file' = 'file';
                        try {
                          if (origin && !origin.deletedAt) {
                            const env =
                              !origin.encrypted && !origin.groupEncrypted && !isDm
                                ? parseChatEnvelope(origin.rawText ?? origin.text)
                                : null;
                            const list = env ? normalizeChatMediaList(env.media) : [];
                            if (list.length) {
                              count = list.length;
                              const first = list[0];
                              kind = getPreviewKind(first);
                              const key = String(first.thumbPath || first.path);
                              thumbUri = mediaUrlByPath[key] ? mediaUrlByPath[key] : null;
                            }
                          }
                        } catch {
                          // ignore
                        }
                        const openOriginMedia = () => {
                          if (!origin) return;
                          const env =
                            !origin.encrypted && !origin.groupEncrypted && !isDm
                              ? parseChatEnvelope(origin.rawText ?? origin.text)
                              : null;
                          const list = env ? normalizeChatMediaList(env.media) : [];
                          if (!list.length) return;
                          openViewer(list, 0);
                        };
                        return (
                          <View
                            style={[
                              styles.replySnippet,
                              isOutgoing
                                ? styles.replySnippetOutgoing
                                : isDark
                                  ? styles.replySnippetIncomingDark
                                  : styles.replySnippetIncoming,
                            ]}
                          >
                            {count ? (
                              <Pressable
                                onPress={openOriginMedia}
                                style={({ pressed }) => [styles.replyThumbWrap, pressed ? { opacity: 0.9 } : null]}
                                accessibilityRole="button"
                                accessibilityLabel="Open replied media"
                              >
                                {thumbUri ? (
                                  <Image source={{ uri: thumbUri }} style={styles.replyThumb} />
                                ) : (
                                  <View style={[styles.replyThumb, styles.replyThumbPlaceholder]}>
                                    <Text style={styles.replyThumbPlaceholderText}>
                                      {kind === 'image' ? 'Photo' : kind === 'video' ? 'Video' : 'File'}
                                    </Text>
                                  </View>
                                )}
                                {count > 1 ? (
                                  <View style={styles.replyThumbCountBadge}>
                                    <Text style={styles.replyThumbCountText}>{`+${count - 1}`}</Text>
                                  </View>
                                ) : null}
                              </Pressable>
                            ) : null}
                            <Text
                              style={[
                                styles.replySnippetLabel,
                                isOutgoing
                                  ? styles.replySnippetLabelOutgoing
                                  : isDark
                                    ? styles.replySnippetLabelIncomingDark
                                    : styles.replySnippetLabelIncoming,
                              ]}
                              numberOfLines={1}
                            >
                              {`Replying to ${
                                item.replyToUserSub
                                  ? String(item.replyToUserSub) === String(myUserId)
                                    ? 'You'
                                    : avatarProfileBySub[String(item.replyToUserSub)]?.displayName ||
                                      nameBySub[String(item.replyToUserSub)] ||
                                      'user'
                                  : 'user'
                              }`}
                            </Text>
                            <Text
                              style={[
                                styles.replySnippetText,
                                isOutgoing
                                  ? styles.replySnippetTextOutgoing
                                  : isDark
                                    ? styles.replySnippetTextIncomingDark
                                    : styles.replySnippetTextIncoming,
                              ]}
                              numberOfLines={2}
                            >
                              {String(item.replyToPreview || '').trim()}
                            </Text>
                          </View>
                        );
                      })()
                    : null}

                  {inlineEditTargetId && item.id === inlineEditTargetId && !isDeleted ? (
                    <View style={styles.inlineEditWrap}>
                      <TextInput
                        style={[
                          styles.inlineEditInput,
                          isOutgoing ? styles.inlineEditInputOutgoing : styles.inlineEditInputIncoming,
                        ]}
                        value={inlineEditDraft}
                        onChangeText={setInlineEditDraft}
                        multiline
                        autoFocus
                        placeholder="Add a caption…"
                        placeholderTextColor={isOutgoing ? 'rgba(255,255,255,0.75)' : isDark ? '#b7b7c2' : '#777'}
                        editable={!inlineEditUploading}
                        selectionColor={isOutgoing ? 'rgba(255,255,255,0.95)' : isDark ? '#ffffff' : '#111'}
                        cursorColor={isOutgoing ? 'rgba(255,255,255,0.95)' : isDark ? '#ffffff' : '#111'}
                      />
                      {inlineEditAttachmentMode === 'remove' ? (
                        <Text
                          style={[
                            styles.mediaEditHint,
                            isOutgoing
                              ? styles.mediaEditHintOutgoing
                              : isDark
                                ? styles.mediaEditHintIncomingDark
                                : styles.mediaEditHintIncoming,
                          ]}
                        >
                          Attachment will be removed
                        </Text>
                      ) : inlineEditAttachmentMode === 'replace' && pendingMedia.length ? (
                        <Text
                          style={[
                            styles.mediaEditHint,
                            isOutgoing
                              ? styles.mediaEditHintOutgoing
                              : isDark
                                ? styles.mediaEditHintIncomingDark
                                : styles.mediaEditHintIncoming,
                          ]}
                        >
                          New attachment selected
                        </Text>
                      ) : null}
                      <View style={styles.inlineEditActions}>
                        <Pressable
                          onPress={() => void commitInlineEdit()}
                          disabled={inlineEditUploading}
                          style={({ pressed }) => [
                            styles.inlineEditBtn,
                            inlineEditUploading
                              ? isOutgoing
                                ? styles.inlineEditBtnUploadingOutgoing
                                : isDark
                                  ? styles.btnDisabledDark
                                  : styles.btnDisabled
                              : null,
                            pressed ? styles.inlineEditBtnPressed : null,
                          ]}
                        >
                          {inlineEditUploading ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text
                                style={[
                                  styles.inlineEditBtnText,
                                  isOutgoing ? styles.inlineEditBtnTextOutgoing : styles.inlineEditBtnTextIncoming,
                                ]}
                              >
                                Uploading
                              </Text>
                              <AnimatedDots color={isOutgoing ? 'rgba(255,255,255,0.95)' : '#111'} size={16} />
                            </View>
                          ) : (
                            <Text
                              style={[
                                styles.inlineEditBtnText,
                                isOutgoing ? styles.inlineEditBtnTextOutgoing : styles.inlineEditBtnTextIncoming,
                              ]}
                            >
                              Save
                            </Text>
                          )}
                        </Pressable>
                        <Pressable
                          onPress={cancelInlineEdit}
                          disabled={inlineEditUploading}
                          style={({ pressed }) => [
                            styles.inlineEditBtn,
                            inlineEditUploading
                              ? isOutgoing
                                ? styles.inlineEditBtnUploadingOutgoing
                                : isDark
                                  ? styles.btnDisabledDark
                                  : styles.btnDisabled
                              : null,
                            pressed ? styles.inlineEditBtnPressed : null,
                          ]}
                        >
                          <Text
                            style={[
                              styles.inlineEditBtnText,
                              isOutgoing ? styles.inlineEditBtnTextOutgoing : styles.inlineEditBtnTextIncoming,
                            ]}
                          >
                            Cancel
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : captionText?.length ? (
                    <View style={styles.mediaHeaderCaptionRow}>
                      <RichText
                        text={String(captionText || '')}
                        isDark={isDark}
                        enableMentions={!isEncryptedChat}
                        variant={isOutgoing ? 'outgoing' : 'incoming'}
                        style={[
                          styles.mediaHeaderCaption,
                          isOutgoing
                            ? styles.mediaHeaderCaptionOutgoing
                            : isDark
                              ? styles.mediaHeaderCaptionIncomingDark
                              : styles.mediaHeaderCaptionIncoming,
                          styles.mediaHeaderCaptionFlex,
                        ]}
                        mentionStyle={styles.mentionText}
                        onOpenUrl={requestOpenLink}
                      />
                    </View>
                  ) : null}
                </View>

                {renderMediaCarousel || null}
              </View>

              {/* Reactions should float outside the rounded media card (don't get clipped). */}
              {reactionEntriesVisible.length ? (
                <View
                  style={[
                    styles.reactionOverlay,
                    isOutgoing ? styles.reactionOverlayOutgoing : styles.reactionOverlayIncoming,
                    ...(Platform.OS === 'web' ? [{ pointerEvents: 'box-none' as const }] : []),
                  ]}
                  pointerEvents={Platform.OS === 'web' ? undefined : 'box-none'}
                >
                  {reactionEntriesVisible.slice(0, 3).map((r, idx) => {
                    const mine = myUserId ? r.userSubs.includes(myUserId) : false;
                    return (
                      <Pressable
                        key={`ov:${item.id}:${r.emoji}`}
                        onPress={() => void openReactionInfo(item, r.emoji, r.userSubs)}
                        onLongPress={() => sendReaction(item, r.emoji)}
                        disabled={!canReact}
                        style={({ pressed }) => [
                          styles.reactionMiniChip,
                          isDark ? styles.reactionMiniChipDark : null,
                          mine ? (isDark ? styles.reactionMiniChipMineDark : styles.reactionMiniChipMine) : null,
                          idx ? styles.reactionMiniChipStacked : null,
                          pressed ? { opacity: 0.85 } : null,
                        ]}
                      >
                        <Text style={[styles.reactionMiniText, isDark ? styles.reactionMiniTextDark : null]}>
                          {r.emoji}
                          {r.count > 1 ? ` ${r.count}` : ''}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          </View>
        ) : (
          <View
            style={[
              styles.messageBubble,
              isOutgoing
                ? styles.messageBubbleOutgoing
                : isDark
                  ? styles.messageBubbleIncomingDark
                  : styles.messageBubbleIncoming,
              inlineEditTargetId && item.id === inlineEditTargetId ? styles.messageBubbleEditing : null,
            ]}
          >
            {metaLine ? (
              <Text
                style={[
                  styles.messageMeta,
                  isOutgoing
                    ? styles.messageMetaOutgoing
                    : isDark
                      ? styles.messageMetaIncomingDark
                      : styles.messageMetaIncoming,
                ]}
              >
                {metaLine}
              </Text>
            ) : null}

            {!isDeleted && item.replyToMessageId && item.replyToPreview ? (
              <Text
                style={[
                  styles.replySnippetText,
                  isOutgoing
                    ? styles.replySnippetTextOutgoing
                    : isDark
                      ? styles.replySnippetTextIncomingDark
                      : styles.replySnippetTextIncoming,
                ]}
              >
                {String(item.replyToPreview || '').trim()}
              </Text>
            ) : null}

            {displayText?.length ? (
              <View style={[styles.messageTextRow, isOutgoing ? styles.messageTextRowOutgoing : null]}>
                {inlineEditTargetId && item.id === inlineEditTargetId && !isDeleted ? (
                  <View style={styles.inlineEditWrap}>
                    <TextInput
                      style={[
                        styles.inlineEditInput,
                        isOutgoing ? styles.inlineEditInputOutgoing : styles.inlineEditInputIncoming,
                      ]}
                      value={inlineEditDraft}
                      onChangeText={setInlineEditDraft}
                      multiline
                      autoFocus
                      editable={!inlineEditUploading}
                      selectionColor={isOutgoing ? 'rgba(255,255,255,0.95)' : isDark ? '#ffffff' : '#111'}
                      cursorColor={isOutgoing ? 'rgba(255,255,255,0.95)' : isDark ? '#ffffff' : '#111'}
                    />
                  </View>
                ) : (
                  <RichText
                    text={String(displayText || '')}
                    isDark={isDark}
                    enableMentions={!isEncryptedChat}
                    variant={isOutgoing ? 'outgoing' : 'incoming'}
                    style={[
                      styles.messageText,
                      isOutgoing
                        ? styles.messageTextOutgoing
                        : isDark
                          ? styles.messageTextIncomingDark
                          : styles.messageTextIncoming,
                      styles.messageTextFlex,
                      ...(isDeleted ? [styles.deletedText] : []),
                    ]}
                    mentionStyle={styles.mentionText}
                    onOpenUrl={requestOpenLink}
                  />
                )}

                {isEdited ? (
                  <Text
                    style={[
                      styles.editedLabel,
                      isOutgoing
                        ? isDark
                          ? styles.editedLabelOutgoingDark
                          : styles.editedLabelOutgoing
                        : isDark
                          ? styles.editedLabelIncomingDark
                          : styles.editedLabelIncoming,
                    ]}
                  >
                    {' '}
                    Edited
                  </Text>
                ) : null}

                {isOutgoing &&
                !props.seenLabel &&
                item.localStatus !== 'failed' &&
                item.id === latestOutgoingMessageId ? (
                  <Text
                    style={[
                      styles.sendStatusInline,
                      isDark ? styles.sendStatusInlineOutgoingDark : styles.sendStatusInlineOutgoing,
                    ]}
                  >
                    {item.localStatus === 'sending' ? '…' : '✓'}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {isOutgoing && item.localStatus === 'failed' ? (
              <Pressable
                onPress={() => retryFailedMessage(item)}
                accessibilityRole="button"
                accessibilityLabel="Retry sending message"
              >
                <Text
                  style={[
                    styles.sendFailedText,
                    isDark ? styles.sendFailedTextDark : null,
                    isOutgoing ? styles.sendFailedTextAlignOutgoing : null,
                  ]}
                >
                  Failed · tap to retry
                </Text>
              </Pressable>
            ) : null}

            {props.seenLabel ? (
              <Text
                style={[
                  styles.seenText,
                  isOutgoing ? styles.seenTextOutgoing : styles.seenTextIncoming,
                  isOutgoing ? styles.seenTextAlignOutgoing : styles.seenTextAlignIncoming,
                ]}
              >
                {props.seenLabel}
              </Text>
            ) : null}

            {reactionEntriesVisible.length && !isStillEncrypted ? (
              <View
                style={[
                  styles.reactionOverlay,
                  isOutgoing ? styles.reactionOverlayOutgoing : styles.reactionOverlayIncoming,
                  ...(Platform.OS === 'web' ? [{ pointerEvents: 'box-none' as const }] : []),
                ]}
                pointerEvents={Platform.OS === 'web' ? undefined : 'box-none'}
              >
                {reactionEntriesVisible.slice(0, 3).map((r, idx) => {
                  const mine = myUserId ? r.userSubs.includes(myUserId) : false;
                  return (
                    <Pressable
                      key={`ov:${item.id}:${r.emoji}`}
                      onPress={() => void openReactionInfo(item, r.emoji, r.userSubs)}
                      onLongPress={() => sendReaction(item, r.emoji)}
                      disabled={!canReact}
                      style={({ pressed }) => [
                        styles.reactionMiniChip,
                        isDark ? styles.reactionMiniChipDark : null,
                        mine ? (isDark ? styles.reactionMiniChipMineDark : styles.reactionMiniChipMine) : null,
                        idx ? styles.reactionMiniChipStacked : null,
                        pressed ? { opacity: 0.85 } : null,
                      ]}
                    >
                      <Text style={[styles.reactionMiniText, isDark ? styles.reactionMiniTextDark : null]}>
                        {r.emoji}
                        {r.count > 1 ? ` ${r.count}` : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        )}
      </View>
    </Pressable>
  );
}
