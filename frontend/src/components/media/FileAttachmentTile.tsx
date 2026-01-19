import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { APP_COLORS, PALETTE, withAlpha } from '../../theme/colors';
import type { MediaItem } from '../../types/media';
import {
  attachmentLabelForMedia,
  fileBadgeForMedia,
  fileBrandColorForMedia,
  fileIconNameForMedia,
} from '../../utils/mediaKinds';

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
}: {
  item: MediaItem;
  isDark: boolean;
  isOutgoing: boolean;
  onPress: () => void | Promise<void>;
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
    paddingHorizontal: 12,
    paddingVertical: 10,
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
  iconWrap: {
    // Give the font-icon some breathing room so it doesn't clip on Android.
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  badge: {
    minWidth: 44,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(APP_COLORS.light.brand.primary, 0.12),
    marginRight: 12,
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
  },
  nameDark: { color: APP_COLORS.dark.text.primary },
  nameOutgoing: { color: PALETTE.white },
  meta: {
    color: APP_COLORS.light.text.secondary,
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 5,
  },
  metaDark: { color: APP_COLORS.dark.text.secondary },
  metaOutgoing: { color: withAlpha(PALETTE.white, 0.85) },
});
