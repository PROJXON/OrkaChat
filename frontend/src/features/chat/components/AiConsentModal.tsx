import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import type { ChatScreenStyles } from '../../../screens/ChatScreen.styles';

type Props = {
  visible: boolean;
  isDark: boolean;
  // Uses ChatScreen's style keys for now (pure extraction).
  styles: ChatScreenStyles;
  onProceed: () => void;
  onCancel: () => void;
};

export function AiConsentModal({ visible, isDark, styles, onProceed, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <View style={[styles.summaryModal, isDark ? styles.summaryModalDark : null]}>
          <Text style={[styles.summaryTitle, isDark ? styles.summaryTitleDark : null]}>
            Privacy Notice
          </Text>
          <ScrollView style={styles.summaryScroll}>
            <Text style={[styles.summaryText, isDark ? styles.summaryTextDark : null]}>
              This is an encrypted chat. Using AI Helper / Summarize will send message content
              (decrypted on-device) to a third-party AI provider to generate a response.
            </Text>
          </ScrollView>
          <View style={styles.summaryButtons}>
            <Pressable
              style={[styles.toolBtn, isDark ? styles.toolBtnDark : null]}
              onPress={onProceed}
            >
              <Text style={[styles.toolBtnText, isDark ? styles.toolBtnTextDark : null]}>
                Proceed
              </Text>
            </Pressable>
            <Pressable
              style={[styles.toolBtn, isDark ? styles.toolBtnDark : null]}
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
