import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import type { ChatScreenStyles } from '../../../screens/ChatScreen.styles';

type Props = {
  visible: boolean;
  isDark: boolean;
  styles: ChatScreenStyles;
  text: string;
  onClose: () => void;
};

export function CiphertextModal({ visible, isDark, styles, text, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.summaryModal, isDark ? styles.summaryModalDark : null]}>
          <Text style={[styles.summaryTitle, isDark ? styles.summaryTitleDark : null]}>
            Encrypted Payload
          </Text>
          <ScrollView style={styles.summaryScroll}>
            <Text style={[styles.summaryText, isDark ? styles.summaryTextDark : null]}>
              {text || '(empty)'}
            </Text>
          </ScrollView>
          <View style={styles.summaryButtons}>
            <Pressable
              style={[styles.toolBtn, isDark ? styles.toolBtnDark : null]}
              onPress={onClose}
            >
              <Text style={[styles.toolBtnText, isDark ? styles.toolBtnTextDark : null]}>
                Close
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
