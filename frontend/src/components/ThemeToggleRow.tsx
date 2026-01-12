import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Platform, Pressable, Switch, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

export type ThemeToggleRowStyles = {
  themeToggle: StyleProp<ViewStyle>;
  themeToggleDark?: StyleProp<ViewStyle>;
  webToggleTrack: StyleProp<ViewStyle>;
  webToggleTrackOn?: StyleProp<ViewStyle>;
  webToggleThumb: StyleProp<ViewStyle>;
  webToggleThumbOn?: StyleProp<ViewStyle>;
};

export function ThemeToggleRow({
  isDark,
  onSetTheme,
  styles,
}: {
  isDark: boolean;
  onSetTheme: (theme: 'light' | 'dark') => void;
  styles: ThemeToggleRowStyles;
}): React.JSX.Element {
  return (
    <View style={[styles.themeToggle, isDark && styles.themeToggleDark]}>
      <Feather name={isDark ? 'moon' : 'sun'} size={16} color={isDark ? '#fff' : '#111'} />
      {Platform.OS === 'web' ? (
        <Pressable
          onPress={() => onSetTheme(isDark ? 'light' : 'dark')}
          accessibilityRole="button"
          accessibilityLabel="Toggle theme"
          style={({ pressed }) => [
            styles.webToggleTrack,
            isDark ? styles.webToggleTrackOn : null,
            pressed ? { opacity: 0.9 } : null,
          ]}
        >
          <View style={[styles.webToggleThumb, isDark ? styles.webToggleThumbOn : null]} />
        </Pressable>
      ) : (
        <Switch
          value={isDark}
          onValueChange={(v) => onSetTheme(v ? 'dark' : 'light')}
          trackColor={{ false: '#d1d1d6', true: '#d1d1d6' }}
          thumbColor={isDark ? '#2a2a33' : '#ffffff'}
        />
      )}
    </View>
  );
}

