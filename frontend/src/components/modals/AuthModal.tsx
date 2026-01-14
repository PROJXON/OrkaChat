import { Authenticator, ThemeProvider, useAuthenticator } from '@aws-amplify/ui-react-native/dist';
import React from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { styles } from '../../../App.styles';

// Visual breathing room between the sheet and the keyboard.
// Note: `authModalOverlay` already has `padding: 12`, which creates the baseline gap.
// Keep this at 0 so Auth matches other modals that use a 12px gap.
const KEYBOARD_GAP_PX = 0;
// Android keyboards sometimes have extra IME chrome (suggestion bar/handle) not reflected
// consistently in `endCoordinates.height` across devices/emulators. Add a small buffer so
// the sheet reliably clears the keyboard with a visible gap.
const ANDROID_IME_CHROME_BUFFER_PX = 25;

export type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  isDark: boolean;
  amplifyTheme: React.ComponentProps<typeof ThemeProvider>['theme'];
  authComponents: React.ComponentProps<typeof Authenticator>['components'];
  onAuthed: () => void;
};

function AuthModalGate({ onAuthed }: { onAuthed: () => void }): React.JSX.Element {
  const { user } = useAuthenticator();

  React.useEffect(() => {
    if (user) onAuthed();
  }, [user, onAuthed]);

  return <View />;
}

