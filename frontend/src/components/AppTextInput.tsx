import * as React from 'react';
import type { StyleProp, TextInputProps, TextStyle } from 'react-native';
import { StyleSheet, TextInput } from 'react-native';

import { APP_COLORS, PALETTE } from '../theme/colors';

export type AppTextInputVariant = 'blocksRow' | 'blocksStandalone';

export type AppTextInputProps = Omit<TextInputProps, 'style'> & {
  isDark: boolean;
  /**
   * Optional base style for the input (e.g. `styles.blocksInput`).
   * Use with `darkStyle` to keep existing app styling consistent.
   */
  baseStyle?: StyleProp<TextStyle>;
  /**
   * Optional dark-mode style for the input (e.g. `styles.blocksInputDark`).
   */
  darkStyle?: StyleProp<TextStyle>;
  /**
   * Convenience variants for common sizing/layout needs.
   * - `blocksRow`: default, keeps flex:1 row behavior
   * - `blocksStandalone`: full-width, slightly taller, centered text
   */
  variant?: AppTextInputVariant;
  style?: StyleProp<TextStyle>;
};

const s = StyleSheet.create({
  blocksStandalone: {
    // `blocksInput` is often used in row layouts and has flex: 1; override for standalone column input.
    flex: 0,
    alignSelf: 'stretch',
    width: '100%',
    height: 44,
    fontSize: 16,
    lineHeight: 20,
    paddingVertical: 10,
    textAlignVertical: 'center',
  },
});

export const AppTextInput = React.forwardRef<TextInput, AppTextInputProps>(function AppTextInput(
  {
    isDark,
    baseStyle,
    darkStyle,
    variant = 'blocksRow',
    placeholderTextColor,
    selectionColor,
    cursorColor,
    style,
    ...props
  },
  ref,
): React.JSX.Element {
  const resolvedPlaceholderTextColor =
    placeholderTextColor ?? (isDark ? PALETTE.slate400 : PALETTE.slate350);
  const resolvedSelectionColor =
    selectionColor ?? (isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary);
  const resolvedCursorColor =
    cursorColor ?? (isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary);

  return (
    <TextInput
      ref={ref}
      placeholderTextColor={resolvedPlaceholderTextColor}
      selectionColor={resolvedSelectionColor}
      cursorColor={resolvedCursorColor}
      style={[
        baseStyle,
        isDark ? darkStyle : null,
        variant === 'blocksStandalone' ? s.blocksStandalone : null,
        style,
      ]}
      {...props}
    />
  );
});
