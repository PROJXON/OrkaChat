import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ChatScreenStyles } from '../../../screens/ChatScreen.styles';

type Props = {
  visible: boolean;
  isDark: boolean;
  styles: ChatScreenStyles;
  onClose: () => void;
  onPickLibrary: () => void;
  onPickCamera: () => void;
  onPickFile: () => void;
};

export function AttachPickerModal({
  visible,
  isDark,
  styles,
  onClose,
  onPickLibrary,
  onPickCamera,
  onPickFile,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.summaryModal, isDark ? styles.summaryModalDark : null]}>
          <Text style={[styles.summaryTitle, isDark ? styles.summaryTitleDark : null]}>Attach</Text>
          <Text style={[styles.summaryLoadingText, isDark ? styles.summaryTextDark : null]}>
            Choose a source
          </Text>

          <View style={{ gap: 10, marginTop: 12 }}>
            <Pressable
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.toolBtn, isDark ? styles.toolBtnDark : null, styles.attachOptionBtn]}
              onPress={onPickLibrary}
            >
              <Text
                style={[
                  styles.toolBtnText,
                  isDark ? styles.toolBtnTextDark : null,
                  styles.attachOptionText,
                ]}
              >
                Photos / Videos
              </Text>
            </Pressable>

            <Pressable
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.toolBtn, isDark ? styles.toolBtnDark : null, styles.attachOptionBtn]}
              onPress={onPickCamera}
            >
              <Text
                style={[
                  styles.toolBtnText,
                  isDark ? styles.toolBtnTextDark : null,
                  styles.attachOptionText,
                ]}
              >
                Camera
              </Text>
            </Pressable>

            <Pressable
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.toolBtn, isDark ? styles.toolBtnDark : null, styles.attachOptionBtn]}
              onPress={onPickFile}
            >
              <Text
                style={[
                  styles.toolBtnText,
                  isDark ? styles.toolBtnTextDark : null,
                  styles.attachOptionText,
                ]}
              >
                File (GIF, etc.)
              </Text>
            </Pressable>
          </View>

          <View style={[styles.summaryButtons, { marginTop: 12 }]}>
            <Pressable
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.toolBtn, isDark ? styles.toolBtnDark : null, styles.attachOptionBtn]}
              onPress={onClose}
            >
              <Text
                style={[
                  styles.toolBtnText,
                  isDark ? styles.toolBtnTextDark : null,
                  styles.attachOptionText,
                ]}
              >
                Close
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
