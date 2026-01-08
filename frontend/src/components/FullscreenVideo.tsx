import React from 'react';
import { Platform, StyleProp, ViewStyle } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

export function FullscreenVideo({
  url,
  style,
}: {
  url: string;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const player = useVideoPlayer(url, (p: any) => {
    try {
      p.play();
    } catch {}
  });

  return (
    <VideoView
      player={player}
      style={style}
      contentFit="contain"
      nativeControls
      // On Android, SurfaceView can ignore zIndex and cover overlays (like our Save/Close chrome).
      // TextureView keeps the video in the normal view hierarchy so overlays render correctly.
      {...(Platform.OS === 'android' ? ({ surfaceType: 'textureView' } as any) : null)}
    />
  );
}

