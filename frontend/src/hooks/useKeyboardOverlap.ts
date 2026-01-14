import * as React from 'react';
import { Keyboard, Platform, useWindowDimensions } from 'react-native';

export type KeyboardOverlap = {
  keyboardVisible: boolean;
  keyboardHeight: number;
  windowDelta: number;
  remainingOverlap: number;
  availableHeightAboveKeyboard: number;
  windowHeight: number;
};

// Android keyboards sometimes have extra IME chrome (suggestion bar/handle) not reflected
// consistently in `endCoordinates.height` across devices/emulators. Add a small buffer so
// modals reliably clear the keyboard with a visible gap.
const ANDROID_IME_CHROME_BUFFER_PX = 25;

/**
 * For a centered sheet, `paddingBottom` shifts its center upward by ~paddingBottom/2.
 * This returns the minimal bottom padding needed to ensure the sheet clears the keyboard
 * with a visual gap, while keeping it centered when there's already enough space.
 */
export function calcCenteredModalBottomPadding(
  kb: Pick<KeyboardOverlap, 'keyboardVisible' | 'remainingOverlap' | 'windowHeight'>,
  sheetHeight: number,
  gap: number,
): number {
  if (!kb.keyboardVisible) return 0;
  if (!(kb.remainingOverlap > 0)) return 0;

  // If we don't know the sheet height yet, fall back to the previous conservative behavior.
  if (!(sheetHeight > 0)) return kb.remainingOverlap + gap;

  // Condition for "no lift needed" when centered:
  // bottomOfSheet = (windowHeight + sheetHeight)/2
  // keyboardTopWithGap = windowHeight - remainingOverlap - gap
  // We need bottomOfSheet <= keyboardTopWithGap.
  //
  // With `paddingBottom = P`, the center shifts up by P/2, so bottom becomes:
  // (windowHeight - P + sheetHeight)/2
  //
  // Solve for smallest P that satisfies:
  // (windowHeight - P + sheetHeight)/2 <= windowHeight - remainingOverlap - gap
  // => P >= sheetHeight - windowHeight + 2*remainingOverlap + 2*gap
  const p = sheetHeight - kb.windowHeight + 2 * kb.remainingOverlap + 2 * gap;
  return p > 0 ? p : 0;
}

/**
 * Cross-platform keyboard overlap helper for modals/sheets.
 *
 * - Android IMEs vary: adjustResize vs partial resize vs adjustPan.
 *   We compute remainingOverlap = keyboardHeight - windowShrinkDelta.
 * - iOS typically does not resize the window; remainingOverlap ~= keyboardHeight.
 *
 * Important: resets state when disabled so modals stay centered when closed.
 */
export function useKeyboardOverlap(opts: { enabled: boolean }): KeyboardOverlap {
  const { enabled } = opts;
  const { height: windowHeight } = useWindowDimensions();

  const [keyboardVisible, setKeyboardVisible] = React.useState(false);
  const [keyboardHeight, setKeyboardHeight] = React.useState<number>(0);
  const [windowDelta, setWindowDelta] = React.useState<number>(0);
  const heightBeforeKeyboardRef = React.useRef<number>(windowHeight);

  React.useEffect(() => {
    if (!enabled) {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
      setWindowDelta(0);
    }
  }, [enabled]);

  const handleFrame = React.useCallback((e: unknown) => {
    const hRaw =
      e &&
      typeof e === 'object' &&
      typeof (e as { endCoordinates?: unknown }).endCoordinates === 'object'
        ? (e as { endCoordinates?: { height?: unknown } }).endCoordinates?.height
        : 0;
    const h = typeof hRaw === 'number' && Number.isFinite(hRaw) ? hRaw : Number(hRaw) || 0;
    if (h > 0) {
      setKeyboardVisible(true);
      setKeyboardHeight(h);
    }
  }, []);

  React.useEffect(() => {
    if (!enabled) return;
    if (Platform.OS === 'web') return;
    const subShow = Keyboard.addListener('keyboardDidShow', handleFrame);
    const subHide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
      setWindowDelta(0);
    });
    // Android: can change height without hiding. iOS: willChangeFrame is the common event.
    const subChangeDid = Keyboard.addListener('keyboardDidChangeFrame', handleFrame);
    const subChangeWill = Keyboard.addListener('keyboardWillChangeFrame', handleFrame);
    return () => {
      subShow.remove();
      subHide.remove();
      subChangeDid.remove();
      subChangeWill.remove();
    };
  }, [enabled, handleFrame]);

  React.useEffect(() => {
    if (!enabled) return;
    if (Platform.OS !== 'android') return;
    if (!keyboardVisible) {
      heightBeforeKeyboardRef.current = windowHeight;
      setWindowDelta(0);
      return;
    }
    const before = heightBeforeKeyboardRef.current;
    const after = windowHeight;
    if (!(before > 0 && after > 0)) return;
    const delta = Math.max(0, before - after);
    if (delta < 6) return;
    setWindowDelta(delta);
  }, [enabled, keyboardVisible, windowHeight]);

  const remainingOverlap = React.useMemo(() => {
    if (!enabled) return 0;
    if (!keyboardVisible) return 0;
    if (!(keyboardHeight > 0)) return 0;
    if (Platform.OS === 'android') {
      const r = Math.max(0, keyboardHeight - windowDelta);
      return r > 0 ? r + ANDROID_IME_CHROME_BUFFER_PX : 0;
    }
    // iOS: windowDelta is not meaningful; treat as full keyboard overlap.
    return keyboardHeight;
  }, [enabled, keyboardHeight, keyboardVisible, windowDelta]);

  const availableHeightAboveKeyboard = React.useMemo(() => {
    if (!enabled) return windowHeight;
    // Reserve some headroom so modal headers/close buttons don't clip.
    // (Overlay padding + top breathing room.)
    const TOP_RESERVE = 72;
    return Math.max(0, windowHeight - remainingOverlap - TOP_RESERVE);
  }, [enabled, remainingOverlap, windowHeight]);

  return {
    keyboardVisible,
    keyboardHeight,
    windowDelta,
    remainingOverlap,
    availableHeightAboveKeyboard,
    windowHeight,
  };
}
