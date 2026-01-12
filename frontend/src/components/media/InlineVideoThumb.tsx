import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { APP_COLORS, PALETTE, withAlpha } from '../../theme/colors';

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

export function InlineVideoThumb({ url, onPress }: { url: string; onPress: () => void }): React.JSX.Element {
  const player = useVideoPlayer(url, (p: unknown) => {
    // Ensure we don't auto-play in lists.
    tryInvokePlayerMethod(p, 'pause');
  });

  React.useEffect(() => {
    // Also pause on mount/update (some platforms auto-play briefly).
    tryInvokePlayerMethod(player, 'pause');
  }, [player]);

  return (
    <Pressable onPress={onPress}>
      <View style={styles.videoThumbWrap}>
        <VideoView player={player} style={styles.mediaThumb} contentFit="cover" nativeControls={false} />
        <View style={styles.videoPlayOverlay}>
          <Text style={styles.videoPlayText}>▶</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mediaThumb: { width: '100%', height: '100%', borderRadius: 14, backgroundColor: withAlpha(PALETTE.black, 0.02) },
  videoThumbWrap: { position: 'relative', overflow: 'hidden', borderRadius: 14 },
  videoPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayText: { color: APP_COLORS.dark.text.primary, fontSize: 28, fontWeight: '900' },
});
