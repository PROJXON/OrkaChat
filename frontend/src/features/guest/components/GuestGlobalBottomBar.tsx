import React from 'react';
import { Pressable, Text, View } from 'react-native';

export function GuestGlobalBottomBar({
  isDark,
  isWideUi,
  bottomInset,
  requestSignIn,
  styles,
}: {
  isDark: boolean;
  isWideUi: boolean;
  bottomInset: number;
  requestSignIn: () => void;
  styles: typeof import('../../../screens/GuestGlobalScreen.styles').styles;
}): React.JSX.Element {
  return (
    <View
      style={[
        styles.bottomBar,
        isDark && styles.bottomBarDark,
        // Fill the safe area with the bar background, but keep the inner content vertically centered.
        { paddingBottom: bottomInset },
      ]}
    >
      <View style={[styles.bottomBarInner, isWideUi ? styles.contentColumn : null]}>
        <Pressable
          onPress={requestSignIn}
          style={({ pressed }) => [
            styles.bottomBarCta,
            isDark && styles.bottomBarCtaDark,
            pressed && { opacity: 0.9 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Sign in to chat"
        >
          <Text style={[styles.bottomBarCtaText, isDark && styles.bottomBarCtaTextDark]}>
            Sign in to Chat
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
