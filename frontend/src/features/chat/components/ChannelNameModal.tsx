import React from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';

import { AppTextInput } from '../../../components/AppTextInput';
import {
  calcCenteredModalBottomPadding,
  useKeyboardOverlap,
} from '../../../hooks/useKeyboardOverlap';
import type { ChatScreenStyles } from '../../../screens/ChatScreen.styles';
import { APP_COLORS } from '../../../theme/colors';

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

export function ChannelNameModal({
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
            Set Channel Name
          </Text>
          <AppTextInput
            isDark={isDark}
            value={draft}
            onChangeText={onChangeDraft}
            placeholder="Channel name"
            maxLength={21}
            returnKeyType="done"
            onSubmitEditing={() => void Promise.resolve(onSave())}
            style={{
              width: '100%',
              height: 48,
              paddingHorizontal: 12,
              borderWidth: 1,
              borderRadius: 10,
              marginTop: 10,
              backgroundColor: isDark ? APP_COLORS.dark.bg.header : APP_COLORS.light.bg.surface2,
              borderColor: isDark ? APP_COLORS.dark.border.default : APP_COLORS.light.border.subtle,
              color: isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary,
              fontSize: 16,
            }}
            editable
            autoFocus
          />
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
