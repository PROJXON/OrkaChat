import React from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';

import type { ChatScreenStyles } from '../../../screens/ChatScreen.styles';
import { APP_THEME_COLORS } from '../../../theme/colors';

type ResolvedChatBg =
  | { mode: 'default' }
  | { mode: 'color'; color: string }
  | { mode: 'image'; uri: string; blur?: number; opacity?: number; scaleMode?: 'fill' | 'fit' };

export type { ResolvedChatBg };

type Props = {
  styles: ChatScreenStyles;
  isDark: boolean;
  resolvedChatBg: ResolvedChatBg;
};

export function ChatBackgroundLayer({ styles, isDark, resolvedChatBg }: Props) {
  const imageResizeMode =
    resolvedChatBg.mode === 'image' && resolvedChatBg.scaleMode === 'fit' ? 'contain' : 'cover';
  return (
    <>
      <View
        style={[
          styles.chatBgBase,
          ...(Platform.OS === 'web' ? [{ pointerEvents: 'none' as const }] : []),
          resolvedChatBg.mode === 'default'
            ? {
                backgroundColor: isDark
                  ? APP_THEME_COLORS.dark.appBackground
                  : APP_THEME_COLORS.light.appBackground,
              }
            : resolvedChatBg.mode === 'color'
              ? { backgroundColor: resolvedChatBg.color }
              : {
                  // In image mode, this fills the letterbox area when using "fit".
                  backgroundColor: isDark
                    ? APP_THEME_COLORS.dark.appBackground
                    : APP_THEME_COLORS.light.appBackground,
                },
        ]}
        pointerEvents={Platform.OS === 'web' ? undefined : 'none'}
      />
      {resolvedChatBg.mode === 'image' ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            ...(Platform.OS === 'web' ? [{ pointerEvents: 'none' as const }] : []),
          ]}
          pointerEvents={Platform.OS === 'web' ? undefined : 'none'}
        >
          <Image
            source={{ uri: resolvedChatBg.uri }}
            style={[StyleSheet.absoluteFill, { opacity: resolvedChatBg.opacity ?? 1 }]}
            resizeMode={imageResizeMode}
            blurRadius={resolvedChatBg.blur ?? 0}
          />
        </View>
      ) : null}
    </>
  );
}
