import { icons } from '@aws-amplify/ui-react-native/dist/assets';
import React from 'react';
import { Image, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppTextInput } from '../../../components/AppTextInput';
import {
  calcCenteredModalBottomPadding,
  useKeyboardOverlap,
} from '../../../hooks/useKeyboardOverlap';
import type { ChatScreenStyles } from '../../../screens/ChatScreen.styles';
import { APP_COLORS, PALETTE } from '../../../theme/colors';

type Props = {
  visible: boolean;
  isDark: boolean;
  styles: ChatScreenStyles;
  busy: boolean;
  draft: string;
  onChangeDraft: (t: string) => void;
  onSave: () => void | Promise<void>;
  onCancel: () => void;
};

export function ChannelPasswordModal({
  visible,
  isDark,
  styles,
  busy,
  draft,
  onChangeDraft,
  onSave,
  onCancel,
}: Props) {
  const kb = useKeyboardOverlap({ enabled: visible });
  const [passwordVisible, setPasswordVisible] = React.useState<boolean>(false);
  React.useEffect(() => {
    if (!visible) setPasswordVisible(false);
  }, [visible]);
  const [sheetHeight, setSheetHeight] = React.useState<number>(0);
  const bottomPad = React.useMemo(
    () =>
      calcCenteredModalBottomPadding(
        {
          keyboardVisible: kb.keyboardVisible,
          remainingOverlap: kb.remainingOverlap,
          windowHeight: kb.windowHeight,
        },
        sheetHeight,
        12,
      ),
    [kb.keyboardVisible, kb.remainingOverlap, kb.windowHeight, sheetHeight],
  );
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View
        style={[
          styles.modalOverlay,
          Platform.OS !== 'web' && bottomPad > 0 ? { paddingBottom: bottomPad } : null,
        ]}
      >
        <View
          style={[
            styles.summaryModal,
            isDark ? styles.summaryModalDark : null,
            Platform.OS !== 'web' && kb.keyboardVisible
              ? { maxHeight: kb.availableHeightAboveKeyboard, minHeight: 0 }
              : null,
          ]}
          onLayout={(e) => {
            const h = e?.nativeEvent?.layout?.height;
            if (typeof h === 'number' && Number.isFinite(h) && h > 0) setSheetHeight(h);
          }}
        >
          <Text style={[styles.summaryTitle, isDark ? styles.summaryTitleDark : null]}>
            Set Channel Password
          </Text>
          <View style={{ width: '100%', marginTop: 10 }}>
            <AppTextInput
              isDark={isDark}
              value={draft}
              onChangeText={onChangeDraft}
              placeholder="Password"
              secureTextEntry={!passwordVisible}
              returnKeyType="done"
              onSubmitEditing={() => void Promise.resolve(onSave())}
              style={{
                width: '100%',
                height: 48,
                paddingHorizontal: 12,
                paddingRight: 44, // space for the eye button
                borderWidth: 1,
                borderRadius: 10,
                backgroundColor: isDark ? APP_COLORS.dark.bg.header : APP_COLORS.light.bg.surface2,
                borderColor: isDark
                  ? APP_COLORS.dark.border.default
                  : APP_COLORS.light.border.subtle,
                color: isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary,
                fontSize: 16,
              }}
              editable
              autoFocus
            />
            <Pressable
              style={({ pressed }) => [
                s.eyeBtn,
                busy ? { opacity: 0.45 } : pressed ? { opacity: 0.85 } : null,
              ]}
              onPress={() => setPasswordVisible((v) => !v)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
            >
              <Image
                source={passwordVisible ? icons.visibilityOn : icons.visibilityOff}
                tintColor={isDark ? PALETTE.slate400 : PALETTE.slate450}
                style={{ width: 18, height: 18 }}
              />
            </Pressable>
          </View>
          <View style={styles.summaryButtons}>
            <Pressable
              style={[
                styles.toolBtn,
                isDark ? styles.toolBtnDark : null,
                busy ? { opacity: 0.6 } : null,
              ]}
              disabled={busy}
              onPress={() => void Promise.resolve(onSave())}
            >
              <Text style={[styles.toolBtnText, isDark ? styles.toolBtnTextDark : null]}>Save</Text>
            </Pressable>
            <Pressable
              style={[
                styles.toolBtn,
                isDark ? styles.toolBtnDark : null,
                busy ? { opacity: 0.6 } : null,
                // Some RN versions don't support `gap` reliably; enforce spacing explicitly.
                { marginLeft: 10 },
              ]}
              disabled={busy}
              onPress={onCancel}
            >
              <Text style={[styles.toolBtnText, isDark ? styles.toolBtnTextDark : null]}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  eyeBtn: {
    position: 'absolute',
    right: 10,
    top: 0,
    height: 48,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
