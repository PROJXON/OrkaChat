import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Image, Platform, Pressable, Text, TextInput, View } from 'react-native';

import { AnimatedDots } from '../../../components/AnimatedDots';
import type { ChatScreenStyles } from '../../../screens/ChatScreen.styles';
import { APP_COLORS, PALETTE } from '../../../theme/colors';
import type { MediaItem } from '../../../types/media';
import type { PendingMediaItem } from '../attachments';
import { normalizeChatMediaList, parseChatEnvelope } from '../parsers';
import type { ChatMessage } from '../types';

type ReplyTarget = null | {
  id: string;
  createdAt: number;
  user?: string;
  userSub?: string;
  preview: string;
  mediaKind?: 'image' | 'video' | 'file';
  mediaCount?: number;
  mediaThumbUri?: string | null;
};

export function ChatComposer(props: {
  styles: ChatScreenStyles;
  isDark: boolean;
  isDm: boolean;
  isGroup: boolean;
  isEncryptedChat: boolean;
  groupMeta: null | { groupId: string; groupName?: string; meIsAdmin: boolean; meStatus: string };

  // Inline edit bar
  inlineEditTargetId: string | null;
  inlineEditUploading: boolean;
  cancelInlineEdit: () => void;

  // Attachment pill
  pendingMedia: PendingMediaItem[];
  setPendingMedia: (next: PendingMediaItem[]) => void;
  isUploading: boolean;

  // Reply pill
  replyTarget: ReplyTarget;
  setReplyTarget: (v: ReplyTarget) => void;
  messages: ChatMessage[];
  openViewer: (mediaList: MediaItem[], startIdx: number) => void;

  // Typing indicator
  typingIndicatorText: string;
  TypingIndicator: React.ComponentType<{ text: string; color: string }>;
  typingColor: string;

  // Mention suggestions
  mentionSuggestions: string[];
  insertMention: (u: string) => void;

  // Composer container styles
  composerSafeAreaStyle: StyleProp<ViewStyle>;
  composerHorizontalInsetsStyle: StyleProp<ViewStyle>;
  // Android-only: height of the bottom system inset to paint behind the composer.
  // This should NOT affect layout height; it's only for background coverage.
  composerBottomInsetBgHeight?: number;
  // Android-only: remaining keyboard overlap to lift composer by.
  androidKeyboardLift?: number;
  isWideChatLayout: boolean;

  // Input
  textInputRef: React.MutableRefObject<TextInput | null>;
  inputEpoch: number;
  input: string;
  onChangeInput: (t: string) => void;
  isTypingRef: React.MutableRefObject<boolean>;
  sendTyping: (isTyping: boolean) => void;
  sendMessage: () => void;

  // Media picker
  handlePickMedia: () => void;
}): React.JSX.Element {
  const {
    styles,
    isDark,
    isDm,
    isGroup,
    isEncryptedChat,
    groupMeta,
    inlineEditTargetId,
    inlineEditUploading: _inlineEditUploading,
    cancelInlineEdit: _cancelInlineEdit,
    pendingMedia,
    setPendingMedia,
    isUploading,
    replyTarget,
    setReplyTarget,
    messages,
    openViewer,
    typingIndicatorText,
    TypingIndicator,
    typingColor,
    mentionSuggestions,
    insertMention,
    composerSafeAreaStyle,
    composerHorizontalInsetsStyle,
    composerBottomInsetBgHeight,
    androidKeyboardLift,
    isWideChatLayout,
    textInputRef,
    inputEpoch,
    input,
    onChangeInput,
    isTypingRef,
    sendTyping,
    sendMessage,
    handlePickMedia,
  } = props;

  return (
    <>
      {pendingMedia.length ? (
        <View
          style={[
            isWideChatLayout ? styles.chatContentColumn : null,
            composerHorizontalInsetsStyle,
          ]}
        >
          <Pressable
            style={[
              styles.attachmentPill,
              isDark ? styles.attachmentPillDark : null,
              // This pill is rendered outside the composer row; constrain it like the composer controls.
              { marginHorizontal: 0 },
            ]}
            onPress={() => setPendingMedia([])}
            disabled={isUploading}
          >
            <Text
              style={[styles.attachmentPillText, isDark ? styles.attachmentPillTextDark : null]}
            >
              {pendingMedia.length === 1
                ? `Attached: ${pendingMedia[0].displayName || pendingMedia[0].fileName || pendingMedia[0].kind} (tap to remove)`
                : `Attached: ${pendingMedia.length} items (tap to remove)`}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {replyTarget ? (
        <View
          style={[
            isWideChatLayout ? styles.chatContentColumn : null,
            composerHorizontalInsetsStyle,
          ]}
        >
          <View
            style={[
              styles.attachmentPill,
              isDark ? styles.attachmentPillDark : null,
              { flexDirection: 'row', alignItems: 'center', marginHorizontal: 0 },
            ]}
          >
            {replyTarget.mediaCount ? (
              <Pressable
                onPress={() => {
                  // Best-effort: open the original target if it's in memory.
                  const t = messages.find((m) => m && m.id === replyTarget.id);
                  if (!t) return;
                  const raw = String(t.rawText ?? t.text ?? '');
                  const env =
                    !t.encrypted && !t.groupEncrypted && !isDm ? parseChatEnvelope(raw) : null;
                  const envList = env ? normalizeChatMediaList(env.media) : [];
                  if (!envList.length) return;
                  openViewer(envList, 0);
                }}
                style={({ pressed }) => [
                  styles.replyThumbWrap,
                  { marginRight: 10 },
                  pressed ? { opacity: 0.9 } : null,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Open replied media"
              >
                {replyTarget.mediaThumbUri ? (
                  <Image source={{ uri: replyTarget.mediaThumbUri }} style={styles.replyThumb} />
                ) : (
                  <View style={[styles.replyThumb, styles.replyThumbPlaceholder]}>
                    <Text style={styles.replyThumbPlaceholderText}>
                      {replyTarget.mediaKind === 'image'
                        ? 'Photo'
                        : replyTarget.mediaKind === 'video'
                          ? 'Video'
                          : 'File'}
                    </Text>
                  </View>
                )}
                {(replyTarget.mediaCount || 0) > 1 ? (
                  <View style={styles.replyThumbCountBadge}>
                    <Text
                      style={styles.replyThumbCountText}
                    >{`+${(replyTarget.mediaCount || 0) - 1}`}</Text>
                  </View>
                ) : null}
              </Pressable>
            ) : null}
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.attachmentPillText, isDark ? styles.attachmentPillTextDark : null]}
                numberOfLines={2}
              >
                {`Replying to ${replyTarget.user || 'user'}: ${replyTarget.preview || ''}`}
              </Text>
            </View>
            <Pressable
              onPress={() => setReplyTarget(null)}
              style={({ pressed }) => [
                {
                  marginLeft: 10,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Cancel reply"
            >
              <Text
                style={[styles.attachmentPillText, isDark ? styles.attachmentPillTextDark : null]}
              >
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {typingIndicatorText ? (
        <View style={styles.typingRow}>
          <TypingIndicator text={typingIndicatorText} color={typingColor} />
        </View>
      ) : null}

      {mentionSuggestions.length && !isEncryptedChat && !inlineEditTargetId ? (
        <View
          style={[
            isWideChatLayout ? styles.chatContentColumn : null,
            composerHorizontalInsetsStyle,
            { marginTop: 8, marginBottom: 2 },
          ]}
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {mentionSuggestions.map((u) => (
            <Pressable
              key={`mention-suggest:${u}`}
              onPress={() => insertMention(u)}
              style={({ pressed }) => ({
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: isDark ? PALETTE.slate750 : PALETTE.mist,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text
                style={{
                  color: isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary,
                  fontWeight: '800',
                }}
              >
                @{u}
              </Text>
            </Pressable>
          ))}
          </View>
        </View>
      ) : null}

      <View
        style={[
          styles.inputRow,
          isDark ? styles.inputRowDark : null,
          // Fill the safe area with the bar background, but keep the inner content vertically centered.
          composerSafeAreaStyle,
          { position: 'relative' },
          Platform.OS === 'android' && androidKeyboardLift && androidKeyboardLift > 0
            ? { marginBottom: androidKeyboardLift }
            : null,
        ]}
      >
        {composerBottomInsetBgHeight && composerBottomInsetBgHeight > 0 ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: -composerBottomInsetBgHeight,
              height: composerBottomInsetBgHeight,
              backgroundColor: isDark ? APP_COLORS.dark.bg.header : APP_COLORS.light.bg.surface2,
            }}
          />
        ) : null}
        <View
          style={[
            styles.inputRowInner,
            isWideChatLayout ? styles.chatContentColumn : null,
            // Ensure the content never hugs the screen edges (safe area + consistent gutter).
            composerHorizontalInsetsStyle,
          ]}
        >
          <Pressable
            style={[
              styles.pickBtn,
              isDark ? styles.pickBtnDark : null,
              isUploading || inlineEditTargetId || (isGroup && groupMeta?.meStatus !== 'active')
                ? isDark
                  ? styles.btnDisabledDark
                  : styles.btnDisabled
                : null,
            ]}
            onPress={handlePickMedia}
            disabled={
              isUploading || !!inlineEditTargetId || (isGroup && groupMeta?.meStatus !== 'active')
            }
          >
            <Text style={[styles.pickTxt, isDark ? styles.pickTxtDark : null]}>＋</Text>
          </Pressable>

          <TextInput
            ref={(r) => {
              textInputRef.current = r;
            }}
            key={`chat-input-${inputEpoch}`}
            style={[styles.input, isDark ? styles.inputDark : null]}
            // Keep the composer baseline stable across devices (prevents occasional clipping).
            allowFontScaling={false}
            underlineColorAndroid="transparent"
            placeholder={
              inlineEditTargetId
                ? 'Finish editing above…'
                : isGroup && groupMeta?.meStatus !== 'active'
                  ? 'Read‑only (left group)'
                  : pendingMedia.length
                    ? 'Add a caption (optional)…'
                    : 'Type a message'
            }
            placeholderTextColor={isDark ? PALETTE.slate400 : PALETTE.slate350}
            selectionColor={isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary}
            cursorColor={isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary}
            value={input}
            onChangeText={onChangeInput}
            editable={
              !inlineEditTargetId && !isUploading && !(isGroup && groupMeta?.meStatus !== 'active')
            }
            onBlur={() => {
              if (isTypingRef.current) sendTyping(false);
            }}
            onSubmitEditing={sendMessage}
            returnKeyType="send"
          />

          <Pressable
            style={[
              styles.sendBtn,
              isDark ? styles.sendBtnDark : null,
              isUploading
                ? isDark
                  ? styles.sendBtnUploadingDark
                  : styles.sendBtnUploading
                : inlineEditTargetId || (isGroup && groupMeta?.meStatus !== 'active')
                  ? isDark
                    ? styles.btnDisabledDark
                    : styles.btnDisabled
                  : null,
            ]}
            onPress={sendMessage}
            disabled={
              isUploading || !!inlineEditTargetId || (isGroup && groupMeta?.meStatus !== 'active')
            }
          >
            {isUploading ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                }}
              >
                <Text style={{ color: APP_COLORS.dark.text.primary, fontWeight: '800' }}>
                  Uploading
                </Text>
                <AnimatedDots color={APP_COLORS.dark.text.primary} size={18} />
              </View>
            ) : (
              <Text style={[styles.sendTxt, isDark ? styles.sendTxtDark : null]}>Send</Text>
            )}
          </Pressable>
        </View>
      </View>
    </>
  );
}
