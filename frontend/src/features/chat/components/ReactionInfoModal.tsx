import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import type { TextStyle, ViewStyle } from 'react-native';
import type { ChatScreenStyles } from '../../../screens/ChatScreen.styles';

export type ReactionInfoModalStyles = {
  modalOverlay: ViewStyle;
  summaryModal: ViewStyle;
  summaryModalDark: ViewStyle;
  summaryTitle: TextStyle;
  summaryTitleDark: TextStyle;
  summaryScroll: ViewStyle;
  summaryText: TextStyle;
  summaryTextDark: TextStyle;
  summaryButtons: ViewStyle;
  toolBtn: ViewStyle;
  toolBtnDark: ViewStyle;
  toolBtnText: TextStyle;
  toolBtnTextDark: TextStyle;
  reactionInfoRow: ViewStyle;
  reactionInfoRemoveHint: TextStyle;
};

type Props = {
  visible: boolean;
  isDark: boolean;
  styles: ReactionInfoModalStyles;
  emoji: string;
  subsSorted: string[];
  myUserId: string | null | undefined;
  nameBySub: Record<string, string>;
  onRemoveMine?: () => void;
  closeLabel?: string;
  onClose: () => void;
};

export function ReactionInfoModal({
  visible,
  isDark,
  styles,
  emoji,
  subsSorted,
  myUserId,
  nameBySub,
  onRemoveMine,
  closeLabel = 'Close',
  onClose,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.summaryModal, isDark ? styles.summaryModalDark : null]}>
          <Text style={[styles.summaryTitle, isDark ? styles.summaryTitleDark : null]}>
            Reactions {emoji ? `· ${emoji}` : ''}
          </Text>
          <ScrollView style={styles.summaryScroll}>
            {subsSorted.length ? (
              subsSorted.map((sub) => {
                const isMe = !!myUserId && sub === myUserId;
                const label = isMe ? 'You' : nameBySub[sub] || `${String(sub).slice(0, 6)}…${String(sub).slice(-4)}`;
                return (
                  <Pressable
                    key={sub}
                    onPress={() => {
                      // Signal-like: allow removing your reaction from the reaction list view.
                      if (!isMe) return;
                      if (!onRemoveMine) return;
                      onRemoveMine();
                    }}
                    disabled={!isMe}
                    style={({ pressed }) => [pressed && isMe ? { opacity: 0.7 } : null]}
                    accessibilityRole={isMe ? 'button' : undefined}
                    accessibilityLabel={isMe ? 'Remove reaction' : undefined}
                  >
                    <View style={styles.reactionInfoRow}>
                      <Text
                        style={[
                          styles.summaryText,
                          isDark ? styles.summaryTextDark : null,
                          isMe ? { fontWeight: '800' } : null,
                        ]}
                      >
                        {label}
                      </Text>
                      {isMe ? (
                        <Text
                          style={[
                            styles.summaryText,
                            isDark ? styles.summaryTextDark : null,
                            styles.reactionInfoRemoveHint,
                          ]}
                        >
                          Tap to remove
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })
            ) : (
              <Text style={[styles.summaryText, isDark ? styles.summaryTextDark : null]}>No reactions.</Text>
            )}
          </ScrollView>
          <View style={styles.summaryButtons}>
            <Pressable style={[styles.toolBtn, isDark ? styles.toolBtnDark : null]} onPress={onClose}>
              <Text style={[styles.toolBtnText, isDark ? styles.toolBtnTextDark : null]}>{closeLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
