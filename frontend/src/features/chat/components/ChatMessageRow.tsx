import React from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { GestureResponderEvent } from 'react-native';
import { Image, Platform, Pressable, Text, TextInput, View } from 'react-native';

import { AnimatedDots } from '../../../components/AnimatedDots';
import { AvatarBubble } from '../../../components/AvatarBubble';
import { RichText } from '../../../components/RichText';
import type { PublicAvatarProfileLite } from '../../../hooks/usePublicAvatarProfiles';
import type { ChatScreenStyles } from '../../../screens/ChatScreen.styles';
import { APP_COLORS, PALETTE, withAlpha } from '../../../theme/colors';
import type { MediaItem } from '../../../types/media';
import { fileBrandColorForMedia, fileIconNameForMedia, getPreviewKind } from '../../../utils/mediaKinds';
import type { PendingMediaItem } from '../attachments';
import {
  normalizeChatMediaList,
  normalizeDmMediaItems,
  normalizeGroupMediaItems,
  parseChatEnvelope,
  parseDmMediaEnvelope,
  parseGroupMediaEnvelope,
} from '../parsers';
import type { ChatMessage } from '../types';

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
  onLongPressMessage: (e: GestureResponderEvent) => void;
  // Multi-select
  selectionActive: boolean;
  isSelected: boolean;
  onToggleSelected: () => void;
  latestOutgoingMessageId: string | null;
  retryFailedMessage: (m: ChatMessage) => void;

  renderMediaCarousel?: React.ReactNode;
  renderAttachments?: React.ReactNode;
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
    dmThumbUriByPath,
    capped,
    openViewer,
    openDmMediaViewer,
    openGroupMediaViewer,
    requestOpenLink,
    onPressMessage,
    onLongPressMessage,
    selectionActive,
    isSelected,
    onToggleSelected,
    latestOutgoingMessageId,
    retryFailedMessage,
    renderMediaCarousel,
    renderAttachments,
  } = props;

  const [inlineEditFocused, setInlineEditFocused] = React.useState(false);
  React.useEffect(() => {
    if (!inlineEditTargetId || item.id !== inlineEditTargetId) setInlineEditFocused(false);
  }, [inlineEditTargetId, item.id]);

  const prof = item.userSub ? avatarProfileBySub[String(item.userSub)] : undefined;

  const replyOrigin =
    !isDeleted && item.replyToMessageId
      ? visibleMessages.find((m) => m && m.id === item.replyToMessageId)
      : undefined;
  const replyToLabel = (() => {
    const sub = item.replyToUserSub ? String(item.replyToUserSub) : '';
    const replyingToMe =
      !!sub && !!myUserId && String(myUserId) === sub
        ? true
        : !!replyOrigin?.userSub && !!myUserId && String(myUserId) === String(replyOrigin.userSub);
    if (replyingToMe) return isOutgoing ? 'yourself' : 'You';
    const fromOrigin = replyOrigin?.user ? String(replyOrigin.user) : '';
    if (fromOrigin) return fromOrigin;
    if (sub) {
      const fromProfiles = avatarProfileBySub[sub]?.displayName
        ? String(avatarProfileBySub[sub]?.displayName)
        : '';
      if (fromProfiles) return fromProfiles;
      const fromNames = nameBySub[sub] ? String(nameBySub[sub]) : '';
      if (fromNames) return fromNames;
    }
    return 'Unknown user';
  })();

  const AVATAR_SIZE = 34;
  const AVATAR_TOP_OFFSET = 0;

  // Mobile web: when long-press opens the actions menu, releasing immediately can still
  // trigger native selection/callouts and/or a synthetic click. Consume the next release.
  const webConsumeNextReleaseRef = React.useRef(false);
  const swallowNextPressRef = React.useRef(false);

  const handleLongPressMessage = React.useCallback(
    (e: GestureResponderEvent) => {
      if (selectionActive) {
        onToggleSelected();
        return;
      }
      if (isDeleted) return;
      if (Platform.OS === 'web') {
        // Critical: consume the imminent release event (touchend/pointerup) so mobile browsers
        // don't finalize a selection/callout right as the actions menu appears.
        webConsumeNextReleaseRef.current = true;
        swallowNextPressRef.current = true;
      }
      onLongPressMessage(e);
    },
    [isDeleted, onLongPressMessage, onToggleSelected, selectionActive],
  );

  return (
    <Pressable
      onPress={() => {
        if (swallowNextPressRef.current) {
          swallowNextPressRef.current = false;
          return;
        }
        if (selectionActive) {
          onToggleSelected();
          return;
        }
        if (inlineEditTargetId && item.id === inlineEditTargetId) return;
        onPressMessage(item);
      }}
      onLongPress={handleLongPressMessage}
      // Prevent the browser’s native context menu / selection behavior from fighting
      // with our custom long-press message actions on mobile web.
      {...(Platform.OS === 'web'
        ? ({
            onContextMenu: (e: unknown) => {
              const ev = e as { preventDefault?: () => void; stopPropagation?: () => void };
              ev.preventDefault?.();
              ev.stopPropagation?.();
            },
            onTouchEndCapture: (e: unknown) => {
              if (!webConsumeNextReleaseRef.current) return;
              const ev = e as { preventDefault?: () => void; stopPropagation?: () => void };
              ev.preventDefault?.();
              ev.stopPropagation?.();
              try {
                document.getSelection?.()?.removeAllRanges?.();
              } catch {
                // ignore
              }
              webConsumeNextReleaseRef.current = false;
              swallowNextPressRef.current = false;
            },
            onPointerUpCapture: (e: unknown) => {
              if (!webConsumeNextReleaseRef.current) return;
              const ev = e as { preventDefault?: () => void; stopPropagation?: () => void };
              ev.preventDefault?.();
              ev.stopPropagation?.();
              try {
                document.getSelection?.()?.removeAllRanges?.();
              } catch {
                // ignore
              }
              webConsumeNextReleaseRef.current = false;
              swallowNextPressRef.current = false;
            },
            style: ({ pressed }: { pressed: boolean }) => [
              {
                // Helps avoid delayed/synthetic click behavior on mobile browsers.
                touchAction: 'manipulation',
              } as const,
              pressed ? { opacity: 0.98 } : null,
            ],
          } as const)
        : {})}
    >
      <View
        style={[
          styles.messageRow,
          isOutgoing ? styles.messageRowOutgoing : styles.messageRowIncoming,
          selectionActive ? { paddingLeft: 34 } : null,
          // Reaction chips are positioned slightly below the bubble.
          // Add bottom padding so the next message doesn't visually overlap them.
          reactionEntriesVisible.length ? { paddingBottom: 12 } : null,
        ]}
      >
        {selectionActive ? (
          <View
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 34,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Pressable
              onPress={onToggleSelected}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={isSelected ? 'Deselect message' : 'Select message'}
              style={({ pressed }) => [
                {
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: isSelected
                    ? isDark
                      ? APP_COLORS.dark.text.primary
                      : APP_COLORS.light.text.primary
                    : isDark
                      ? APP_COLORS.dark.border.subtle
                      : APP_COLORS.light.border.subtle,
                  backgroundColor: isSelected
                    ? isDark
                      ? APP_COLORS.dark.text.primary
                      : APP_COLORS.light.text.primary
                    : 'transparent',
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              {isSelected ? (
                <Text
                  style={{
                    color: isDark ? PALETTE.black : PALETTE.white,
                    fontWeight: '900',
                    // Android: prevent extra font padding pushing the glyph down.
                    includeFontPadding: false,
                    // Keep glyph metrics centered within the 22px circle.
                    lineHeight: 22,
                    // Nudge up slightly to compensate for glyph baseline.
                    marginTop: Platform.OS === 'android' ? -1 : 0,
                    textAlign: 'center',
                    textAlignVertical: 'center',
                  }}
                >
                  ✓
                </Text>
              ) : null}
            </Pressable>
          </View>
        ) : null}

        {!isOutgoing && showAvatarForIncoming ? (
          <View style={[styles.avatarGutter, { width: AVATAR_SIZE, marginTop: AVATAR_TOP_OFFSET }]}>
            <AvatarBubble
              size={AVATAR_SIZE}
              seed={senderKey}
              label={item.user ?? 'anon'}
              backgroundColor={prof?.avatarBgColor ?? item.avatarBgColor}
              textColor={prof?.avatarTextColor ?? item.avatarTextColor}
              imageUri={avatarImageUri}
              imageBgColor={isDark ? APP_COLORS.dark.bg.header : APP_COLORS.light.bg.surface2}
            />
          </View>
        ) : null}

        {hasMedia && !isDeleted ? (
          <View
            style={[
              styles.mediaMsg,
              isOutgoing ? styles.mediaMsgOutgoing : styles.mediaMsgIncoming,
            ]}
          >
            <View style={[styles.mediaCardOuter, { width: capped.w }]}>
              <View
                style={[
                  styles.mediaCard,
                  isOutgoing
                    ? isDark
                      ? styles.mediaCardOutgoingDark
                      : styles.mediaCardOutgoing
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
                        const origin = replyOrigin;
                        let thumbUri: string | null = null;
                        let count = 0;
                        let kind: 'image' | 'video' | 'file' = 'file';
                        let firstItem: MediaItem | null = null;
                        try {
                          if (origin && !origin.deletedAt) {
                            const list = (() => {
                              if (origin.encrypted && origin.decryptedText) {
                                const dmEnv = parseDmMediaEnvelope(String(origin.decryptedText || ''));
                                const items = normalizeDmMediaItems(dmEnv);
                                return items.map(({ media }) =>
                                  ({
                                    path: String(media.path || ''),
                                    thumbPath:
                                      typeof media.thumbPath === 'string' ? String(media.thumbPath) : undefined,
                                    kind:
                                      media.kind === 'video'
                                        ? 'video'
                                        : media.kind === 'image'
                                          ? 'image'
                                          : 'file',
                                    contentType:
                                      typeof media.contentType === 'string' ? String(media.contentType) : undefined,
                                    thumbContentType:
                                      typeof media.thumbContentType === 'string'
                                        ? String(media.thumbContentType)
                                        : undefined,
                                    fileName:
                                      typeof media.fileName === 'string' ? String(media.fileName) : undefined,
                                    size:
                                      typeof media.size === 'number' && Number.isFinite(media.size)
                                        ? media.size
                                        : undefined,
                                    durationMs:
                                      typeof media.durationMs === 'number' && Number.isFinite(media.durationMs)
                                        ? Math.max(0, Math.floor(media.durationMs))
                                        : undefined,
                                  }) as MediaItem,
                                );
                              }
                              if (origin.groupEncrypted && origin.decryptedText) {
                                const gEnv = parseGroupMediaEnvelope(String(origin.decryptedText || ''));
                                const items = normalizeGroupMediaItems(gEnv);
                                return items.map(({ media }) =>
                                  ({
                                    path: String(media.path || ''),
                                    thumbPath:
                                      typeof media.thumbPath === 'string' ? String(media.thumbPath) : undefined,
                                    kind:
                                      media.kind === 'video'
                                        ? 'video'
                                        : media.kind === 'image'
                                          ? 'image'
                                          : 'file',
                                    contentType:
                                      typeof media.contentType === 'string' ? String(media.contentType) : undefined,
                                    thumbContentType:
                                      typeof media.thumbContentType === 'string'
                                        ? String(media.thumbContentType)
                                        : undefined,
                                    fileName:
                                      typeof media.fileName === 'string' ? String(media.fileName) : undefined,
                                    size:
                                      typeof media.size === 'number' && Number.isFinite(media.size)
                                        ? media.size
                                        : undefined,
                                    durationMs:
                                      typeof media.durationMs === 'number' && Number.isFinite(media.durationMs)
                                        ? Math.max(0, Math.floor(media.durationMs))
                                        : undefined,
                                  }) as MediaItem,
                                );
                              }
                              const env =
                                !origin.encrypted && !origin.groupEncrypted && !isDm
                                  ? parseChatEnvelope(origin.rawText ?? origin.text)
                                  : null;
                              return env ? normalizeChatMediaList(env.media) : [];
                            })();
                            if (list.length) {
                              count = list.length;
                              const first = list[0];
                              firstItem = first;
                              kind = getPreviewKind(first);
                              const key = String(first.thumbPath || first.path);
                              thumbUri =
                                kind !== 'file'
                                  ? origin.encrypted || origin.groupEncrypted
                                    ? (first.thumbPath && dmThumbUriByPath[String(first.thumbPath)])
                                      ? dmThumbUriByPath[String(first.thumbPath)]
                                      : null
                                    : mediaUrlByPath[key]
                                      ? mediaUrlByPath[key]
                                      : null
                                  : null;
                            }
                          }
                        } catch {
                          // ignore
                        }
                        const openOriginMedia = () => {
                          if (!origin) return;
                          if (origin.encrypted) return void openDmMediaViewer(origin, 0);
                          if (origin.groupEncrypted) return void openGroupMediaViewer(origin, 0);
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
                                style={({ pressed }) => [
                                  styles.replyThumbWrap,
                                  pressed ? { opacity: 0.9 } : null,
                                ]}
                                accessibilityRole="button"
                                accessibilityLabel="Open replied media"
                              >
                                {thumbUri ? (
                                  <Image source={{ uri: thumbUri }} style={styles.replyThumb} />
                                ) : (
                                  <View style={[styles.replyThumb, styles.replyThumbPlaceholder]}>
                                    {kind === 'file' ? (
                                      <MaterialCommunityIcons
                                        name={
                                          ((firstItem ? fileIconNameForMedia(firstItem) : null) ||
                                            'file-outline') as never
                                        }
                                        size={24}
                                        color={
                                          isOutgoing
                                            ? withAlpha(PALETTE.white, 0.92)
                                            : (firstItem ? fileBrandColorForMedia(firstItem) : null) ||
                                              (isDark
                                                ? APP_COLORS.dark.text.primary
                                                : APP_COLORS.light.brand.primary)
                                        }
                                      />
                                    ) : (
                                      <Text style={styles.replyThumbPlaceholderText}>
                                        {kind === 'image' ? 'Photo' : 'Video'}
                                      </Text>
                                    )}
                                  </View>
                                )}
                                {count > 1 ? (
                                  <View style={styles.replyThumbCountBadge}>
                                    <Text
                                      style={styles.replyThumbCountText}
                                    >{`+${count - 1}`}</Text>
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
                                replyToLabel
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
                          isOutgoing
                            ? [
                                styles.inlineEditInputOutgoing,
                                inlineEditFocused ? styles.inlineEditInputOutgoingFocused : null,
                              ]
                            : styles.inlineEditInputIncoming,
                        ]}
                        value={inlineEditDraft}
                        onChangeText={setInlineEditDraft}
                        multiline
                        autoFocus
                        onFocus={() => setInlineEditFocused(true)}
                        onBlur={() => setInlineEditFocused(false)}
                        placeholder="Add a caption…"
                        placeholderTextColor={
                          isOutgoing
                            ? withAlpha(PALETTE.white, 0.75)
                            : isDark
                              ? APP_COLORS.dark.text.secondary
                              : PALETTE.slate450
                        }
                        editable={!inlineEditUploading}
                        selectionColor={
                          isOutgoing
                            ? withAlpha(PALETTE.white, 0.95)
                            : isDark
                              ? APP_COLORS.dark.text.primary
                              : APP_COLORS.light.text.primary
                        }
                        cursorColor={
                          isOutgoing
                            ? withAlpha(PALETTE.white, 0.95)
                            : isDark
                              ? APP_COLORS.dark.text.primary
                              : APP_COLORS.light.text.primary
                        }
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
                                  isOutgoing
                                    ? styles.inlineEditBtnTextOutgoing
                                    : styles.inlineEditBtnTextIncoming,
                                ]}
                              >
                                Uploading
                              </Text>
                              <AnimatedDots
                                color={
                                  isOutgoing
                                    ? withAlpha(PALETTE.white, 0.95)
                                    : APP_COLORS.light.text.primary
                                }
                                size={16}
                              />
                            </View>
                          ) : (
                            <Text
                              style={[
                                styles.inlineEditBtnText,
                                isOutgoing
                                  ? styles.inlineEditBtnTextOutgoing
                                  : styles.inlineEditBtnTextIncoming,
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
                              isOutgoing
                                ? styles.inlineEditBtnTextOutgoing
                                : styles.inlineEditBtnTextIncoming,
                            ]}
                          >
                            Cancel
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : captionText?.length || isEdited || !!props.seenLabel ? (
                    // Always render indicators BELOW the caption (or as a single line if no caption).
                    // This avoids caption/indicator horizontal competition that can cause extreme wrapping.
                    <View style={{ marginTop: 4 }}>
                      {captionText?.length ? (
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
                          ]}
                          mentionStyle={styles.mentionText}
                          onOpenUrl={requestOpenLink}
                          onLongPressLink={handleLongPressMessage}
                        />
                      ) : null}
                      {isEdited || props.seenLabel ? (
                        <View
                          style={[
                            styles.mediaHeaderCaptionIndicators,
                            { marginTop: captionText?.length ? 4 : 0, alignSelf: 'flex-end' },
                          ]}
                        >
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
                              Edited
                            </Text>
                          ) : null}
                          {props.seenLabel ? (
                            <Text
                              style={[
                                styles.seenText,
                                { marginTop: 0 },
                                isOutgoing ? styles.seenTextOutgoing : styles.seenTextIncoming,
                              ]}
                            >
                              {props.seenLabel}
                            </Text>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>

                {renderMediaCarousel || null}
              </View>
              {renderAttachments ? <View style={{ marginTop: 8 }}>{renderAttachments}</View> : null}

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
                          mine
                            ? isDark
                              ? styles.reactionMiniChipMineDark
                              : styles.reactionMiniChipMine
                            : null,
                          idx ? styles.reactionMiniChipStacked : null,
                          pressed ? { opacity: 0.85 } : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.reactionMiniText,
                            isDark ? styles.reactionMiniTextDark : null,
                          ]}
                        >
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
              inlineEditTargetId && item.id === inlineEditTargetId
                ? styles.messageBubbleEditing
                : null,
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

            {!isDeleted && item.replyToMessageId && item.replyToPreview
              ? (() => {
                  const origin = replyOrigin;
                  let thumbUri: string | null = null;
                  let count = 0;
                  let kind: 'image' | 'video' | 'file' = 'file';
                  let firstItem: MediaItem | null = null;
                  try {
                    if (origin && !origin.deletedAt) {
                      const list = (() => {
                        if (origin.encrypted && origin.decryptedText) {
                          const dmEnv = parseDmMediaEnvelope(String(origin.decryptedText || ''));
                          const items = normalizeDmMediaItems(dmEnv);
                          return items.map(({ media }) =>
                            ({
                              path: String(media.path || ''),
                              thumbPath: typeof media.thumbPath === 'string' ? String(media.thumbPath) : undefined,
                              kind:
                                media.kind === 'video'
                                  ? 'video'
                                  : media.kind === 'image'
                                    ? 'image'
                                    : 'file',
                              contentType:
                                typeof media.contentType === 'string' ? String(media.contentType) : undefined,
                              thumbContentType:
                                typeof media.thumbContentType === 'string'
                                  ? String(media.thumbContentType)
                                  : undefined,
                              fileName:
                                typeof media.fileName === 'string' ? String(media.fileName) : undefined,
                              size:
                                typeof media.size === 'number' && Number.isFinite(media.size)
                                  ? media.size
                                  : undefined,
                              durationMs:
                                typeof media.durationMs === 'number' && Number.isFinite(media.durationMs)
                                  ? Math.max(0, Math.floor(media.durationMs))
                                  : undefined,
                            }) as MediaItem,
                          );
                        }
                        if (origin.groupEncrypted && origin.decryptedText) {
                          const gEnv = parseGroupMediaEnvelope(String(origin.decryptedText || ''));
                          const items = normalizeGroupMediaItems(gEnv);
                          return items.map(({ media }) =>
                            ({
                              path: String(media.path || ''),
                              thumbPath: typeof media.thumbPath === 'string' ? String(media.thumbPath) : undefined,
                              kind:
                                media.kind === 'video'
                                  ? 'video'
                                  : media.kind === 'image'
                                    ? 'image'
                                    : 'file',
                              contentType:
                                typeof media.contentType === 'string' ? String(media.contentType) : undefined,
                              thumbContentType:
                                typeof media.thumbContentType === 'string'
                                  ? String(media.thumbContentType)
                                  : undefined,
                              fileName:
                                typeof media.fileName === 'string' ? String(media.fileName) : undefined,
                              size:
                                typeof media.size === 'number' && Number.isFinite(media.size)
                                  ? media.size
                                  : undefined,
                              durationMs:
                                typeof media.durationMs === 'number' && Number.isFinite(media.durationMs)
                                  ? Math.max(0, Math.floor(media.durationMs))
                                  : undefined,
                            }) as MediaItem,
                          );
                        }
                        const env =
                          !origin.encrypted && !origin.groupEncrypted && !isDm
                            ? parseChatEnvelope(origin.rawText ?? origin.text)
                            : null;
                        return env ? normalizeChatMediaList(env.media) : [];
                      })();
                      if (list.length) {
                        count = list.length;
                        const first = list[0];
                        firstItem = first;
                        kind = getPreviewKind(first);
                        const key = String(first.thumbPath || first.path);
                        thumbUri =
                          kind !== 'file'
                            ? origin.encrypted || origin.groupEncrypted
                              ? (first.thumbPath && dmThumbUriByPath[String(first.thumbPath)])
                                ? dmThumbUriByPath[String(first.thumbPath)]
                                : null
                              : mediaUrlByPath[key]
                                ? mediaUrlByPath[key]
                                : null
                            : null;
                      }
                    }
                  } catch {
                    // ignore
                  }
                  const openOriginMedia = () => {
                    if (!origin) return;
                    if (origin.encrypted) return void openDmMediaViewer(origin, 0);
                    if (origin.groupEncrypted) return void openGroupMediaViewer(origin, 0);
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
                          style={({ pressed }) => [
                            styles.replyThumbWrap,
                            pressed ? { opacity: 0.9 } : null,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel="Open replied media"
                        >
                          {thumbUri ? (
                            <Image source={{ uri: thumbUri }} style={styles.replyThumb} />
                          ) : (
                            <View style={[styles.replyThumb, styles.replyThumbPlaceholder]}>
                              {kind === 'file' ? (
                                <MaterialCommunityIcons
                                  name={
                                    ((firstItem ? fileIconNameForMedia(firstItem) : null) ||
                                      'file-outline') as never
                                  }
                                  size={24}
                                  color={
                                    isOutgoing
                                      ? withAlpha(PALETTE.white, 0.92)
                                      : (firstItem ? fileBrandColorForMedia(firstItem) : null) ||
                                        (isDark
                                          ? APP_COLORS.dark.text.primary
                                          : APP_COLORS.light.brand.primary)
                                  }
                                />
                              ) : (
                                <Text style={styles.replyThumbPlaceholderText}>
                                  {kind === 'image' ? 'Photo' : 'Video'}
                                </Text>
                              )}
                            </View>
                          )}
                          {count > 1 ? (
                            <View style={styles.replyThumbCountBadge}>
                              <Text style={styles.replyThumbCountText}>{`+${count - 1}`}</Text>
                            </View>
                          ) : null}
                        </Pressable>
                      ) : null}
                      <View style={{ flex: 1 }}>
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
                          {`Replying to ${replyToLabel}`}
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
                    </View>
                  );
                })()
              : null}

            {(() => {
              const isInlineEditing =
                !!inlineEditTargetId && item.id === inlineEditTargetId && !isDeleted;
              const showTextRow = isInlineEditing || !!displayText?.length;
              if (!showTextRow) return null;
              return (
                <View
                  style={[styles.messageTextRow, isOutgoing ? styles.messageTextRowOutgoing : null]}
                >
                  {isInlineEditing ? (
                    <View style={styles.inlineEditWrap}>
                      <TextInput
                        style={[
                          styles.inlineEditInput,
                          isOutgoing
                            ? [
                                styles.inlineEditInputOutgoing,
                                inlineEditFocused ? styles.inlineEditInputOutgoingFocused : null,
                              ]
                            : styles.inlineEditInputIncoming,
                        ]}
                        value={inlineEditDraft}
                        onChangeText={setInlineEditDraft}
                        multiline
                        autoFocus
                        onFocus={() => setInlineEditFocused(true)}
                        onBlur={() => setInlineEditFocused(false)}
                        placeholder="Add a caption…"
                        placeholderTextColor={
                          isOutgoing
                            ? withAlpha(PALETTE.white, 0.75)
                            : isDark
                              ? APP_COLORS.dark.text.secondary
                              : PALETTE.slate450
                        }
                        editable={!inlineEditUploading}
                        selectionColor={
                          isOutgoing
                            ? withAlpha(PALETTE.white, 0.95)
                            : isDark
                              ? APP_COLORS.dark.text.primary
                              : APP_COLORS.light.text.primary
                        }
                        cursorColor={
                          isOutgoing
                            ? withAlpha(PALETTE.white, 0.95)
                            : isDark
                              ? APP_COLORS.dark.text.primary
                              : APP_COLORS.light.text.primary
                        }
                      />
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
                          accessibilityRole="button"
                          accessibilityLabel="Save edited message"
                        >
                          <Text
                            style={[
                              styles.inlineEditBtnText,
                              isOutgoing
                                ? styles.inlineEditBtnTextOutgoing
                                : styles.inlineEditBtnTextIncoming,
                            ]}
                          >
                            Save
                          </Text>
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
                          accessibilityRole="button"
                          accessibilityLabel="Cancel editing"
                        >
                          <Text
                            style={[
                              styles.inlineEditBtnText,
                              isOutgoing
                                ? styles.inlineEditBtnTextOutgoing
                                : styles.inlineEditBtnTextIncoming,
                            ]}
                          >
                            Cancel
                          </Text>
                        </Pressable>
                      </View>
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
                      onLongPressLink={handleLongPressMessage}
                    />
                  )}

                  {isEdited && !isInlineEditing ? (
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
                  item.id === latestOutgoingMessageId &&
                  !isInlineEditing ? (
                    <Text
                      style={[
                        styles.sendStatusInline,
                        isDark
                          ? styles.sendStatusInlineOutgoingDark
                          : styles.sendStatusInlineOutgoing,
                      ]}
                    >
                      {item.localStatus === 'sending' ? '…' : '✓'}
                    </Text>
                  ) : null}
                </View>
              );
            })()}

            {renderAttachments ? (
              <View
                style={{
                  marginTop:
                    (inlineEditTargetId && item.id === inlineEditTargetId && !isDeleted) ||
                    !!displayText?.length
                      ? 8
                      : 4,
                }}
              >
                {renderAttachments}
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
                        mine
                          ? isDark
                            ? styles.reactionMiniChipMineDark
                            : styles.reactionMiniChipMine
                          : null,
                        idx ? styles.reactionMiniChipStacked : null,
                        pressed ? { opacity: 0.85 } : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.reactionMiniText,
                          isDark ? styles.reactionMiniTextDark : null,
                        ]}
                      >
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
