import React from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

import type { ChatScreenStyles } from '../../../screens/ChatScreen.styles';

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

export function ChannelPasswordModal({ visible, isDark, styles, busy, draft, onChangeDraft, onSave, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <View style={[styles.summaryModal, isDark ? styles.summaryModalDark : null]}>
          <Text style={[styles.summaryTitle, isDark ? styles.summaryTitleDark : null]}>Channel Password</Text>
          <TextInput
            value={draft}
            onChangeText={onChangeDraft}
            placeholder="Password"
            placeholderTextColor={isDark ? '#8f8fa3' : '#999'}
            selectionColor={isDark ? '#ffffff' : '#111'}
            cursorColor={isDark ? '#ffffff' : '#111'}
            secureTextEntry
            style={{
              width: '100%',
              height: 48,
              paddingHorizontal: 12,
              borderWidth: 1,
              borderRadius: 10,
              marginTop: 10,
              backgroundColor: isDark ? '#1c1c22' : '#f2f2f7',
              borderColor: isDark ? '#3a3a46' : '#e3e3e3',
              color: isDark ? '#ffffff' : '#111',
              fontSize: 16,
            }}
            editable
            autoFocus
          />
          <View style={styles.summaryButtons}>
            <Pressable
              style={[styles.toolBtn, isDark ? styles.toolBtnDark : null, busy ? { opacity: 0.6 } : null]}
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
              <Text style={[styles.toolBtnText, isDark ? styles.toolBtnTextDark : null]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
