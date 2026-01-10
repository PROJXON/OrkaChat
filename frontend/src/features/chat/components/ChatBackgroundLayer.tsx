import React from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';

type ResolvedChatBg =
  | { mode: 'default' }
  | { mode: 'color'; color: string }
  | { mode: 'image'; uri: string; blur?: number; opacity?: number };

type Props = {
  styles: any;
  isDark: boolean;
  resolvedChatBg: ResolvedChatBg;
};

export function ChatBackgroundLayer({ styles, isDark, resolvedChatBg }: Props) {
  return (
    <>
      <View
        style={[
          styles.chatBgBase,
          ...(Platform.OS === 'web' ? [{ pointerEvents: 'none' as const }] : []),
          resolvedChatBg.mode === 'default'
            ? { backgroundColor: isDark ? '#0b0b0f' : '#fff' }
            : resolvedChatBg.mode === 'color'
              ? { backgroundColor: resolvedChatBg.color }
              : null,
        ]}
        pointerEvents={Platform.OS === 'web' ? undefined : 'none'}
      />
      {resolvedChatBg.mode === 'image' ? (
        <View
          style={[StyleSheet.absoluteFill, ...(Platform.OS === 'web' ? [{ pointerEvents: 'none' as const }] : [])]}
          pointerEvents={Platform.OS === 'web' ? undefined : 'none'}
        >
          <Image
            source={{ uri: resolvedChatBg.uri }}
            style={[StyleSheet.absoluteFill, { opacity: resolvedChatBg.opacity ?? 1 }]}
            resizeMode="cover"
            blurRadius={resolvedChatBg.blur ?? 0}
          />
        </View>
      ) : null}
    </>
  );
}
