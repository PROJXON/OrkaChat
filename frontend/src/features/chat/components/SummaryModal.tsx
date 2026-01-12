import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { AnimatedDots } from '../../../components/AnimatedDots';

import type { ChatScreenStyles } from '../../../screens/ChatScreen.styles';

type Props = {
  visible: boolean;
  isDark: boolean;
  styles: ChatScreenStyles;
  loading: boolean;
  text: string;
  onClose: () => void;
};

export function SummaryModal({ visible, isDark, styles, loading, text, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.summaryModal, isDark ? styles.summaryModalDark : null]}>
          <Text style={[styles.summaryTitle, isDark ? styles.summaryTitleDark : null]}>Summary</Text>
          {loading ? (
            <View style={styles.summaryLoadingRow}>
              <Text style={[styles.summaryLoadingText, isDark ? styles.summaryTextDark : null]}>Summarizing</Text>
              <AnimatedDots color={isDark ? '#d7d7e0' : '#555'} size={18} />
            </View>
          ) : (
            <ScrollView style={styles.summaryScroll}>
              <Text style={[styles.summaryText, isDark ? styles.summaryTextDark : null]}>
                {text.length ? text : 'No summary returned.'}
              </Text>
            </ScrollView>
          )}
          <View style={styles.summaryButtons}>
            <Pressable style={[styles.toolBtn, isDark ? styles.toolBtnDark : null]} onPress={onClose}>
              <Text style={[styles.toolBtnText, isDark ? styles.toolBtnTextDark : null]}>Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
