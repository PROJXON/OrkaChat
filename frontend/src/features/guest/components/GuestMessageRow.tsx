import React from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AvatarBubble } from '../../../components/AvatarBubble';
import { AudioAttachmentTile } from '../../../components/media/AudioAttachmentTile';
import { AttachmentTilesList } from '../../../components/media/AttachmentTilesList';
import { FileAttachmentTile } from '../../../components/media/FileAttachmentTile';
import { MediaStackCarousel } from '../../../components/MediaStackCarousel';
import { RichText } from '../../../components/RichText';
import { APP_COLORS, PALETTE, withAlpha } from '../../../theme/colors';
import type { MediaItem } from '../../../types/media';
import { audioTitleFromFileName } from '../../chat/audioPlaybackQueue';
import { isPreviewableMedia } from '../../../utils/mediaKinds';
import { calcCappedMediaSize } from '../../../utils/mediaSizing';
import { resolveMediaUrlWithFallback } from '../../../utils/resolveMediaUrl';
import { saveMediaUrlToDevice } from '../../../utils/saveMediaToDevice';
import { formatGuestTimestamp } from '../parsers';
import type { GuestMessage } from '../types';

export function GuestMessageRow({
  item,
  isDark,
  onOpenUrl,
  resolvePathUrl,
  onOpenReactionInfo,
  onOpenViewer,
  audioPlayback,
  avatarSize,
  avatarGutter,
  avatarSeed,
  avatarImageUri,
  avatarBgColor,
  avatarTextColor,
  showAvatar,
  viewportWidth,
}: {
  item: GuestMessage;
  isDark: boolean;
  onOpenUrl: (url: string) => void;
  resolvePathUrl: (path: string) => Promise<string | null>;
  onOpenReactionInfo: (emoji: string, subs: string[], namesBySub?: Record<string, string>) => void;
  onOpenViewer: (mediaList: MediaItem[], startIdx: number) => void;
  audioPlayback?: {
    currentKey: string | null;
    loadingKey: string | null;
    isPlaying: boolean;
    positionMs: number;
    durationMs: number | null;
    toggle: (key: string) => Promise<void>;
    seek: (ms: number) => Promise<void>;
    seekFor: (key: string, ms: number) => Promise<void>;
    getKey: (msgId: string, idx: number, media: MediaItem) => string;
    onPress: (key: string) => void | Promise<void>;
  };
  avatarSize: number;
  avatarGutter: number;
  avatarSeed: string;
  avatarImageUri?: string;
  avatarBgColor?: string;
  avatarTextColor?: string;
  showAvatar: boolean;
  viewportWidth: number;
}): React.JSX.Element {
  const isSystem =
    String(item?.user || '')
      .trim()
      .toLowerCase() === 'system';

  const AVATAR_TOP_OFFSET = 4;
  const [thumbUrl, setThumbUrl] = React.useState<string | null>(null);
  const [usedFullUrl, setUsedFullUrl] = React.useState<boolean>(false);
  const [thumbAspect, setThumbAspect] = React.useState<number | null>(null);
  const [thumbUriByPath, setThumbUriByPath] = React.useState<Record<string, string>>({});
  const [aspectByPath, setAspectByPath] = React.useState<Record<string, number>>({});

  const mediaList = React.useMemo(
    () => item.mediaList ?? (item.media ? [item.media] : []),
    [item.mediaList, item.media],
  );
  const previewableWithIdx = React.useMemo(
    () => mediaList.map((m, idx) => ({ m, idx })).filter(({ m }) => isPreviewableMedia(m)),
    [mediaList],
  );
  const primaryPreviewable = previewableWithIdx.length ? previewableWithIdx[0].m : null;
  const fileLikeWithIdx = React.useMemo(
    () => mediaList.map((m, idx) => ({ m, idx })).filter(({ m }) => !isPreviewableMedia(m)),
    [mediaList],
  );
  const extraCount = Math.max(0, mediaList.length - 1);

  // For multi-media previews, resolve thumb URLs for each page so the carousel can render immediately.
  React.useEffect(() => {
    if (isSystem) return;
    if (!Array.isArray(mediaList) || mediaList.length <= 1) return;
    let cancelled = false;
    (async () => {
      for (const m of mediaList) {
        if (cancelled) return;
        const preferredPath = m?.thumbPath || m?.path;
        if (!preferredPath) continue;
        if (thumbUriByPath[preferredPath]) continue;
        const u = await resolveMediaUrlWithFallback(resolvePathUrl, preferredPath, m?.path);
        if (!u) continue;
        if (cancelled) return;
        setThumbUriByPath((prev) => (prev[preferredPath] ? prev : { ...prev, [preferredPath]: u }));
        if (m?.path && m.path !== preferredPath) {
          setThumbUriByPath((prev) => (prev[m.path] ? prev : { ...prev, [m.path]: u! }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSystem, mediaList, resolvePathUrl, thumbUriByPath]);

  React.useEffect(() => {
    if (isSystem) return;
    let cancelled = false;
    (async () => {
      const preferredPath = primaryPreviewable?.thumbPath || primaryPreviewable?.path;
      if (!preferredPath) return;
      const u = await resolveMediaUrlWithFallback(
        resolvePathUrl,
        preferredPath,
        primaryPreviewable?.path,
      );
      if (!cancelled) setThumbUrl(u);
    })();
    return () => {
      cancelled = true;
    };
  }, [isSystem, primaryPreviewable?.path, primaryPreviewable?.thumbPath, resolvePathUrl]);

  React.useEffect(() => {
    if (isSystem) return;
    if (!thumbUrl) return;
    let cancelled = false;
    Image.getSize(
      thumbUrl,
      (w, h) => {
        if (cancelled) return;
        const aspect = w > 0 && h > 0 ? w / h : 1;
        setThumbAspect(Number.isFinite(aspect) ? aspect : 1);
      },
      () => {
        if (!cancelled) setThumbAspect(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [isSystem, thumbUrl]);

  // For web guest, reliably compute per-page aspect ratios for all previewable media so the carousel
  // can choose contain vs cover even when onLoad events don't expose intrinsic dimensions.
  React.useEffect(() => {
    if (isSystem) return;
    if (!previewableWithIdx.length) return;
    if (mediaList.length <= 1) return;
    let cancelled = false;
    const inFlight = new Set<string>();

    previewableWithIdx.forEach(({ m }) => {
      const keyPath = String(m?.thumbPath || m?.path || '').trim();
      if (!keyPath) return;
      const url = thumbUriByPath[keyPath];
      if (!url) return;
      if (aspectByPath[keyPath]) return;
      if (inFlight.has(keyPath)) return;
      inFlight.add(keyPath);
      Image.getSize(
        url,
        (w, h) => {
          if (cancelled) return;
          const aspect = w > 0 && h > 0 ? w / h : 0;
          if (!(aspect > 0) || !Number.isFinite(aspect)) return;
          setAspectByPath((prev) => (prev[keyPath] ? prev : { ...prev, [keyPath]: aspect }));
        },
        () => {
          // ignore
        },
      );
    });

    return () => {
      cancelled = true;
    };
  }, [aspectByPath, isSystem, mediaList.length, previewableWithIdx, thumbUriByPath]);

  const hasMedia = previewableWithIdx.length > 0;
  const ts = formatGuestTimestamp(item.createdAt);
  const metaLine = `${item.user}${ts ? ` · ${ts}` : ''}`;
  const isEdited = typeof item.editedAt === 'number' && Number.isFinite(item.editedAt);
  const captionHasText = !!item.text && item.text.trim().length > 0;

  const reactionEntriesVisible = React.useMemo(() => {
    const entries = item.reactions ? Object.entries(item.reactions) : [];
    return entries.sort((a, b) => (b[1]?.count ?? 0) - (a[1]?.count ?? 0)).slice(0, 3);
  }, [item.reactions]);

  const onThumbError = React.useCallback(async () => {
    // Common cases:
    // - thumb object doesn't exist
    // - S3 returns 403 because guest read policy isn't deployed yet
    // Try the full object as a fallback (especially useful if only the thumb is missing).
    if (usedFullUrl) return;
    const fullPath = primaryPreviewable?.path;
    if (!fullPath) return;
    const u = await resolveMediaUrlWithFallback(resolvePathUrl, fullPath, null);
    if (u) {
      setUsedFullUrl(true);
      setThumbUrl(u);
      return;
    }
    // If we couldn't resolve anything, drop the preview so we fall back to a file chip.
    setThumbUrl(null);
  }, [primaryPreviewable?.path, resolvePathUrl, usedFullUrl]);

  // Match ChatScreen sizing exactly (same caps/mins/rounding).
  const CHAT_MEDIA_MAX_HEIGHT = 240; // dp
  const CHAT_MEDIA_MAX_HEIGHT_PORTRAIT = 360; // dp
  const CHAT_MEDIA_MAX_WIDTH_FRACTION = 0.86;
  const aspect = typeof thumbAspect === 'number' && Number.isFinite(thumbAspect) ? thumbAspect : 1;
  const capped = calcCappedMediaSize({
    aspect,
    availableWidth: viewportWidth - Math.max(0, avatarGutter),
    maxWidthFraction: CHAT_MEDIA_MAX_WIDTH_FRACTION,
    maxHeight: aspect > 0 && aspect < 0.95 ? CHAT_MEDIA_MAX_HEIGHT_PORTRAIT : CHAT_MEDIA_MAX_HEIGHT,
    minMaxWidth: 220,
    minW: 140,
    minH: 120,
    rounding: 'floor',
  });

  // Use a pixel max width for text bubbles too (more reliable than % on web, and accounts for avatar gutter).
  const TEXT_BUBBLE_MAX_WIDTH_FRACTION = 0.96;
  const textMaxW = Math.max(
    220,
    Math.floor((viewportWidth - Math.max(0, avatarGutter)) * TEXT_BUBBLE_MAX_WIDTH_FRACTION),
  );

  return isSystem ? (
    <View style={{ paddingVertical: 10, alignItems: 'center' }}>
      <Text
        style={{
          color: isDark ? APP_COLORS.dark.text.muted : APP_COLORS.light.text.muted,
          fontStyle: 'italic',
          fontWeight: '700',
          textAlign: 'center',
          paddingHorizontal: 18,
        }}
      >
        {String(item?.text || '').trim() || '-'}
      </Text>
    </View>
  ) : (
    <View style={[styles.msgRow, reactionEntriesVisible.length ? { paddingBottom: 12 } : null]}>
      {showAvatar ? (
        <View style={[styles.avatarGutter, { width: avatarSize, marginTop: AVATAR_TOP_OFFSET }]}>
          <AvatarBubble
            size={avatarSize}
            seed={avatarSeed}
            label={item.user}
            backgroundColor={avatarBgColor}
            textColor={avatarTextColor}
            imageUri={avatarImageUri}
            imageBgColor={isDark ? APP_COLORS.dark.bg.header : APP_COLORS.light.bg.surface2}
          />
        </View>
      ) : null}

      {hasMedia ? (
        <View style={[styles.guestMediaCardOuter, { width: capped.w }]}>
          <View style={[styles.guestMediaCard, isDark ? styles.guestMediaCardDark : null]}>
            <View style={[styles.guestMediaHeader, isDark ? styles.guestMediaHeaderDark : null]}>
              <View style={styles.guestMediaHeaderTopRow}>
                <View style={styles.guestMediaHeaderTopLeft}>
                  <Text style={[styles.guestMetaLine, isDark ? styles.guestMetaLineDark : null]}>
                    {metaLine}
                  </Text>
                </View>
                <View style={styles.guestMediaHeaderTopRight}>
                  {isEdited && !captionHasText ? (
                    <Text
                      style={[styles.guestEditedLabel, isDark ? styles.guestEditedLabelDark : null]}
                    >
                      Edited
                    </Text>
                  ) : null}
                </View>
              </View>

              {captionHasText ? (
                <View style={styles.guestMediaCaptionRow}>
                  <RichText
                    text={String(item.text || '')}
                    isDark={isDark}
                    enableMentions={true}
                    variant="neutral"
                    onOpenUrl={onOpenUrl}
                    style={[
                      styles.guestMediaCaption,
                      ...(isDark ? [styles.guestMediaCaptionDark] : []),
                      styles.guestMediaCaptionFlex,
                    ]}
                  />
                  {isEdited ? (
                    <View style={styles.guestMediaCaptionIndicators}>
                      <Text
                        style={[
                          styles.guestEditedLabel,
                          isDark ? styles.guestEditedLabelDark : null,
                        ]}
                      >
                        Edited
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>

            {previewableWithIdx.length > 0 && mediaList.length > 1 ? (
              <MediaStackCarousel
                messageId={item.id}
                mediaList={mediaList}
                width={capped.w}
                height={capped.h}
                isDark={isDark}
                aspectByPath={aspectByPath}
                audioSlide={
                  audioPlayback
                    ? {
                        isOutgoing: false,
                        currentKey: audioPlayback.currentKey,
                        loadingKey: audioPlayback.loadingKey,
                        isPlaying: audioPlayback.isPlaying,
                        positionMs: audioPlayback.positionMs,
                        durationMs: audioPlayback.durationMs,
                        getKey: (idx, media) => audioPlayback.getKey(item.id, idx, media),
                        getTitle: (media) => String(media.fileName || '').trim() || 'Audio',
                        onToggle: (key) => audioPlayback.onPress(key),
                        onSeek: (key, ms) => audioPlayback.seekFor(key, ms),
                      }
                    : undefined
                }
                cornerRadius={0}
                loop
                // Match signed-in chat carousel behavior/styling.
                imageResizeMode="cover"
                containOnAspectMismatch
                uriByPath={thumbUriByPath}
                thumbUriByPath={thumbUriByPath}
                loadingTextColor={
                  isDark ? APP_COLORS.dark.text.secondary : APP_COLORS.light.text.secondary
                }
                loadingDotsColor={
                  isDark ? APP_COLORS.dark.text.secondary : APP_COLORS.light.text.secondary
                }
                onOpen={(idx, tapped) => {
                  const originalIdx = Math.max(0, Math.min(mediaList.length - 1, idx));
                  const ct = String(tapped?.contentType || '')
                    .trim()
                    .toLowerCase()
                    .split(';')[0]
                    .trim();
                  if (ct.startsWith('audio/') && audioPlayback) {
                    const key = audioPlayback.getKey(item.id, originalIdx, tapped);
                    void audioPlayback.onPress(key);
                    return;
                  }
                  onOpenViewer(mediaList, originalIdx);
                }}
              />
            ) : (
              <>
                <Pressable
                  onPress={() => {
                    const originalIdx = previewableWithIdx[0]?.idx ?? 0;
                    if (primaryPreviewable) onOpenViewer(mediaList, originalIdx);
                  }}
                  style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Open media"
                >
                  {previewableWithIdx[0]?.m?.kind === 'image' && thumbUrl ? (
                    <Image
                      source={{ uri: thumbUrl }}
                      style={{ width: capped.w, height: capped.h }}
                      resizeMode="contain"
                      onError={() => void onThumbError()}
                    />
                  ) : previewableWithIdx[0]?.m?.kind === 'video' && thumbUrl ? (
                    <View style={{ width: capped.w, height: capped.h }}>
                      <Image
                        source={{ uri: thumbUrl }}
                        style={styles.mediaFill}
                        resizeMode="cover"
                        onError={() => void onThumbError()}
                      />
                      <View style={styles.guestMediaPlayOverlay}>
                        <Text style={styles.guestMediaPlayOverlayText}>▶</Text>
                      </View>
                    </View>
                  ) : (
                    // If there is no previewable media, we render file/audio tiles below instead.
                    <View />
                  )}
                </Pressable>

                {extraCount ? (
                  <View style={styles.guestExtraMediaRow}>
                    <Text
                      style={[
                        styles.guestExtraMediaText,
                        isDark ? styles.guestExtraMediaTextDark : null,
                      ]}
                    >
                      +{extraCount} more
                    </Text>
                  </View>
                ) : null}
              </>
            )}
          </View>

          {/* Only render file/audio tiles for file-only messages. Mixed media keeps files in the carousel. */}
          {!previewableWithIdx.length && fileLikeWithIdx.length ? (
            <View style={{ marginTop: 8 }}>
              <AttachmentTilesList
                messageId={String(item.id)}
                items={fileLikeWithIdx.map(({ m, idx }) => ({ media: m, idx }))}
                isDark={isDark}
                isOutgoing={false}
                audio={
                  audioPlayback
                    ? {
                        currentKey: audioPlayback.currentKey,
                        loadingKey: audioPlayback.loadingKey,
                        isPlaying: audioPlayback.isPlaying,
                        positionMs: audioPlayback.positionMs,
                        durationMs: audioPlayback.durationMs,
                        getKey: (idx, media) => audioPlayback.getKey(item.id, idx, media),
                        getTitle: (media) => audioTitleFromFileName(media.fileName, 'Audio'),
                        onToggle: ({ key }) => audioPlayback.onPress(key),
                        onSeek: (key, ms) => audioPlayback.seekFor(key, ms),
                      }
                    : undefined
                }
                onPressFile={(idx) => onOpenViewer(mediaList, idx)}
                getDownloadUrl={(media) =>
                  String(thumbUriByPath[String(media?.path || '')] || '').trim()
                }
                onDownloadError={() => {
                  // Guest mode: keep silent on download errors (best-effort).
                }}
              />
            </View>
          ) : null}

          {reactionEntriesVisible.length ? (
            <View
              style={[
                styles.guestReactionOverlay,
                // RN-web deprecates the pointerEvents prop; use style.pointerEvents on web.
                ...(Platform.OS === 'web' ? [{ pointerEvents: 'box-none' as const }] : []),
              ]}
              {...(Platform.OS === 'web' ? {} : { pointerEvents: 'box-none' as const })}
            >
              {reactionEntriesVisible.map(([emoji, info]) => (
                <Pressable
                  key={`${item.id}:${emoji}`}
                  onPress={() =>
                    onOpenReactionInfo(
                      String(emoji),
                      (info?.userSubs || []).map(String),
                      item.reactionUsers,
                    )
                  }
                  style={[styles.guestReactionChip, isDark && styles.guestReactionChipDark]}
                  accessibilityRole="button"
                  accessibilityLabel={`Reactions ${emoji}`}
                >
                  <Text style={[styles.guestReactionText, isDark && styles.guestReactionTextDark]}>
                    {emoji}
                    {(info?.count ?? 0) > 1 ? ` ${info?.count ?? 0}` : ''}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        <View style={[styles.guestBubbleOuter, { maxWidth: textMaxW }]}>
          <View style={[styles.bubble, isDark && styles.bubbleDark, { maxWidth: textMaxW }]}>
            <Text style={[styles.guestMetaLine, isDark ? styles.guestMetaLineDark : null]}>
              {metaLine}
            </Text>
            {item.text?.trim() ? (
              <View style={styles.guestTextRow}>
                <RichText
                  text={String(item.text || '')}
                  isDark={isDark}
                  style={[
                    styles.msgText,
                    ...(isDark ? [styles.msgTextDark] : []),
                    styles.guestTextFlex,
                  ]}
                  enableMentions={true}
                  variant="neutral"
                  onOpenUrl={onOpenUrl}
                />
                {isEdited ? (
                  <Text
                    style={[styles.guestEditedInline, isDark ? styles.guestEditedLabelDark : null]}
                  >
                    Edited
                  </Text>
                ) : null}
              </View>
            ) : null}

            {/* File-only attachments (including audio) render as tiles inside the bubble. */}
            {fileLikeWithIdx.length ? (
              <View style={{ marginTop: 8 }}>
                <AttachmentTilesList
                  messageId={String(item.id)}
                  items={fileLikeWithIdx.map(({ m, idx }) => ({ media: m, idx }))}
                  isDark={isDark}
                  isOutgoing={false}
                  audio={
                    audioPlayback
                      ? {
                          currentKey: audioPlayback.currentKey,
                          loadingKey: audioPlayback.loadingKey,
                          isPlaying: audioPlayback.isPlaying,
                          positionMs: audioPlayback.positionMs,
                          durationMs: audioPlayback.durationMs,
                          getKey: (idx, media) => audioPlayback.getKey(item.id, idx, media),
                          getTitle: (media) => audioTitleFromFileName(media.fileName, 'Audio'),
                          onToggle: ({ key }) => audioPlayback.onPress(key),
                          onSeek: (key, ms) => audioPlayback.seekFor(key, ms),
                        }
                      : undefined
                  }
                  onPressFile={(idx) => onOpenViewer(mediaList, idx)}
                />
              </View>
            ) : null}
          </View>

          {reactionEntriesVisible.length ? (
            <View
              style={[
                styles.guestReactionOverlay,
                ...(Platform.OS === 'web' ? [{ pointerEvents: 'box-none' as const }] : []),
              ]}
              {...(Platform.OS === 'web' ? {} : { pointerEvents: 'box-none' as const })}
            >
              {reactionEntriesVisible.map(([emoji, info]) => (
                <Pressable
                  key={`${item.id}:${emoji}`}
                  onPress={() =>
                    onOpenReactionInfo(
                      String(emoji),
                      (info?.userSubs || []).map(String),
                      item.reactionUsers,
                    )
                  }
                  style={[styles.guestReactionChip, isDark && styles.guestReactionChipDark]}
                  accessibilityRole="button"
                  accessibilityLabel={`Reactions ${emoji}`}
                >
                  <Text style={[styles.guestReactionText, isDark && styles.guestReactionTextDark]}>
                    {emoji}
                    {(info?.count ?? 0) > 1 ? ` ${info?.count ?? 0}` : ''}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  msgRow: {
    paddingVertical: 4,
    alignItems: 'flex-start',
    flexDirection: 'row',
    // Ensure rows take full width on web so bubble maxWidth percentages are measured correctly.
    width: '100%',
  },
  avatarGutter: { marginRight: 8 },

  // Wrapper used for positioning the reaction overlay.
  // Max width is set per-row (pixel) for reliability on web; keep this style flexible.
  guestBubbleOuter: {
    alignSelf: 'flex-start',
    position: 'relative',
    overflow: 'visible',
    flexShrink: 1,
    minWidth: 0,
  },
  bubble: {
    // Slightly wider bubbles; also keep responsive on web.
    maxWidth: '96%',
    flexShrink: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    // Match signed-in chat bubble styling.
    backgroundColor: PALETTE.paper210,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  bubbleDark: {
    backgroundColor: APP_COLORS.dark.bg.header,
    borderColor: 'transparent',
  },
  guestReactionOverlay: {
    position: 'absolute',
    bottom: -12,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    // Ensure chips float above adjacent rows/messages.
    zIndex: 10,
    elevation: 10,
  },
  guestReactionChip: {
    borderRadius: 999,
    // Keep emoji/text size the same, but tighten the chip chrome.
    paddingHorizontal: 2,
    paddingVertical: 2,
    backgroundColor: APP_COLORS.light.bg.app,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_COLORS.light.border.subtle,
  },
  guestReactionChipDark: {
    backgroundColor: APP_COLORS.dark.bg.surface,
    borderColor: APP_COLORS.dark.border.default,
  },
  guestReactionText: { color: APP_COLORS.light.text.primary, fontWeight: '800', fontSize: 12 },
  guestReactionTextDark: { color: APP_COLORS.dark.text.primary },
  // Match ChatScreen: keep the main text container on a single row so the RichText can flex-grow
  // and wrap based on the bubble width (especially important on web).
  guestTextRow: { flexDirection: 'row', alignItems: 'flex-end' },
  // minWidth:0 is important on web flexbox so long unbroken text (e.g. links) can shrink/wrap inside the bubble.
  guestTextFlex: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  guestEditedInline: {
    marginLeft: 6,
    fontSize: 12,
    fontStyle: 'italic',
    fontWeight: '400',
    color: APP_COLORS.light.text.secondary,
  },
  guestMetaLine: {
    fontSize: 12,
    fontWeight: '700',
    color: APP_COLORS.light.text.secondary,
    marginBottom: 1,
    flexWrap: 'wrap',
  },
  guestMetaLineDark: {
    color: APP_COLORS.dark.text.primary,
  },
  msgText: {
    fontSize: 15,
    color: APP_COLORS.light.text.primary,
    lineHeight: 20,
  },
  msgTextDark: {
    color: APP_COLORS.dark.text.primary,
  },

  guestMediaCardOuter: { alignSelf: 'flex-start', position: 'relative', overflow: 'visible' },
  guestMediaCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: PALETTE.paper210,
  },
  guestMediaCardDark: {
    backgroundColor: APP_COLORS.dark.bg.header,
  },
  guestMediaHeader: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 6,
    backgroundColor: PALETTE.paper210,
  },
  guestMediaHeaderDark: {
    backgroundColor: APP_COLORS.dark.bg.header,
  },
  guestMediaCaption: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '400',
    color: APP_COLORS.light.text.primary,
    lineHeight: 20,
  },
  guestMediaHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  guestMediaHeaderTopLeft: { flex: 1, paddingRight: 10 },
  guestMediaHeaderTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  guestMediaCaptionRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  guestMediaCaptionFlex: { flex: 1, marginTop: 0 },
  guestMediaCaptionIndicators: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    marginLeft: 10,
  },
  guestEditedLabel: {
    fontSize: 12,
    fontStyle: 'italic',
    fontWeight: '400',
    color: APP_COLORS.light.text.secondary,
  },
  guestEditedLabelDark: { color: APP_COLORS.dark.text.muted },
  guestMediaCaptionDark: {
    color: APP_COLORS.dark.text.primary,
  },
  guestMediaPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestMediaPlayOverlayText: {
    color: APP_COLORS.dark.text.primary,
    fontSize: 42,
    fontWeight: '900',
    ...(Platform.OS === 'web'
      ? { textShadow: `0px 2px 6px ${withAlpha(PALETTE.black, 0.6)}` }
      : {
          textShadowColor: withAlpha(PALETTE.black, 0.6),
          textShadowOffset: { width: 0, height: 2 },
          textShadowRadius: 6,
        }),
  },
  mediaFill: { width: '100%', height: '100%' },
  guestMediaFileChip: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: APP_COLORS.light.bg.app,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_COLORS.light.border.subtle,
    maxWidth: 260,
  },
  guestMediaFileChipDark: {
    backgroundColor: APP_COLORS.dark.bg.surface,
    borderColor: APP_COLORS.dark.border.default,
  },
  guestMediaFileText: {
    color: APP_COLORS.light.text.primary,
    fontWeight: '800',
    fontSize: 13,
  },
  guestMediaFileTextDark: {
    color: APP_COLORS.dark.text.primary,
  },
  guestExtraMediaRow: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
  },
  guestExtraMediaText: {
    fontSize: 12,
    fontWeight: '800',
    color: APP_COLORS.light.text.secondary,
  },
  guestExtraMediaTextDark: {
    color: APP_COLORS.dark.text.secondary,
  },
});
