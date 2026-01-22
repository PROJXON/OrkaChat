import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, View } from 'react-native';

import type { ChatScreenStyles } from '../../../screens/ChatScreen.styles';
import { APP_COLORS } from '../../../theme/colors';

type Props = {
  styles: ChatScreenStyles;
  isDark: boolean;

  showCaret: boolean;
  caretExpanded: boolean;
  caretA11yLabel: string;
  onPressCaret: () => void;
};

export function ChatHeaderStatusRow({
  styles,
  isDark,
  showCaret,
  caretExpanded,
  caretA11yLabel,
  onPressCaret,
}: Props) {
  return (
    <View style={styles.headerSubRow}>
      <View style={{ flex: 1 }} />
      {/* Keep this row visually tight to the bottom of the header (no extra top offset). */}
      <View
        style={[
          styles.welcomeStatusRow,
          { marginTop: 0 },
          !caretExpanded ? styles.dmSettingsCaretRowCollapsed : null,
        ]}
      >
        {showCaret ? (
          <Pressable
            style={({ pressed }) => [
              styles.dmSettingsCaretBtn,
              !caretExpanded ? styles.dmSettingsCaretBtnCollapsed : null,
              pressed ? { opacity: 0.65 } : null,
            ]}
            onPress={onPressCaret}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={caretA11yLabel}
          >
            <MaterialIcons
              name={caretExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
              size={18}
              style={!caretExpanded ? styles.dmSettingsCaretIconCollapsed : null}
              color={isDark ? APP_COLORS.dark.text.secondary : APP_COLORS.light.text.secondary}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
