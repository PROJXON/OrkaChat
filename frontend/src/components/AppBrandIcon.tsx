import React from 'react';
import { Image, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

// NOTE:
// These images have square backgrounds. We intentionally "zoom + clip" them inside a slot
// so only the central logo shows (no visible square background in the header).
const ICON_LIGHT = require('../../assets/icons/adaptive-android-icon.png');
const ICON_DARK = require('../../assets/icons/greyed.png');

export function AppBrandIcon({
  isDark,
  slotWidth = 40,
  slotHeight = 40,
  fit = 'crop',
  clip,
  rounded,
  zoom,
  zoomLight = 2.15,
  zoomDark = 2.45,
  containZoom,
  containZoomLight = 1.7,
  containZoomDark = 1.25,
  style,
}: {
  isDark: boolean;
  // The layout "slot" size so we don't increase row height.
  slotWidth?: number;
  slotHeight?: number;
  // 'crop' matches existing behavior (zoom + clip). 'contain' shows the whole image.
  fit?: 'crop' | 'contain';
  // Override slot clipping/shape. Defaults depend on `fit`.
  clip?: boolean;
  rounded?: boolean;
  // Zoom into the center of the source image (bigger = more crop, larger visible logo).
  // If provided, `zoom` overrides `zoomLight`/`zoomDark`.
  zoom?: number;
  zoomLight?: number;
  zoomDark?: number;
  // For `fit="contain"`, some source images have extra padding; this nudges the mark larger.
  // Bigger = larger visible logo (may clip if `clip` is true).
  containZoom?: number;
  containZoomLight?: number;
  containZoomDark?: number;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  // Default to clipping inside a round slot so the icon doesn't bleed into the header row.
  const resolvedClip = typeof clip === 'boolean' ? clip : true;
  const resolvedRounded = typeof rounded === 'boolean' ? rounded : true;

  const resolvedZoom =
    typeof zoom === 'number' && Number.isFinite(zoom) && zoom > 0
      ? zoom
      : isDark
        ? zoomDark
        : zoomLight;

  const resolvedContainZoom =
    typeof containZoom === 'number' && Number.isFinite(containZoom) && containZoom > 0
      ? containZoom
      : isDark
        ? containZoomDark
        : containZoomLight;

  return (
    <View
      style={[
        styles.slot,
        resolvedClip ? styles.slotClip : styles.slotNoClip,
        resolvedRounded ? styles.slotRound : styles.slotSquare,
        { width: slotWidth, height: slotHeight },
        style,
      ]}
      pointerEvents="none"
      accessible
      accessibilityLabel="App icon"
    >
      <Image
        source={isDark ? ICON_DARK : ICON_LIGHT}
        style={[
          fit === 'contain' ? styles.iconContain : styles.iconCrop,
          { width: slotWidth, height: slotHeight },
          ...(fit === 'crop'
            ? [
                // Scale in-place; the slot's overflow clips the excess.
                { transform: [{ scale: resolvedZoom }] },
              ]
            : fit === 'contain' && resolvedContainZoom !== 1
              ? [{ transform: [{ scale: resolvedContainZoom }] }]
              : []),
        ]}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotClip: { overflow: 'hidden' },
  slotNoClip: { overflow: 'visible' },
  slotRound: { borderRadius: 999 },
  slotSquare: { borderRadius: 0 },
  iconCrop: { resizeMode: 'cover' },
  iconContain: { resizeMode: 'contain' },
});

