import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useUiPromptOptional } from '../../providers/UiPromptProvider';
import { APP_COLORS, PALETTE, withAlpha } from '../../theme/colors';
import type { MediaItem } from '../../types/media';
import {
  attachmentLabelForMedia,
  fileBadgeForMedia,
  fileBrandColorForMedia,
  fileIconNameForMedia,
} from '../../utils/mediaKinds';
import {
  DOWNLOAD_ATTACHMENT_DONT_SHOW_AGAIN_KEY,
  DOWNLOAD_ATTACHMENT_DONT_SHOW_AGAIN_LABEL,
  SAVE_TO_PHONE_DONT_SHOW_AGAIN_KEY,
  SAVE_TO_PHONE_DONT_SHOW_AGAIN_LABEL,
} from '../../utils/saveToPhonePrompt';

function formatBytes(bytes: number | undefined): string {
  const n = typeof bytes === 'number' && Number.isFinite(bytes) ? bytes : 0;
  const units = ['B', 'KB', 'MB', 'GB'] as const;
  let v = Math.max(0, n);
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function FileAttachmentTile({
  item,
  isDark,
  isOutgoing,
  onPress,
  onDownload,
}: {
  item: MediaItem;
  isDark: boolean;
  isOutgoing: boolean;
  onPress: () => void | Promise<void>;
  onDownload?: () => void | Promise<void>;
}): React.JSX.Element {
  const badge = fileBadgeForMedia(item);
  const iconName = fileIconNameForMedia(item);
  const label = attachmentLabelForMedia(item);
  const name = String(item.fileName || '').trim() || label;
  const size = typeof item.size === 'number' && Number.isFinite(item.size) ? item.size : undefined;
  const brandColor = !isOutgoing ? fileBrandColorForMedia(item) : null;
  const iconColor = isOutgoing
    ? PALETTE.white
    : brandColor
      ? brandColor
      : isDark
        ? APP_COLORS.dark.text.primary
        : APP_COLORS.light.brand.primary;
  const downloadColor = isOutgoing
    ? PALETTE.white
    : isDark
      ? APP_COLORS.dark.text.primary
      : APP_COLORS.light.text.primary;
  const ui = useUiPromptOptional();

  const confirmAndDownload = React.useCallback(async () => {
    if (!onDownload) return;
    try {
      const title = Platform.OS === 'web' ? 'Download attachment?' : 'Save to Phone?';
      const msg =
        Platform.OS === 'web'
          ? `Download "${name}" to your device?`
          : `Save "${name}" to your device?`;
      const ok = ui?.confirm
        ? await ui.confirm(title, msg, {
            confirmText: Platform.OS === 'web' ? 'Download' : 'Save',
            cancelText: 'Cancel',
            dontShowAgain:
              Platform.OS === 'web'
                ? {
                    storageKey: DOWNLOAD_ATTACHMENT_DONT_SHOW_AGAIN_KEY,
                    label: DOWNLOAD_ATTACHMENT_DONT_SHOW_AGAIN_LABEL,
                  }
                : {
                    storageKey: SAVE_TO_PHONE_DONT_SHOW_AGAIN_KEY,
                    label: SAVE_TO_PHONE_DONT_SHOW_AGAIN_LABEL,
                  },
          })
        : true;
      if (!ok) return;
      await onDownload();
    } catch {
      await onDownload();
    }
  }, [name, onDownload, ui]);

  return (
    <Pressable
      onPress={() => void onPress()}
      accessibilityRole="button"
      accessibilityLabel={`Open ${name}`}
      style={({ pressed }) => [
        styles.wrap,
        isOutgoing ? styles.wrapOutgoing : null,
        !isOutgoing && isDark ? styles.wrapDark : null,
        pressed ? { opacity: 0.92 } : null,
      ]}
    >
      {iconName ? (
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name={iconName as never} size={40} color={iconColor} />
        </View>
      ) : (
        <View
          style={[
            styles.badge,
            isOutgoing ? styles.badgeOutgoing : null,
            !isOutgoing && isDark ? styles.badgeDark : null,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              isOutgoing ? styles.badgeTextOutgoing : null,
              !isOutgoing && isDark ? styles.badgeTextDark : null,
            ]}
            numberOfLines={1}
          >
            {badge}
          </Text>
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.titleRow}>
          <Text
            style={[
              styles.name,
              isOutgoing ? styles.nameOutgoing : null,
              !isOutgoing && isDark ? styles.nameDark : null,
            ]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {name}
          </Text>
          {onDownload ? (
            <Pressable
              onPress={(e: unknown) => {
                // Web: avoid triggering the parent tile's onPress (open) when tapping download.
                if (Platform.OS === 'web')
                  (e as { stopPropagation?: () => void })?.stopPropagation?.();
                void confirmAndDownload();
              }}
              accessibilityRole="button"
              accessibilityLabel={`Download ${name}`}
              hitSlop={10}
              style={({ pressed }) => [styles.downloadBtn, pressed ? { opacity: 0.85 } : null]}
            >
              <MaterialCommunityIcons name={'download' as never} size={20} color={downloadColor} />
            </Pressable>
          ) : null}
        </View>
        <Text
          style={[
            styles.meta,
            isOutgoing ? styles.metaOutgoing : null,
            !isOutgoing && isDark ? styles.metaDark : null,
          ]}
          numberOfLines={1}
        >
          {size ? `${label} · ${formatBytes(size)}` : label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    flexGrow: 1,
    // Prevent attachment-only bubbles from collapsing to a 1-char-wide tile on mobile.
    // (When text can wrap, RN may choose an extremely small intrinsic width.)
    minWidth: 240,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 12,
    // Avoid thin borders on Android: hairlines can render as a harsh "black line".
    borderWidth: 0,
    backgroundColor: PALETTE.paper230,
  },
  wrapDark: {
    backgroundColor: withAlpha(PALETTE.white, 0.06),
  },
  wrapOutgoing: {
    backgroundColor: withAlpha(PALETTE.white, 0.14),
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  iconWrap: {
    // Give the font-icon some breathing room so it doesn't clip on Android.
    width: 42,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  badge: {
    minWidth: 44,
    height: 32,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(APP_COLORS.light.brand.primary, 0.12),
    marginRight: 6,
  },
  badgeDark: { backgroundColor: withAlpha(APP_COLORS.light.brand.primary, 0.22) },
  badgeOutgoing: { backgroundColor: withAlpha(PALETTE.white, 0.22) },
  badgeText: { color: APP_COLORS.light.brand.primary, fontWeight: '900', fontSize: 12 },
  badgeTextDark: { color: APP_COLORS.dark.text.primary },
  badgeTextOutgoing: { color: PALETTE.white },
  name: {
    color: APP_COLORS.light.text.primary,
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 20,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  nameDark: { color: APP_COLORS.dark.text.primary },
  nameOutgoing: { color: PALETTE.white },
  meta: {
    color: APP_COLORS.light.text.secondary,
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 16,
  },
  metaDark: { color: APP_COLORS.dark.text.secondary },
  metaOutgoing: { color: withAlpha(PALETTE.white, 0.85) },
  downloadBtn: { paddingHorizontal: 4, paddingVertical: 4 },
});