export function AuthModal({
  open,
  onClose,
  isDark,
  amplifyTheme,
  authComponents,
  onAuthed,
}: AuthModalProps): React.JSX.Element {
  const { height: windowHeight } = useWindowDimensions();
  const [androidKeyboardVisible, setAndroidKeyboardVisible] = React.useState(false);
  const [androidKeyboardHeight, setAndroidKeyboardHeight] = React.useState<number>(0);
  const heightBeforeKeyboardRef = React.useRef<number>(windowHeight);
  const [androidWindowHeightDelta, setAndroidWindowHeightDelta] = React.useState<number>(0);
  const [iosKeyboardVisible, setIosKeyboardVisible] = React.useState(false);

  React.useEffect(() => {
    if (open) return;
    // If the modal closes while the keyboard is up, we might not receive a hide event.
    // Reset local keyboard state so the next open starts centered.
    setAndroidKeyboardVisible(false);
    setAndroidKeyboardHeight(0);
    setAndroidWindowHeightDelta(0);
    setIosKeyboardVisible(false);
  }, [open]);

  const handleAndroidKeyboardFrame = React.useCallback((e: unknown) => {
    const hRaw =
      e &&
      typeof e === 'object' &&
      typeof (e as { endCoordinates?: unknown }).endCoordinates === 'object'
        ? (e as { endCoordinates?: { height?: unknown } }).endCoordinates?.height
        : 0;
    const h = typeof hRaw === 'number' && Number.isFinite(hRaw) ? hRaw : Number(hRaw) || 0;
    // Some IMEs emit "frame" events while staying visible (e.g., toggling number row).
    // Treat any positive height as "keyboard visible".
    if (h > 0) {
      setAndroidKeyboardVisible(true);
      setAndroidKeyboardHeight(h);
    }
  }, []);

  React.useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (!open) return;
    const subShow = Keyboard.addListener('keyboardDidShow', handleAndroidKeyboardFrame);
    // Android can change keyboard height without hiding (suggestion bar / numeric row, etc).
    const subChange = Keyboard.addListener('keyboardDidChangeFrame', handleAndroidKeyboardFrame);
    const subHide = Keyboard.addListener('keyboardDidHide', () => {
      setAndroidKeyboardVisible(false);
      setAndroidKeyboardHeight(0);
      setAndroidWindowHeightDelta(0);
    });
    return () => {
      subShow.remove();
      subChange.remove();
      subHide.remove();
    };
  }, [handleAndroidKeyboardFrame, open]);

  React.useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (!open) return;
    const subShow = Keyboard.addListener('keyboardWillShow', () => setIosKeyboardVisible(true));
    const subChange = Keyboard.addListener('keyboardWillChangeFrame', (e) => {
      // Treat any non-zero height as visible.
      const hRaw =
        e &&
        typeof e === 'object' &&
        typeof (e as { endCoordinates?: unknown }).endCoordinates === 'object'
          ? (e as { endCoordinates?: { height?: unknown } }).endCoordinates?.height
          : 0;
      const h = typeof hRaw === 'number' && Number.isFinite(hRaw) ? hRaw : Number(hRaw) || 0;
      setIosKeyboardVisible(h > 0);
    });
    const subHide = Keyboard.addListener('keyboardWillHide', () => setIosKeyboardVisible(false));
    return () => {
      subShow.remove();
      subChange.remove();
      subHide.remove();
    };
  }, [open]);

  const androidSheetMaxHeight = React.useMemo(() => {
    if (Platform.OS !== 'android') return null;
    if (!open) return null;
    if (!androidKeyboardVisible) return null;
    if (!(androidKeyboardHeight > 0)) return null;
    // Keep the sheet height stable while typing so validation errors don't cause a "jump".
    // Let the inner ScrollView handle overflow instead.
    // Reserve space for overlay padding + a small visible gap above the keyboard.
    const remainingOverlap =
      Math.max(0, androidKeyboardHeight - androidWindowHeightDelta) + ANDROID_IME_CHROME_BUFFER_PX;
    const OVERLAY_VERTICAL_PADDING = 24; // authModalOverlay has padding: 12 (top) + 12 (bottom)
    const available = windowHeight - remainingOverlap - OVERLAY_VERTICAL_PADDING - KEYBOARD_GAP_PX;
    const maxH = 640;
    const h = Math.max(0, Math.min(maxH, Math.floor(available)));
    return h > 0 ? h : null;
  }, [androidKeyboardHeight, androidKeyboardVisible, androidWindowHeightDelta, open, windowHeight]);

  React.useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (!open) return;
    if (!androidKeyboardVisible) {
      heightBeforeKeyboardRef.current = windowHeight;
      setAndroidWindowHeightDelta(0);
      return;
    }
    const before = heightBeforeKeyboardRef.current;
    const after = windowHeight;
    if (!(before > 0 && after > 0)) return;
    const delta = Math.max(0, before - after);
    if (delta < 6) return;
    setAndroidWindowHeightDelta(delta);
  }, [androidKeyboardVisible, open, windowHeight]);

  const androidRemainingOverlap = React.useMemo(() => {
    if (Platform.OS !== 'android') return 0;
    if (!open) return 0;
    if (!androidKeyboardVisible) return 0;
    if (!(androidKeyboardHeight > 0)) return 0;
    return (
      Math.max(0, androidKeyboardHeight - androidWindowHeightDelta) + ANDROID_IME_CHROME_BUFFER_PX
    );
  }, [androidKeyboardHeight, androidKeyboardVisible, androidWindowHeightDelta, open]);

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.authModalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[
            styles.authModalOverlayInner,
            Platform.OS === 'android' && androidKeyboardVisible && androidKeyboardHeight > 0
              ? {
                  // Android: anchor the sheet just above the keyboard (stable, no "jump way up").
                  justifyContent: 'flex-end',
                  paddingBottom: androidRemainingOverlap + KEYBOARD_GAP_PX,
                }
              : null,
          ]}
        >
          <View
            style={[
              styles.authModalSheet,
              isDark && styles.authModalSheetDark,
              Platform.OS === 'ios' && iosKeyboardVisible
                ? { marginBottom: KEYBOARD_GAP_PX }
                : null,
              Platform.OS === 'android' && androidSheetMaxHeight
                ? {
                    // When the keyboard is open, don't force a fixed sheet height (can feel "huge").
                    // Instead, let the sheet wrap content and only cap it to the available space.
                    maxHeight: androidSheetMaxHeight,
                    // Override base minHeight so the sheet can actually shrink when keyboard is open.
                    minHeight: 0,
                  }
                : null,
            ]}
          >
            <View style={[styles.authModalTopRow, isDark && styles.authModalTopRowDark]}>
              <View style={{ width: 44 }} />
              <Text style={[styles.authModalTitle, isDark && styles.authModalTitleDark]}>
                Sign in
              </Text>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.authModalCloseCircle,
                  isDark && styles.authModalCloseCircleDark,
                  pressed && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Close sign in"
              >
                <Text style={[styles.authModalCloseX, isDark && styles.authModalCloseXDark]}>
                  ×
                </Text>
              </Pressable>
            </View>

            <ThemeProvider theme={amplifyTheme} colorMode={isDark ? 'dark' : 'light'}>
              <ScrollView
                style={styles.authModalBody}
                contentContainerStyle={styles.authModalBodyContent}
                keyboardShouldPersistTaps="handled"
              >
                <Authenticator
                  loginMechanisms={['email']}
                  signUpAttributes={['preferred_username']}
                  components={authComponents}
                >
                  <AuthModalGate onAuthed={onAuthed} />
                </Authenticator>
              </ScrollView>
            </ThemeProvider>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
