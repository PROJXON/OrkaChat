import { useVideoPlayer, VideoView } from 'expo-video';
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Platform } from 'react-native';

function tryInvokePlayerMethod(player: unknown, method: 'play' | 'pause'): void {
  if (!player || typeof player !== 'object') return;
  const rec = player as Record<string, unknown>;
  const fn = rec[method];
  if (typeof fn !== 'function') return;
  try {
    (fn as () => void).call(player);
  } catch {
    // ignore
  }
}

export function FullscreenVideo({
  url,
  style,
}: {
  url: string;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const player = useVideoPlayer(url, (p: unknown) => {
    tryInvokePlayerMethod(p, 'play');
  });

  const androidSurfaceProps: Record<string, unknown> =
    Platform.OS === 'android' ? { surfaceType: 'textureView' } : {};

  return (
    <VideoView
      player={player}
      style={style}
      contentFit="contain"
      nativeControls
      // On Android, SurfaceView can ignore zIndex and cover overlays (like our Save/Close chrome).
      // TextureView keeps the video in the normal view hierarchy so overlays render correctly.
      {...androidSurfaceProps}
    />
  );
}
