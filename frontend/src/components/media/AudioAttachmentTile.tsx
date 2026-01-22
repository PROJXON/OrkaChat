import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Slider from '@react-native-community/slider';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useUiPromptOptional } from '../../providers/UiPromptProvider';
import { APP_COLORS, PALETTE, withAlpha } from '../../theme/colors';
import {
  DOWNLOAD_ATTACHMENT_DONT_SHOW_AGAIN_KEY,
  DOWNLOAD_ATTACHMENT_DONT_SHOW_AGAIN_LABEL,
  SAVE_TO_PHONE_DONT_SHOW_AGAIN_KEY,
  SAVE_TO_PHONE_DONT_SHOW_AGAIN_LABEL,
} from '../../utils/saveToPhonePrompt';

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
  minWidth,
  onDownload,
  layout = 'default',
}: {
  isDark: boolean;
  isOutgoing: boolean;
  state: AudioAttachmentTileState;
  /**
   * Defaults to 260 for normal attachment tiles.
   * In tight containers (e.g. carousel slides), set to 0 so it can shrink.
   */
  minWidth?: number;
  onDownload?: () => void | Promise<void>;
  /**
   * `default`: play button left, title/download row, slider row.
   * `narrow`: stacked/centered layout to avoid collisions in thin carousels.
   */
  layout?: 'default' | 'narrow';
}): React.JSX.Element {
  const ui = useUiPromptOptional();

  const confirmAndDownload = React.useCallback(async () => {
    if (!onDownload) return;
    try {
      const name = String(state.title || '').trim() || 'Audio';
      const title = Platform.OS === 'web' ? 'Download Attachment?' : 'Save to Phone?';
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
      // Best-effort: if prompting fails for any reason, still allow download.
      await onDownload();
    }
  }, [onDownload, state.title, ui]);

  const icon = state.isPlaying ? 'pause-circle' : 'play-circle';
  const incomingControlColor = isDark ? PALETTE.white : APP_COLORS.light.text.primary;
  const iconColor = isOutgoing ? PALETTE.white : incomingControlColor;

  const trackBaseHex = isOutgoing ? PALETTE.white : incomingControlColor;

  const trackColor = withAlpha(trackBaseHex, isOutgoing ? 0.8 : 0.35);
  const trackColorMax = withAlpha(trackBaseHex, isOutgoing ? 0.35 : 0.18);

  const thumbColor = isOutgoing ? PALETTE.white : incomingControlColor;

  const duration = state.durationMs ?? 0;
  const max = Math.max(1, duration || 1);
  const pos = Math.max(0, Math.min(max, state.positionMs || 0));
  const remaining = Math.max(0, Math.floor(duration - pos));
  const rightTimeLabel = state.durationMs
    ? state.isPlaying
      ? formatTime(remaining)
      : formatTime(state.durationMs)
    : '--:--';

  const isNarrow = layout === 'narrow';

  return (
    <View
      style={[
        styles.wrap,
        { minWidth: typeof minWidth === 'number' && Number.isFinite(minWidth) ? minWidth : 260 },
        isNarrow ? styles.wrapNarrow : null,
        isOutgoing ? styles.wrapOutgoing : null,
        !isOutgoing && isDark ? styles.wrapDark : null,
      ]}
      accessibilityRole="summary"
    >
      {isNarrow ? (
        <>
          <Pressable
            onPress={() => void state.onToggle()}
            accessibilityRole="button"
            accessibilityLabel={`${state.isPlaying ? 'Pause' : 'Play'} ${state.title}`}
            style={({ pressed }) => [styles.iconBtnNarrow, pressed ? { opacity: 0.92 } : null]}
          >
            <MaterialCommunityIcons name={icon as never} size={46} color={iconColor} />
          </Pressable>

          <View style={{ width: '100%', minWidth: 0 }}>
            <Text
              style={[
                styles.title,
                styles.titleNarrow,
                isOutgoing ? styles.titleOutgoing : null,
                !isOutgoing && isDark ? styles.titleDark : null,
              ]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {state.title}
            </Text>

            {state.subtitle ? (
              <Text
                style={[
                  styles.subtitle,
                  styles.subtitleNarrow,
                  isOutgoing ? styles.subtitleOutgoing : null,
                  !isOutgoing && isDark ? styles.subtitleDark : null,
                ]}
                numberOfLines={1}
              >
                {state.subtitle}
              </Text>
            ) : null}

            {/* Slider on its own row (avoids crowding on very narrow carousels). */}
            <View style={[styles.sliderOnlyRowNarrow]}>
              <Slider
                style={{ flex: 1, height: 24 }}
                minimumValue={0}
                maximumValue={max}
                value={pos}
                minimumTrackTintColor={trackColor}
                maximumTrackTintColor={trackColorMax}
                thumbTintColor={thumbColor}
                disabled={state.isLoading}
                onSlidingComplete={(v) => void state.onSeek(Math.floor(Number(v) || 0))}
              />
            </View>

            {/* Time labels below the slider. */}
            <View style={styles.timesRowNarrow}>
              <Text
                style={[
                  styles.time,
                  styles.timeNarrow,
                  isOutgoing ? styles.timeOutgoing : null,
                  !isOutgoing && isDark ? styles.timeDark : null,
                ]}
              >
                {formatTime(pos)}
              </Text>
              <Text
                style={[
                  styles.time,
                  styles.timeNarrow,
                  isOutgoing ? styles.timeOutgoing : null,
                  !isOutgoing && isDark ? styles.timeDark : null,
                ]}
              >
                {rightTimeLabel}
              </Text>
            </View>

            {/* Download at the bottom so it doesn't collide with carousel carets. */}
            {onDownload ? (
              <View style={styles.downloadRowNarrow}>
                <Pressable
                  onPress={() => void confirmAndDownload()}
                  accessibilityRole="button"
                  accessibilityLabel={`Download ${state.title}`}
                  hitSlop={10}
                  style={({ pressed }) => [styles.downloadBtn, pressed ? { opacity: 0.85 } : null]}
                >
                  <MaterialCommunityIcons name={'download' as never} size={22} color={iconColor} />
                </Pressable>
              </View>
            ) : null}
          </View>
        </>
      ) : (
        <>
          <Pressable
            onPress={() => void state.onToggle()}
            accessibilityRole="button"
            accessibilityLabel={`${state.isPlaying ? 'Pause' : 'Play'} ${state.title}`}
            style={({ pressed }) => [styles.iconBtn, pressed ? { opacity: 0.92 } : null]}
          >
            <MaterialCommunityIcons name={icon as never} size={44} color={iconColor} />
          </Pressable>

          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.titleRow}>
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
              {onDownload ? (
                <Pressable
                  onPress={() => void confirmAndDownload()}
                  accessibilityRole="button"
                  accessibilityLabel={`Download ${state.title}`}
                  hitSlop={10}
                  style={({ pressed }) => [styles.downloadBtn, pressed ? { opacity: 0.85 } : null]}
                >
                  <MaterialCommunityIcons name={'download' as never} size={20} color={iconColor} />
                </Pressable>
              ) : null}
            </View>
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
                disabled={state.isLoading}
                onSlidingComplete={(v) => void state.onSeek(Math.floor(Number(v) || 0))}
              />
              <Text
                style={[
                  styles.time,
                  isOutgoing ? styles.timeOutgoing : null,
                  !isOutgoing && isDark ? styles.timeDark : null,
                ]}
              >
                {rightTimeLabel}
              </Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    flexGrow: 1,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: PALETTE.paper230,
  },
  wrapNarrow: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  wrapDark: { backgroundColor: withAlpha(PALETTE.white, 0.06) },
  wrapOutgoing: { backgroundColor: withAlpha(PALETTE.white, 0.14) },
  iconBtn: { paddingRight: 8 },
  iconBtnNarrow: { paddingBottom: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  downloadBtn: { paddingHorizontal: 4, paddingVertical: 4 },
  downloadRowNarrow: { marginTop: 2, alignItems: 'center', justifyContent: 'center' },
  title: {
    color: APP_COLORS.light.text.primary,
    fontWeight: '800',
    fontSize: 14,
    lineHeight: 18,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  titleNarrow: { textAlign: 'center' },
  titleDark: { color: APP_COLORS.dark.text.primary },
  titleOutgoing: { color: PALETTE.white },
  subtitle: {
    marginTop: 2,
    color: APP_COLORS.light.text.secondary,
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 16,
  },
  subtitleNarrow: { textAlign: 'center' },
  subtitleDark: { color: APP_COLORS.dark.text.secondary },
  subtitleOutgoing: { color: withAlpha(PALETTE.white, 0.85) },
  sliderRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sliderOnlyRowNarrow: { marginTop: 10, width: '100%' },
  timesRowNarrow: {
    marginTop: 4,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  time: {
    width: 44,
    textAlign: 'center',
    color: APP_COLORS.light.text.secondary,
    fontWeight: '800',
    fontSize: 11,
  },
  timeNarrow: { width: 'auto' },
  timeDark: { color: APP_COLORS.dark.text.secondary },
  timeOutgoing: { color: withAlpha(PALETTE.white, 0.85) },
});
