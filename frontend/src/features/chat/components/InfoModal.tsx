import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  isDark: boolean;
  styles: Record<string, any>;
  title: string;
  body: string;
  onClose: () => void;
};

export function InfoModal({ visible, isDark, styles, title, body, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.summaryModal, isDark ? styles.summaryModalDark : null]}>
          <Text style={[styles.summaryTitle, isDark ? styles.summaryTitleDark : null]}>{title}</Text>
          <Text style={[styles.summaryText, isDark ? styles.summaryTextDark : null]}>{body}</Text>
          <View style={styles.summaryButtons}>
            <Pressable style={[styles.toolBtn, isDark ? styles.toolBtnDark : null]} onPress={onClose}>
              <Text style={[styles.toolBtnText, isDark ? styles.toolBtnTextDark : null]}>OK</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
