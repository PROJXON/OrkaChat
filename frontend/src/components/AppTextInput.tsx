import * as React from 'react';
import type { StyleProp, TextInputProps, TextStyle } from 'react-native';
import { Platform, StyleSheet, TextInput } from 'react-native';

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

// NOTE: RN-web warns if `shadow*` style props exist anywhere in a StyleSheet, even if a branch
// is never applied at runtime. Keep `shadow*` out of web bundles entirely.
const focusNativeLight: TextStyle =
  Platform.OS === 'web'
    ? {}
    : {
        shadowColor: PALETTE.black,
        shadowOpacity: 0.18,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 0 },
        elevation: 2,
      };

const focusNativeDark: TextStyle =
  Platform.OS === 'web'
    ? {}
    : {
        shadowColor: PALETTE.white,
        shadowOpacity: 0.22,
        shadowRadius: 7,
        shadowOffset: { width: 0, height: 0 },
        elevation: 2,
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
  // Web: match other inputs (subtle inset ring, no browser default outline).
  focusWebLight: {
    outlineStyle: 'solid',
    outlineWidth: 0,
    outlineColor: 'transparent',
    boxShadow: `inset 0px 0px 0px 1px ${PALETTE.black}`,
  },
  focusWebDark: {
    outlineStyle: 'solid',
    outlineWidth: 0,
    outlineColor: 'transparent',
    boxShadow: `inset 0px 0px 0px 2px ${PALETTE.white}`,
  },
  // Native: use a shadow highlight (avoid borderWidth changes / layout shift).
  focusNativeLight,
  focusNativeDark,
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
    onFocus,
    onBlur,
    onKeyPress,
    onSubmitEditing,
    multiline,
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

  const [focused, setFocused] = React.useState(false);
  const focusStyle =
    Platform.OS === 'web'
      ? isDark
        ? s.focusWebDark
        : s.focusWebLight
      : isDark
        ? s.focusNativeDark
        : s.focusNativeLight;

  return (
    <TextInput
      ref={ref}
      placeholderTextColor={resolvedPlaceholderTextColor}
      selectionColor={resolvedSelectionColor}
      cursorColor={resolvedCursorColor}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[
        baseStyle,
        isDark ? darkStyle : null,
        variant === 'blocksStandalone' ? s.blocksStandalone : null,
        focused ? focusStyle : null,
        style,
      ]}
      multiline={multiline}
      onSubmitEditing={onSubmitEditing}
      // RN-web: Enter can blur instead of submitting. Intercept and route to submit.
      {...(Platform.OS === 'web' && typeof onSubmitEditing === 'function' && !multiline
        ? ({
            onKeyPress: (e: unknown) => {
              onKeyPress?.(e as any);
              const ev = e as {
                nativeEvent?: { key?: string; shiftKey?: boolean };
                preventDefault?: () => void;
                stopPropagation?: () => void;
              };
              const key = String(ev?.nativeEvent?.key ?? '');
              const shift = !!ev?.nativeEvent?.shiftKey;
              if (key === 'Enter' && !shift) {
                ev.preventDefault?.();
                ev.stopPropagation?.();
                // Most callers don't use the event object; keep it simple.
                (onSubmitEditing as unknown as () => void)?.();
              }
            },
          } as const)
        : ({ onKeyPress } as const))}
      {...props}
    />
  );
});
