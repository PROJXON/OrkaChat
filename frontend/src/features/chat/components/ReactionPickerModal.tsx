import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ChatScreenStyles } from '../../../screens/ChatScreen.styles';
import type { ChatMessage } from '../types';

type Props = {
  visible: boolean;
  isDark: boolean;
  styles: ChatScreenStyles;
  target: ChatMessage | null;
  myUserId: string | null | undefined;
  emojis: string[];
  onPick: (emoji: string) => void;
  onClose: () => void;
};

export function ReactionPickerModal({
  visible,
  isDark,
  styles,
  target,
  myUserId,
  emojis,
  onPick,
  onClose,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.summaryModal, isDark ? styles.summaryModalDark : null]}>
          <Text style={[styles.summaryTitle, isDark ? styles.summaryTitleDark : null]}>React</Text>
          <ScrollView
            style={styles.summaryScroll}
            contentContainerStyle={styles.reactionPickerGrid}
          >
            {emojis.map((emoji) => {
              const mine =
                target && myUserId
                  ? (target.reactions?.[emoji]?.userSubs || []).includes(myUserId)
                  : false;
              return (
                <Pressable
                  key={`more:${emoji}`}
                  onPress={() => onPick(emoji)}
                  style={({ pressed }) => [
                    styles.reactionPickerBtn,
                    isDark ? styles.reactionPickerBtnDark : null,
                    mine
                      ? isDark
                        ? styles.reactionPickerBtnMineDark
                        : styles.reactionPickerBtnMine
                      : null,
                    pressed ? { opacity: 0.85 } : null,
                  ]}
                >
                  <Text style={styles.reactionPickerEmoji}>{emoji}</Text>
                </Pressable>
              );
            })}
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
