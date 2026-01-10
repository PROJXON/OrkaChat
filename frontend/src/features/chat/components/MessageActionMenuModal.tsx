import React from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  normalizeChatMediaList,
  normalizeDmMediaItems,
  normalizeGroupMediaItems,
  parseChatEnvelope,
  parseDmMediaEnvelope,
  parseGroupMediaEnvelope,
} from '../parsers';

type Props = {
  visible: boolean;
  isDark: boolean;
  styles: Record<string, any>;

  insets: { top: number; bottom: number };
  anchor: { x: number; y: number } | null;

  anim: any;
  measuredH: number;
  measuredHRef: React.MutableRefObject<number>;
  onMeasuredH: (h: number) => void;

  target: any | null;
  myUserId: string | null | undefined;
  myPublicKey: string | null | undefined;
  displayName: string;
  isDm: boolean;

  encryptedPlaceholder: string;
  normalizeUser: (v: unknown) => string;

  mediaUrlByPath: Record<string, string>;
  dmThumbUriByPath: Record<string, string>;

  quickReactions: string[];

  blockedSubsSet: Set<string>;
  onBlockUserSub?: ((blockedSub: string, label?: string) => void | Promise<void>) | undefined;
  uiConfirm: (
    title: string,
    message: string,
    opts: { confirmText: string; cancelText: string; destructive?: boolean },
  ) => Promise<boolean>;
  showAlert: (title: string, body: string) => void;

  close: () => void;
  sendReaction: (msg: any, emoji: string) => void;
  openReactionPicker: (msg: any) => void;

  setCipherText: (t: string) => void;
  setCipherOpen: (v: boolean) => void;

  beginReply: (msg: any) => void;
  beginInlineEdit: (msg: any) => void;
  setInlineEditAttachmentMode: (m: 'keep' | 'replace' | 'remove') => void;
  handlePickMedia: () => void;
  clearPendingMedia: () => void;

  deleteForMe: (msg: any) => void | Promise<void>;
  sendDeleteForEveryone: () => void | Promise<void>;
  openReportForMessage: (msg: any) => void;
};

