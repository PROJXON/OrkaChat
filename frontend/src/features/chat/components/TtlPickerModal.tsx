import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export type TtlOption = { label: string; seconds: number };

type Props = {
  visible: boolean;
  isDark: boolean;
  styles: Record<string, any>;
  options: TtlOption[];
  draftIdx: number;
  onSelectIdx: (idx: number) => void;
  onCancel: () => void;
  onDone: () => void;
};

export function TtlPickerModal({ visible, isDark, styles, options, draftIdx, onSelectIdx, onCancel, onDone }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={[styles.summaryModal, isDark ? styles.summaryModalDark : null]}>
          <Text style={[styles.summaryTitle, isDark ? styles.summaryTitleDark : null]}>Self-Destructing Messages</Text>
          <Text style={[styles.summaryText, isDark ? styles.summaryTextDark : null]}>
            Messages will disappear after the selected time from when they are sent
          </Text>
          <View style={{ height: 12 }} />
          <View style={{ flexGrow: 1, flexShrink: 1, minHeight: 0 }}>
            <ScrollView
              style={{ flexGrow: 1 }}
              contentContainerStyle={{ paddingBottom: 4 }}
              showsVerticalScrollIndicator
            >
              {options.map((opt, idx) => {
                const selected = idx === draftIdx;
                return (
                  <Pressable
                    key={opt.label}
                    style={[
                      styles.ttlOptionRow,
                      isDark ? styles.ttlOptionRowDark : null,
                      selected ? (isDark ? styles.ttlOptionRowSelectedDark : styles.ttlOptionRowSelected) : null,
                    ]}
                    onPress={() => onSelectIdx(idx)}
                  >
                    <Text
                      style={[
                        styles.ttlOptionLabel,
                        isDark ? styles.ttlOptionLabelDark : null,
                        selected && !isDark ? styles.ttlOptionLabelSelected : null,
                      ]}
                    >
                      {opt.label}
                    </Text>
                    <Text
                      style={[
                        styles.ttlOptionRadio,
                        isDark ? styles.ttlOptionLabelDark : null,
                        selected && !isDark ? styles.ttlOptionRadioSelected : null,
                      ]}
                    >
                      {selected ? '◉' : '○'}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
          <View style={styles.summaryButtons}>
            <Pressable style={[styles.toolBtn, isDark ? styles.toolBtnDark : null]} onPress={onDone}>
              <Text style={[styles.toolBtnText, isDark ? styles.toolBtnTextDark : null]}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
