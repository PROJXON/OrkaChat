import React from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { AvatarBubble } from '../../../components/AvatarBubble';
import { MediaStackCarousel } from '../../../components/MediaStackCarousel';
import { RichText } from '../../../components/RichText';
import type { MediaItem } from '../../../types/media';
import { resolveMediaUrlWithFallback } from '../../../utils/resolveMediaUrl';
import { calcCappedMediaSize } from '../../../utils/mediaSizing';
import type { GuestMessage } from '../types';
import { formatGuestTimestamp } from '../parsers';

export function GuestMessageRow({
  item,
  isDark,
  onOpenUrl,
  resolvePathUrl,
  onOpenReactionInfo,
  onOpenViewer,
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
  if (isSystem) {
    return (
      <View style={{ paddingVertical: 10, alignItems: 'center' }}>
        <Text
          style={{
            color: isDark ? '#a7a7b4' : '#666',
            fontStyle: 'italic',
            fontWeight: '700',
            textAlign: 'center',
            paddingHorizontal: 18,
          }}
        >
          {String(item?.text || '').trim() || '-'}
        </Text>
      </View>
    );
  }

  const AVATAR_TOP_OFFSET = 4;
  const [thumbUrl, setThumbUrl] = React.useState<string | null>(null);
  const [usedFullUrl, setUsedFullUrl] = React.useState<boolean>(false);
  const [thumbAspect, setThumbAspect] = React.useState<number | null>(null);
  const [thumbUriByPath, setThumbUriByPath] = React.useState<Record<string, string>>({});

  const mediaList = item.mediaList ?? (item.media ? [item.media] : []);
  const primaryMedia = mediaList.length ? mediaList[0] : null;
  const extraCount = Math.max(0, mediaList.length - 1);

  // For multi-media previews, resolve thumb URLs for each page so the carousel can render immediately.
  React.useEffect(() => {
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
  }, [mediaList, resolvePathUrl, thumbUriByPath]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const preferredPath = primaryMedia?.thumbPath || primaryMedia?.path;
      if (!preferredPath) return;
      const u = await resolveMediaUrlWithFallback(resolvePathUrl, preferredPath, primaryMedia?.path);
      if (!cancelled) setThumbUrl(u);
    })();
    return () => {
      cancelled = true;
    };
  }, [primaryMedia?.path, primaryMedia?.thumbPath, resolvePathUrl]);

  React.useEffect(() => {
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
  }, [thumbUrl]);

  const hasMedia = !!primaryMedia?.path;
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
    const fullPath = primaryMedia?.path;
    if (!fullPath) return;
    const u = await resolveMediaUrlWithFallback(resolvePathUrl, fullPath, null);
    if (u) {
      setUsedFullUrl(true);
      setThumbUrl(u);
      return;
    }
    // If we couldn't resolve anything, drop the preview so we fall back to a file chip.
    setThumbUrl(null);
  }, [primaryMedia?.path, resolvePathUrl, usedFullUrl]);

  // Match ChatScreen-ish thumbnail sizing: capped max size, preserve aspect ratio, no crop.
  const capped = calcCappedMediaSize({
    aspect: typeof thumbAspect === 'number' ? thumbAspect : 1,
    availableWidth: viewportWidth - Math.max(0, avatarGutter),
    maxWidthFraction: 0.86,
    maxHeight: 240,
    minMaxWidth: 220,
    minAspect: 0.1,
    minHInitial: 80,
    minWWhenCapped: 160,
    rounding: 'round',
  });

  // Use a pixel max width for text bubbles too (more reliable than % on web, and accounts for avatar gutter).
  const TEXT_BUBBLE_MAX_WIDTH_FRACTION = 0.96;
  const textMaxW = Math.max(
    220,
    Math.floor((viewportWidth - Math.max(0, avatarGutter)) * TEXT_BUBBLE_MAX_WIDTH_FRACTION),
  );

  return (
    <View style={[styles.msgRow]}>
      {showAvatar ? (
        <View style={[styles.avatarGutter, { width: avatarSize, marginTop: AVATAR_TOP_OFFSET }]}>
          <AvatarBubble
            size={avatarSize}
            seed={avatarSeed}
            label={item.user}
            backgroundColor={avatarBgColor}
            textColor={avatarTextColor}
            imageUri={avatarImageUri}
            imageBgColor={isDark ? '#1c1c22' : '#f2f2f7'}
          />
        </View>
      ) : null}

      {hasMedia ? (
        <View style={[styles.guestMediaCardOuter, { width: capped.w }]}>
          <View style={[styles.guestMediaCard, isDark ? styles.guestMediaCardDark : null]}>
            <View style={[styles.guestMediaHeader, isDark ? styles.guestMediaHeaderDark : null]}>
              <View style={styles.guestMediaHeaderTopRow}>
                <View style={styles.guestMediaHeaderTopLeft}>
                  <Text style={[styles.guestMetaLine, isDark ? styles.guestMetaLineDark : null]}>{metaLine}</Text>
                </View>
                <View style={styles.guestMediaHeaderTopRight}>
                  {isEdited && !captionHasText ? (
                    <Text style={[styles.guestEditedLabel, isDark ? styles.guestEditedLabelDark : null]}>Edited</Text>
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
                      <Text style={[styles.guestEditedLabel, isDark ? styles.guestEditedLabelDark : null]}>Edited</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>

            {mediaList.length > 1 ? (
              <MediaStackCarousel
                messageId={item.id}
                mediaList={mediaList as any}
                width={capped.w}
                height={capped.h}
                isDark={isDark}
                uriByPath={thumbUriByPath}
                onOpen={(idx) => onOpenViewer(mediaList, idx)}
              />
            ) : (
              <>
                <Pressable
                  onPress={() => {
                    if (primaryMedia) onOpenViewer(mediaList, 0);
                  }}
                  style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Open media"
                >
                  {primaryMedia?.kind === 'image' && thumbUrl ? (
                    <Image
                      source={{ uri: thumbUrl }}
                      style={{ width: capped.w, height: capped.h }}
                      resizeMode="contain"
                      onError={() => void onThumbError()}
                    />
                  ) : primaryMedia?.kind === 'video' && thumbUrl ? (
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
                    <View style={[styles.guestMediaFileChip, isDark && styles.guestMediaFileChipDark]}>
                      <Text
                        style={[styles.guestMediaFileText, isDark && styles.guestMediaFileTextDark]}
                        numberOfLines={1}
                      >
                        {primaryMedia?.fileName
                          ? primaryMedia.fileName
                          : primaryMedia?.kind === 'video'
                            ? 'Video'
                            : 'File'}
                      </Text>
                    </View>
                  )}
                </Pressable>

                {extraCount ? (
                  <View style={styles.guestExtraMediaRow}>
                    <Text style={[styles.guestExtraMediaText, isDark ? styles.guestExtraMediaTextDark : null]}>
                      +{extraCount} more
                    </Text>
                  </View>
                ) : null}
              </>
            )}
          </View>

          {reactionEntriesVisible.length ? (
            <View
              style={[
                styles.guestReactionOverlay,
                // RN-web deprecates the pointerEvents prop; use style.pointerEvents on web.
                ...(Platform.OS === 'web' ? [{ pointerEvents: 'box-none' as const }] : []),
              ]}
              pointerEvents={Platform.OS === 'web' ? undefined : 'box-none'}
            >
              {reactionEntriesVisible.map(([emoji, info]) => (
                <Pressable
                  key={`${item.id}:${emoji}`}
                  onPress={() =>
                    onOpenReactionInfo(String(emoji), (info?.userSubs || []).map(String), item.reactionUsers)
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
            <Text style={[styles.guestMetaLine, isDark ? styles.guestMetaLineDark : null]}>{metaLine}</Text>
            {item.text?.trim() ? (
              <View style={styles.guestTextRow}>
                <RichText
                  text={String(item.text || '')}
                  isDark={isDark}
                  style={[styles.msgText, ...(isDark ? [styles.msgTextDark] : []), styles.guestTextFlex]}
                  enableMentions={true}
                  variant="neutral"
                  onOpenUrl={onOpenUrl}
                />
                {isEdited ? (
                  <Text style={[styles.guestEditedInline, isDark ? styles.guestEditedLabelDark : null]}>Edited</Text>
                ) : null}
              </View>
            ) : null}
          </View>

          {reactionEntriesVisible.length ? (
            <View
              style={[
                styles.guestReactionOverlay,
                ...(Platform.OS === 'web' ? [{ pointerEvents: 'box-none' as const }] : []),
              ]}
              pointerEvents={Platform.OS === 'web' ? undefined : 'box-none'}
            >
              {reactionEntriesVisible.map(([emoji, info]) => (
                <Pressable
                  key={`${item.id}:${emoji}`}
                  onPress={() =>
                    onOpenReactionInfo(String(emoji), (info?.userSubs || []).map(String), item.reactionUsers)
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
  guestBubbleOuter: { alignSelf: 'flex-start', position: 'relative', overflow: 'visible', flexShrink: 1, minWidth: 0 },
  bubble: {
    // Slightly wider bubbles; also keep responsive on web.
    maxWidth: '96%',
    flexShrink: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f2f2f7',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e3e3e3',
  },
  bubbleDark: {
    backgroundColor: '#1c1c22',
    borderColor: '#2a2a33',
  },
  guestReactionOverlay: {
    position: 'absolute',
    bottom: -12,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  guestReactionChip: {
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e3e3e3',
  },
  guestReactionChipDark: {
    backgroundColor: '#14141a',
    borderColor: '#2a2a33',
  },
  guestReactionText: { color: '#111', fontWeight: '800', fontSize: 12 },
  guestReactionTextDark: { color: '#fff' },
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
    color: '#555',
  },
  guestMetaLine: {
    fontSize: 12,
    fontWeight: '800',
    color: '#555',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  guestMetaLineDark: {
    color: '#fff',
  },
  msgText: {
    fontSize: 15,
    color: '#111',
    lineHeight: 20,
  },
  msgTextDark: {
    color: '#fff',
  },

  guestMediaCardOuter: { alignSelf: 'flex-start', position: 'relative', overflow: 'visible' },
  guestMediaCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#f1f1f1',
  },
  guestMediaCardDark: {
    backgroundColor: '#1c1c22',
  },
  guestMediaHeader: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 6,
    backgroundColor: '#f1f1f1',
  },
  guestMediaHeaderDark: {
    backgroundColor: '#1c1c22',
  },
  guestMediaCaption: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '400',
    color: '#111',
    lineHeight: 20,
  },
  guestMediaHeaderTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  guestMediaHeaderTopLeft: { flex: 1, paddingRight: 10 },
  guestMediaHeaderTopRight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  guestMediaCaptionRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 },
  guestMediaCaptionFlex: { flex: 1, marginTop: 0 },
  guestMediaCaptionIndicators: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    marginLeft: 10,
  },
  guestEditedLabel: { fontSize: 12, fontStyle: 'italic', fontWeight: '400', color: '#555' },
  guestEditedLabelDark: { color: '#a7a7b4' },
  guestMediaCaptionDark: {
    color: '#fff',
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
    color: '#fff',
    fontSize: 42,
    fontWeight: '900',
    ...(Platform.OS === 'web'
      ? { textShadow: '0px 2px 6px rgba(0,0,0,0.6)' }
      : { textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 }),
  },
  mediaFill: { width: '100%', height: '100%' },
  guestMediaFileChip: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e3e3e3',
    maxWidth: 260,
  },
  guestMediaFileChipDark: {
    backgroundColor: '#14141a',
    borderColor: '#2a2a33',
  },
  guestMediaFileText: {
    color: '#111',
    fontWeight: '800',
    fontSize: 13,
  },
  guestMediaFileTextDark: {
    color: '#fff',
  },
  guestExtraMediaRow: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
  },
  guestExtraMediaText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#555',
  },
  guestExtraMediaTextDark: {
    color: '#b7b7c2',
  },
});
