import { fireEvent, render } from '@testing-library/react-native';
import * as React from 'react';
import { StyleSheet } from 'react-native';

import { APP_COLORS, PALETTE } from '../../theme/colors';

type PlatformOS = 'ios' | 'web';

function loadAppTextInputForPlatform(os: PlatformOS) {
  jest.resetModules();

  // Mock react-native *before* importing the component so Platform.OS branches
  // are evaluated correctly at module load time.
  jest.doMock('react-native', () => {
    const RN = jest.requireActual('react-native');
    return {
      ...RN,
      Platform: { ...RN.Platform, OS: os },
    };
  });

  let AppTextInput: unknown;

  jest.isolateModules(() => {
    AppTextInput = require('../AppTextInput').AppTextInput;
  });

  return { AppTextInput: AppTextInput as React.ComponentType<any> };
}

function getInput(screen: ReturnType<typeof render>, testID = 'input') {
  return screen.getByTestId(testID);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AppTextInput (native branch)', () => {
  test('defaults placeholder/selection/cursor colors for light mode', () => {
    const { AppTextInput } = loadAppTextInputForPlatform('ios');

    const screen = render(
      <AppTextInput testID="input" isDark={false} value="" onChangeText={() => {}} />,
    );

    const input = getInput(screen);

    expect(input.props.placeholderTextColor).toBe(PALETTE.slate350);
    expect(input.props.selectionColor).toBe(APP_COLORS.light.text.primary);
    expect(input.props.cursorColor).toBe(APP_COLORS.light.text.primary);
  });

  test('defaults placeholder/selection/cursor colors for dark mode', () => {
    const { AppTextInput } = loadAppTextInputForPlatform('ios');

    const screen = render(<AppTextInput testID="input" isDark value="" onChangeText={() => {}} />);

    const input = getInput(screen);

    expect(input.props.placeholderTextColor).toBe(PALETTE.slate400);
    expect(input.props.selectionColor).toBe(APP_COLORS.dark.text.primary);
    expect(input.props.cursorColor).toBe(APP_COLORS.dark.text.primary);
  });

  test('respects explicit color overrides', () => {
    const { AppTextInput } = loadAppTextInputForPlatform('ios');

    const screen = render(
      <AppTextInput
        testID="input"
        isDark={false}
        value=""
        onChangeText={() => {}}
        placeholderTextColor="hotpink"
        selectionColor="gold"
        cursorColor="cyan"
      />,
    );

    const input = getInput(screen);

    expect(input.props.placeholderTextColor).toBe('hotpink');
    expect(input.props.selectionColor).toBe('gold');
    expect(input.props.cursorColor).toBe('cyan');
  });

  test('composes baseStyle + darkStyle and supports blocksStandalone variant', () => {
    const { AppTextInput } = loadAppTextInputForPlatform('ios');

    const baseStyle = { backgroundColor: 'red', borderWidth: 1 };
    const darkStyle = { backgroundColor: 'black' };

    const screen = render(
      <AppTextInput
        testID="input"
        isDark
        value=""
        onChangeText={() => {}}
        baseStyle={baseStyle}
        darkStyle={darkStyle}
        variant="blocksStandalone"
      />,
    );

    const input = getInput(screen);
    const flattened = StyleSheet.flatten(input.props.style);

    // darkStyle should override baseStyle when isDark is true
    expect(flattened.backgroundColor).toBe('black');
    // blocksStandalone variant contributes stable sizing/layout fields
    expect(flattened.height).toBe(44);
    expect(flattened.width).toBe('100%');
  });

  test('calls onFocus/onBlur and toggles focus style (native uses elevation)', () => {
    const { AppTextInput } = loadAppTextInputForPlatform('ios');

    const onFocus = jest.fn();
    const onBlur = jest.fn();

    const screen = render(
      <AppTextInput
        testID="input"
        isDark={false}
        value=""
        onChangeText={() => {}}
        onFocus={onFocus}
        onBlur={onBlur}
      />,
    );

    const input = getInput(screen);

    // Not focused initially
    expect(StyleSheet.flatten(input.props.style).elevation).toBeUndefined();

    fireEvent(input, 'focus');
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(StyleSheet.flatten(getInput(screen).props.style).elevation).toBe(2);

    fireEvent(getInput(screen), 'blur');
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(StyleSheet.flatten(getInput(screen).props.style).elevation).toBeUndefined();
  });
});

describe('AppTextInput (web branch)', () => {
  test('Enter (no shift) calls onSubmitEditing and prevents default', () => {
    const { AppTextInput } = loadAppTextInputForPlatform('web');

    const onKeyPress = jest.fn();
    const onSubmitEditing = jest.fn();
    const preventDefault = jest.fn();
    const stopPropagation = jest.fn();

    const screen = render(
      <AppTextInput
        testID="input"
        isDark={false}
        value=""
        onChangeText={() => {}}
        onKeyPress={onKeyPress}
        onSubmitEditing={onSubmitEditing}
      />,
    );

    const input = getInput(screen);

    fireEvent(input, 'keyPress', {
      nativeEvent: { key: 'Enter', shiftKey: false },
      preventDefault,
      stopPropagation,
    });

    expect(onKeyPress).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(onSubmitEditing).toHaveBeenCalledTimes(1);
  });

  test('Shift+Enter does not submit', () => {
    const { AppTextInput } = loadAppTextInputForPlatform('web');

    const onSubmitEditing = jest.fn();
    const preventDefault = jest.fn();
    const stopPropagation = jest.fn();

    const screen = render(
      <AppTextInput
        testID="input"
        isDark={false}
        value=""
        onChangeText={() => {}}
        onSubmitEditing={onSubmitEditing}
      />,
    );

    fireEvent(getInput(screen), 'keyPress', {
      nativeEvent: { key: 'Enter', shiftKey: true },
      preventDefault,
      stopPropagation,
    });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(stopPropagation).not.toHaveBeenCalled();
    expect(onSubmitEditing).not.toHaveBeenCalled();
  });

  test('multiline inputs do not intercept Enter to submit', () => {
    const { AppTextInput } = loadAppTextInputForPlatform('web');

    const onKeyPress = jest.fn();
    const onSubmitEditing = jest.fn();
    const preventDefault = jest.fn();
    const stopPropagation = jest.fn();

    const screen = render(
      <AppTextInput
        testID="input"
        isDark={false}
        value=""
        onChangeText={() => {}}
        multiline
        onKeyPress={onKeyPress}
        onSubmitEditing={onSubmitEditing}
      />,
    );

    fireEvent(getInput(screen), 'keyPress', {
      nativeEvent: { key: 'Enter', shiftKey: false },
      preventDefault,
      stopPropagation,
    });

    // Still calls caller's onKeyPress, but should not route to submit in multiline mode.
    expect(onKeyPress).toHaveBeenCalledTimes(1);
    expect(onSubmitEditing).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
    expect(stopPropagation).not.toHaveBeenCalled();
  });
});