export function MessageActionMenuModal({
  visible,
  isDark,
  styles,
  insets,
  anchor,
  anim,
  measuredH,
  measuredHRef,
  onMeasuredH,
  target,
  myUserId,
  myPublicKey,
  displayName,
  isDm,
  encryptedPlaceholder,
  normalizeUser,
  mediaUrlByPath,
  dmThumbUriByPath,
  quickReactions,
  blockedSubsSet,
  onBlockUserSub,
  uiConfirm,
  showAlert,
  close,
  sendReaction,
  openReactionPicker,
  setCipherText,
  setCipherOpen,
  beginReply,
  beginInlineEdit,
  setInlineEditAttachmentMode,
  handlePickMedia,
  clearPendingMedia,
  deleteForMe,
  sendDeleteForEveryone,
  openReportForMessage,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.actionMenuOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <Animated.View
          style={[
            styles.actionMenuCard,
            isDark ? styles.actionMenuCardDark : null,
            (() => {
              const vv = Platform.OS === 'web' && typeof window !== 'undefined' ? (window as any).visualViewport : null;
              // On web, prefer the *visual viewport* (handles mobile browser toolbars/URL bar correctly).
              const w = (vv && typeof vv.width === 'number' ? vv.width : null) ?? Dimensions.get('window').width;
              const h = (vv && typeof vv.height === 'number' ? vv.height : null) ?? Dimensions.get('window').height;
              const cardW = Math.min(w - 36, 360);
              const left = Math.max(18, (w - cardW) / 2);
              const anchorY = anchor?.y ?? h / 2;
              const safeTop = Math.max(12, 12 + (insets.top || 0));
              // Web often reports 0 bottom insets; keep a comfortable bottom margin anyway.
              const safeBottom = Math.max(12, 12 + (insets.bottom || 0) + (Platform.OS === 'web' ? 16 : 0));
              // Reposition-only (no scrolling): clamp the card so it stays fully visible.
              // Use a best-effort measured height when available, otherwise fall back to a conservative estimate.
              const cardH = Math.max(220, Math.floor(measuredH || measuredHRef.current || 360));
              const desiredTop = anchorY - 160;
              const minTop = safeTop;
              const maxTop = Math.max(minTop, Math.floor(h - safeBottom - cardH));
              const top = Math.max(minTop, Math.min(maxTop, desiredTop));
              const maxH = Math.max(220, Math.floor(h - safeTop - safeBottom));
              return { position: 'absolute', width: cardW, left, top, maxHeight: maxH };
            })(),
            {
              opacity: anim,
              transform: [
                {
                  scale: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.98, 1],
                  }),
                },
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [(anchor?.y ?? 0) > Dimensions.get('window').height / 2 ? 10 : -10, 0],
                  }),
                },
              ],
            },
          ]}
          onLayout={(e) => {
            try {
              const h = Number(e?.nativeEvent?.layout?.height ?? 0);
              if (Number.isFinite(h) && h > 0) onMeasuredH(h);
            } catch {
              // ignore
            }
          }}
        >
          {/* Message preview (Signal-style) */}
          {target ? (
            <View style={[styles.actionMenuPreviewRow, isDark ? styles.actionMenuPreviewRowDark : null]}>
              {(() => {
                const t = target;
                const isOutgoingByUserSub = !!myUserId && !!t.userSub && String(t.userSub) === String(myUserId);
                const isEncryptedOutgoing =
                  !!t.encrypted && !!myPublicKey && t.encrypted.senderPublicKey === myPublicKey;
                const isPlainOutgoing =
                  !t.encrypted &&
                  (isOutgoingByUserSub
                    ? true
                    : normalizeUser(t.userLower ?? t.user ?? 'anon') === normalizeUser(displayName));
                const isOutgoing = isOutgoingByUserSub || isEncryptedOutgoing || isPlainOutgoing;
                const bubbleStyle = isOutgoing ? styles.messageBubbleOutgoing : styles.messageBubbleIncoming;
                const textStyle = isOutgoing ? styles.messageTextOutgoing : styles.messageTextIncoming;
                if (t.deletedAt) {
                  return (
                    <View style={[styles.messageBubble, bubbleStyle]}>
                      <Text style={[styles.messageText, textStyle]}>This message has been deleted</Text>
                    </View>
                  );
                }

                let caption = '';
                let thumbUri: string | null = null;
                let kind: 'image' | 'video' | 'file' | null = null;
                let hasMedia = false;
                let mediaCount = 0;

                if (t.encrypted || t.groupEncrypted) {
                  if (!t.decryptedText) {
                    return (
                      <View style={[styles.messageBubble, bubbleStyle]}>
                        <Text style={[styles.messageText, textStyle]}>{encryptedPlaceholder}</Text>
                      </View>
                    );
                  }
                  const plain = String(t.decryptedText || '');
                  const dmEnv = parseDmMediaEnvelope(plain);
                  const dmItems = dmEnv ? normalizeDmMediaItems(dmEnv) : [];
                  const gEnv = parseGroupMediaEnvelope(plain);
                  const gItems = gEnv ? normalizeGroupMediaItems(gEnv) : [];
                  if (dmItems.length || gItems.length) {
                    hasMedia = true;
                    mediaCount = dmItems.length || gItems.length || 0;
                    caption = String((dmEnv?.caption ?? gEnv?.caption) || '');
                    const first = (dmItems[0]?.media ?? gItems[0]?.media) as any;
                    kind = (first.kind as any) || 'file';
                    // Reuse decrypted thumb cache so message options show actual previews.
                    if (first && first.thumbPath && dmThumbUriByPath[String(first.thumbPath)]) {
                      thumbUri = dmThumbUriByPath[String(first.thumbPath)];
                    } else {
                      thumbUri = null;
                    }
                  } else {
                    caption = plain;
                  }
                } else {
                  const raw = String(t.rawText ?? t.text ?? '');
                  const env = !isDm ? parseChatEnvelope(raw) : null;
                  const envList = env ? normalizeChatMediaList(env.media) : [];
                  if (envList.length) {
                    hasMedia = true;
                    mediaCount = envList.length || 0;
                    caption = String(env?.text || '');
                    const first = envList[0];
                    kind = (first.kind as any) || 'file';
                    const key = String(first.thumbPath || first.path);
                    thumbUri = mediaUrlByPath[key] ? mediaUrlByPath[key] : null;
                  } else {
                    caption = raw;
                  }
                }

                if (!hasMedia) {
                  return (
                    <View style={[styles.messageBubble, bubbleStyle]}>
                      <Text style={[styles.messageText, textStyle]}>{caption}</Text>
                    </View>
                  );
                }

                const label = kind === 'image' ? 'Photo' : kind === 'video' ? 'Video' : 'Attachment';
                const multiLabel = mediaCount > 1 ? `${label} · ${mediaCount} attachments` : label;
                return (
                  <View style={styles.actionMenuMediaPreview}>
                    <View style={styles.actionMenuMediaThumbWrap}>
                      {thumbUri ? (
                        <Image source={{ uri: thumbUri }} style={styles.actionMenuMediaThumb} resizeMode="cover" />
                      ) : (
                        <View style={styles.actionMenuMediaThumbPlaceholder}>
                          <Text style={styles.actionMenuMediaThumbPlaceholderText}>{label}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.actionMenuMediaMeta, isDark ? styles.actionMenuMediaMetaDark : null]}>
                      {multiLabel}
                    </Text>
                    {caption.trim().length ? (
                      <Text style={[styles.actionMenuMediaCaption, isDark ? styles.actionMenuMediaCaptionDark : null]}>
                        {caption.trim()}
                      </Text>
                    ) : null}
                  </View>
                );
              })()}
            </View>
          ) : null}

          <ScrollView
            style={styles.actionMenuOptionsScroll}
            contentContainerStyle={styles.actionMenuOptionsContent}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
          >
            {/* Reactions */}
            {target && !target.deletedAt && (!target.encrypted || !!target.decryptedText) ? (
              <View style={styles.reactionQuickRow}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.reactionQuickScrollContent}
                >
                  {quickReactions.map((emoji) => {
                    const mine = myUserId ? (target.reactions?.[emoji]?.userSubs || []).includes(myUserId) : false;
                    return (
                      <Pressable
                        key={`quick:${emoji}`}
                        onPress={() => {
                          sendReaction(target, emoji);
                          close();
                        }}
                        style={({ pressed }) => [
                          styles.reactionQuickBtn,
                          isDark ? styles.reactionQuickBtnDark : null,
                          mine ? (isDark ? styles.reactionQuickBtnMineDark : styles.reactionQuickBtnMine) : null,
                          pressed ? { opacity: 0.85 } : null,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`React ${emoji}`}
                      >
                        <Text style={styles.reactionQuickEmoji}>{emoji}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <Pressable
                  onPress={() => {
                    openReactionPicker(target);
                    close();
                  }}
                  style={({ pressed }) => [
                    styles.reactionQuickMore,
                    isDark ? styles.reactionQuickMoreDark : null,
                    pressed ? { opacity: 0.85 } : null,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="More reactions"
                >
                  <Text style={[styles.reactionQuickMoreText, isDark ? styles.reactionQuickMoreTextDark : null]}>
                    …
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {target?.encrypted || target?.groupEncrypted ? (
              <Pressable
                onPress={() => {
                  setCipherText(String(target?.rawText ?? target?.text ?? ''));
                  setCipherOpen(true);
                  close();
                }}
                style={({ pressed }) => [styles.actionMenuRow, pressed ? styles.actionMenuRowPressed : null]}
              >
                <Text style={[styles.actionMenuText, isDark ? styles.actionMenuTextDark : null]}>View Ciphertext</Text>
              </Pressable>
            ) : null}

            {target && !target.deletedAt ? (
              <Pressable
                onPress={() => beginReply(target)}
                style={({ pressed }) => [styles.actionMenuRow, pressed ? styles.actionMenuRowPressed : null]}
              >
                <Text style={[styles.actionMenuText, isDark ? styles.actionMenuTextDark : null]}>Reply</Text>
              </Pressable>
            ) : null}

            {(() => {
              const t = target;
              if (!t) return null;
              const isOutgoingByUserSub = !!myUserId && !!t.userSub && String(t.userSub) === String(myUserId);
              const isEncryptedOutgoing = !!t.encrypted && !!myPublicKey && t.encrypted.senderPublicKey === myPublicKey;
              const isPlainOutgoing =
                !t.encrypted &&
                (isOutgoingByUserSub
                  ? true
                  : normalizeUser(t.userLower ?? t.user ?? 'anon') === normalizeUser(displayName));
              const canEdit = isOutgoingByUserSub || isEncryptedOutgoing || isPlainOutgoing;
              if (!canEdit) return null;
              const hasMedia = (() => {
                if (t.deletedAt) return false;
                if (t.encrypted) {
                  if (!t.decryptedText) return false;
                  const dmEnv = parseDmMediaEnvelope(String(t.decryptedText));
                  return !!(dmEnv && normalizeDmMediaItems(dmEnv).length);
                }
                if (isDm) return false;
                const env = parseChatEnvelope(String(t.rawText ?? t.text ?? ''));
                return !!(env && normalizeChatMediaList(env.media).length);
              })();
              return (
                <>
                  {!hasMedia ? (
                    <Pressable
                      onPress={() => {
                        setInlineEditAttachmentMode('replace');
                        beginInlineEdit(t);
                        handlePickMedia();
                      }}
                      style={({ pressed }) => [styles.actionMenuRow, pressed ? styles.actionMenuRowPressed : null]}
                    >
                      <Text style={[styles.actionMenuText, isDark ? styles.actionMenuTextDark : null]}>
                        Add attachment
                      </Text>
                    </Pressable>
                  ) : null}

                  {hasMedia ? (
                    <Pressable
                      onPress={() => {
                        setInlineEditAttachmentMode('replace');
                        beginInlineEdit(t);
                        handlePickMedia();
                      }}
                      style={({ pressed }) => [styles.actionMenuRow, pressed ? styles.actionMenuRowPressed : null]}
                    >
                      <Text style={[styles.actionMenuText, isDark ? styles.actionMenuTextDark : null]}>
                        Replace attachment
                      </Text>
                    </Pressable>
                  ) : null}

                  {hasMedia ? (
                    <Pressable
                      onPress={() => {
                        setInlineEditAttachmentMode('remove');
                        clearPendingMedia();
                        beginInlineEdit(t);
                      }}
                      style={({ pressed }) => [styles.actionMenuRow, pressed ? styles.actionMenuRowPressed : null]}
                    >
                      <Text style={[styles.actionMenuText, isDark ? styles.actionMenuTextDark : null]}>
                        Remove attachment
                      </Text>
                    </Pressable>
                  ) : null}

                  <Pressable
                    onPress={() => {
                      setInlineEditAttachmentMode('keep');
                      beginInlineEdit(t);
                    }}
                    style={({ pressed }) => [styles.actionMenuRow, pressed ? styles.actionMenuRowPressed : null]}
                  >
                    <Text style={[styles.actionMenuText, isDark ? styles.actionMenuTextDark : null]}>Edit</Text>
                  </Pressable>
                </>
              );
            })()}

            {(() => {
              const t = target;
              const sub = t?.userSub ? String(t.userSub) : '';
              const label = t?.user ? String(t.user) : '';
              const isMe = !!myUserId && !!sub && String(sub) === String(myUserId);
              const alreadyBlocked = !!sub && blockedSubsSet.has(sub);
              if (!t || !sub || isMe || alreadyBlocked || typeof onBlockUserSub !== 'function') return null;
              return (
                <Pressable
                  onPress={async () => {
                    close();
                    try {
                      const ok = await uiConfirm(
                        'Block user?',
                        `Block ${label ? `"${label}"` : 'this user'}?\n\nYou won’t see their messages, and they won’t be able to DM you.\n\nYou can unblock them later from your Blocklist.`,
                        { confirmText: 'Block', cancelText: 'Cancel', destructive: true },
                      );
                      if (!ok) return;
                      await Promise.resolve(onBlockUserSub(sub, label));
                      showAlert('Blocked', 'User blocked. Their messages will be hidden.');
                    } catch (e: any) {
                      showAlert('Block failed', e?.message ?? 'Failed to block user');
                    }
                  }}
                  style={({ pressed }) => [styles.actionMenuRow, pressed ? styles.actionMenuRowPressed : null]}
                >
                  <Text style={[styles.actionMenuText, isDark ? styles.actionMenuTextDark : null]}>Block user</Text>
                </Pressable>
              );
            })()}

            <Pressable
              onPress={() => {
                if (!target) return;
                void Promise.resolve(deleteForMe(target));
                close();
              }}
              style={({ pressed }) => [styles.actionMenuRow, pressed ? styles.actionMenuRowPressed : null]}
            >
              <Text style={[styles.actionMenuText, isDark ? styles.actionMenuTextDark : null]}>Delete for me</Text>
            </Pressable>

            {(() => {
              const t = target;
              if (!t) return null;
              const isOutgoingByUserSub = !!myUserId && !!t.userSub && String(t.userSub) === String(myUserId);
              const isEncryptedOutgoing = !!t.encrypted && !!myPublicKey && t.encrypted.senderPublicKey === myPublicKey;
              const isPlainOutgoing =
                !t.encrypted &&
                (isOutgoingByUserSub
                  ? true
                  : normalizeUser(t.userLower ?? t.user ?? 'anon') === normalizeUser(displayName));
              const canDeleteForEveryone = isOutgoingByUserSub || isEncryptedOutgoing || isPlainOutgoing;
              if (!canDeleteForEveryone) return null;
              return (
                <Pressable
                  onPress={() => {
                    void Promise.resolve(sendDeleteForEveryone());
                    close();
                  }}
                  style={({ pressed }) => [styles.actionMenuRow, pressed ? styles.actionMenuRowPressed : null]}
                >
                  <Text style={[styles.actionMenuText, isDark ? styles.actionMenuTextDark : null]}>
                    Delete for everyone
                  </Text>
                </Pressable>
              );
            })()}

            <Pressable
              onPress={() => {
                if (!target) return;
                openReportForMessage(target);
                close();
              }}
              style={({ pressed }) => [styles.actionMenuRow, pressed ? styles.actionMenuRowPressed : null]}
            >
              <Text style={[styles.actionMenuText, isDark ? styles.actionMenuTextDark : null]}>Report…</Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
