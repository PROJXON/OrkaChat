import React from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

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
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <View style={[styles.summaryModal, isDark ? styles.summaryModalDark : null]}>
          <Text style={[styles.summaryTitle, isDark ? styles.summaryTitleDark : null]}>
            Channel Name
          </Text>
          <TextInput
            value={draft}
            onChangeText={onChangeDraft}
            placeholder="Channel name"
            maxLength={21}
            placeholderTextColor={isDark ? PALETTE.slate400 : PALETTE.slate350}
            selectionColor={isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary}
            cursorColor={isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary}
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
