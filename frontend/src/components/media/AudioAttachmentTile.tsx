import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Slider from '@react-native-community/slider';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { APP_COLORS, PALETTE, withAlpha } from '../../theme/colors';

function formatTime(ms: number | null | undefined): string {
  const v = typeof ms === 'number' && Number.isFinite(ms) && ms >= 0 ? ms : 0;
  const totalSec = Math.floor(v / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export type AudioAttachmentTileState = {
  key: string;
  title: string;
  subtitle?: string;

  isPlaying: boolean;
  isLoading: boolean;
  positionMs: number;
  durationMs: number | null;

  onToggle: () => void | Promise<void>;
  onSeek: (nextMs: number) => void | Promise<void>;
};

export function AudioAttachmentTile({
  isDark,
  isOutgoing,
  state,
}: {
  isDark: boolean;
  isOutgoing: boolean;
  state: AudioAttachmentTileState;
}): React.JSX.Element {
  const icon = state.isPlaying ? 'pause-circle' : 'play-circle';
  const iconColor = isOutgoing
    ? PALETTE.white
    : isDark
      ? APP_COLORS.dark.text.primary
      : APP_COLORS.light.brand.primary;

  const trackBaseHex = isOutgoing
    ? PALETTE.white
    : isDark
      ? PALETTE.white
      : APP_COLORS.light.brand.primary;

  const trackColor = withAlpha(trackBaseHex, isOutgoing ? 0.8 : 0.35);
  const trackColorMax = withAlpha(trackBaseHex, isOutgoing ? 0.35 : 0.18);

  const thumbColor = isOutgoing ? PALETTE.white : APP_COLORS.light.brand.primary;

  const duration = state.durationMs ?? 0;
  const max = Math.max(1, duration || 1);
  const pos = Math.max(0, Math.min(max, state.positionMs || 0));

  return (
    <View
      style={[
        styles.wrap,
        isOutgoing ? styles.wrapOutgoing : null,
        !isOutgoing && isDark ? styles.wrapDark : null,
      ]}
      accessibilityRole="summary"
    >
      <Pressable
        onPress={() => void state.onToggle()}
        accessibilityRole="button"
        accessibilityLabel={`${state.isPlaying ? 'Pause' : 'Play'} ${state.title}`}
        style={({ pressed }) => [styles.iconBtn, pressed ? { opacity: 0.92 } : null]}
      >
        <MaterialCommunityIcons name={icon as never} size={44} color={iconColor} />
      </Pressable>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={[
            styles.title,
            isOutgoing ? styles.titleOutgoing : null,
            !isOutgoing && isDark ? styles.titleDark : null,
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {state.title}
        </Text>
        {state.subtitle ? (
          <Text
            style={[
              styles.subtitle,
              isOutgoing ? styles.subtitleOutgoing : null,
              !isOutgoing && isDark ? styles.subtitleDark : null,
            ]}
            numberOfLines={1}
          >
            {state.subtitle}
          </Text>
        ) : null}

        <View style={styles.sliderRow}>
          <Text
            style={[
              styles.time,
              isOutgoing ? styles.timeOutgoing : null,
              !isOutgoing && isDark ? styles.timeDark : null,
            ]}
          >
            {formatTime(pos)}
          </Text>
          <Slider
            style={{ flex: 1, height: 24 }}
            minimumValue={0}
            maximumValue={max}
            value={pos}
            minimumTrackTintColor={trackColor}
            maximumTrackTintColor={trackColorMax}
            thumbTintColor={thumbColor}
            disabled={state.isLoading || !state.durationMs}
            onSlidingComplete={(v) => void state.onSeek(Math.floor(Number(v) || 0))}
          />
          <Text
            style={[
              styles.time,
              isOutgoing ? styles.timeOutgoing : null,
              !isOutgoing && isDark ? styles.timeDark : null,
            ]}
          >
            {state.durationMs ? formatTime(state.durationMs) : '--:--'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    flexGrow: 1,
    minWidth: 260,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: PALETTE.paper230,
  },
  wrapDark: { backgroundColor: withAlpha(PALETTE.white, 0.06) },
  wrapOutgoing: { backgroundColor: withAlpha(PALETTE.white, 0.14) },
  iconBtn: { paddingRight: 8 },
  title: {
    color: APP_COLORS.light.text.primary,
    fontWeight: '800',
    fontSize: 14,
    lineHeight: 18,
  },
  titleDark: { color: APP_COLORS.dark.text.primary },
  titleOutgoing: { color: PALETTE.white },
  subtitle: {
    marginTop: 2,
    color: APP_COLORS.light.text.secondary,
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 16,
  },
  subtitleDark: { color: APP_COLORS.dark.text.secondary },
  subtitleOutgoing: { color: withAlpha(PALETTE.white, 0.85) },
  sliderRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 8 },
  time: {
    width: 44,
    textAlign: 'center',
    color: APP_COLORS.light.text.secondary,
    fontWeight: '800',
    fontSize: 11,
  },
  timeDark: { color: APP_COLORS.dark.text.secondary },
  timeOutgoing: { color: withAlpha(PALETTE.white, 0.85) },
});
