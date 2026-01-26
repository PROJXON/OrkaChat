import { fireEvent, render } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import * as React from 'react';
import { Platform, TextInput } from 'react-native';

import { ChatComposer } from '../ChatComposer';

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  return {
    MaterialIcons: function MockMaterialIcons() {
      return React.createElement(React.Fragment, null);
    },
  };
});

jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => {
  const React = require('react');
  return function MockMaterialCommunityIcons() {
    return React.createElement(React.Fragment, null);
  };
});

jest.mock('../VoiceClipMicButton', () => {
  const React = require('react');
  return {
    VoiceClipMicButton: function MockVoiceClipMicButton() {
      return React.createElement(React.Fragment, null);
    },
  };
});

jest.mock('../../../../components/AnimatedDots', () => {
  const React = require('react');
  return {
    AnimatedDots: function MockAnimatedDots() {
      return React.createElement(React.Fragment, null);
    },
  };
});

type PlatformOS = 'ios' | 'web';

function withPlatformOS<T>(os: PlatformOS, run: () => T): T {
  const originalOS = Platform.OS;
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  try {
    return run();
  } finally {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
  }
}

function withWindow<T>(w: Partial<Window> | undefined, run: () => T): T {
  const g = globalThis as unknown as { window?: unknown };
  const original = g.window;
  if (typeof w === 'undefined') delete g.window;
  else g.window = w as unknown as Window;

  try {
    return run();
  } finally {
    if (typeof original === 'undefined') delete g.window;
    else g.window = original;
  }
}

type Props = ComponentProps<typeof ChatComposer>;

function makeProps(overrides: Partial<Props> = {}): Props {
  return {
    styles: {} as any,
    isDark: false,
    myUserId: 'me',
    isDm: true,
    isGroup: false,
    isEncryptedChat: false,
    groupMeta: null,

    inlineEditTargetId: null,
    inlineEditUploading: false,
    cancelInlineEdit: () => {},

    pendingMedia: [],
    setPendingMedia: () => {},
    isUploading: false,

    replyTarget: null,
    setReplyTarget: () => {},
    messages: [],
    openViewer: () => {},

    typingIndicatorText: '',
    TypingIndicator: () => null,
    typingColor: '#000',

    mentionSuggestions: [],
    insertMention: () => {},

    composerSafeAreaStyle: {},
    composerHorizontalInsetsStyle: {},
    composerBottomInsetBgHeight: 0,
    androidKeyboardLift: 0,
    isWideChatLayout: false,

    textInputRef: { current: null } as { current: TextInput | null },
    inputEpoch: 0,
    input: '',
    onChangeInput: () => {},
    isTypingRef: { current: false } as { current: boolean },
    sendTyping: () => {},
    sendMessage: () => {},

    handlePickMedia: () => {},
    showAlert: () => {},
    stopAudioPlayback: () => {},

    ...overrides,
  };
}

function getComposerInput(screen: ReturnType<typeof render>) {
  return screen.UNSAFE_getByType(TextInput);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ChatComposer (web Enter-to-send behavior)', () => {
  test('desktop web: Enter (no shift) prevents default and calls sendMessage', () => {
    withPlatformOS('web', () => {
      withWindow(undefined, () => {
        const sendMessage = jest.fn();
        const preventDefault = jest.fn();
        const stopPropagation = jest.fn();

        const screen = render(<ChatComposer {...makeProps({ sendMessage })} />);
        const input = getComposerInput(screen);

        input.props.onKeyPress?.({
          nativeEvent: { key: 'Enter', shiftKey: false },
          preventDefault,
          stopPropagation,
        });

        expect(preventDefault).toHaveBeenCalledTimes(1);
        expect(stopPropagation).toHaveBeenCalledTimes(1);
        expect(sendMessage).toHaveBeenCalledTimes(1);
      });
    });
  });

  test('desktop web: Shift+Enter does not send', () => {
    withPlatformOS('web', () => {
      withWindow(undefined, () => {
        const sendMessage = jest.fn();
        const preventDefault = jest.fn();
        const stopPropagation = jest.fn();

        const screen = render(<ChatComposer {...makeProps({ sendMessage })} />);
        const input = getComposerInput(screen);

        input.props.onKeyPress?.({
          nativeEvent: { key: 'Enter', shiftKey: true },
          preventDefault,
          stopPropagation,
        });

        expect(preventDefault).not.toHaveBeenCalled();
        expect(stopPropagation).not.toHaveBeenCalled();
        expect(sendMessage).not.toHaveBeenCalled();
      });
    });
  });

  test('desktop web: IME composing does not send', () => {
    withPlatformOS('web', () => {
      withWindow(undefined, () => {
        const sendMessage = jest.fn();
        const preventDefault = jest.fn();
        const stopPropagation = jest.fn();

        const screen = render(<ChatComposer {...makeProps({ sendMessage })} />);
        const input = getComposerInput(screen);

        input.props.onKeyPress?.({
          nativeEvent: { key: 'Enter', shiftKey: false, isComposing: true },
          preventDefault,
          stopPropagation,
        });

        expect(preventDefault).not.toHaveBeenCalled();
        expect(stopPropagation).not.toHaveBeenCalled();
        expect(sendMessage).not.toHaveBeenCalled();
      });
    });
  });

  test('mobile web: Enter does not auto-send (users use Send button)', () => {
    withPlatformOS('web', () => {
      // Force isMobileWeb=true by providing a narrow window.
      withWindow(
        {
          innerWidth: 375,
          matchMedia: () => ({ matches: false }) as any,
        },
        () => {
          const sendMessage = jest.fn();
          const preventDefault = jest.fn();
          const stopPropagation = jest.fn();

          const screen = render(<ChatComposer {...makeProps({ sendMessage })} />);
          const input = getComposerInput(screen);

          input.props.onKeyPress?.({
            nativeEvent: { key: 'Enter', shiftKey: false },
            preventDefault,
            stopPropagation,
          });

          expect(preventDefault).not.toHaveBeenCalled();
          expect(stopPropagation).not.toHaveBeenCalled();
          expect(sendMessage).not.toHaveBeenCalled();
        },
      );
    });
  });
  test('native: pressing the Send button calls sendMessage', () => {
    withPlatformOS('ios', () => {
      const sendMessage = jest.fn();

      const screen = render(<ChatComposer {...makeProps({ sendMessage })} />);
      fireEvent.press(screen.getByText('Send'));

      expect(sendMessage).toHaveBeenCalledTimes(1);
    });
  });
});
