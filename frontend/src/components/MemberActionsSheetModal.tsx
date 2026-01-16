import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ChatScreenStyles } from '../screens/ChatScreen.styles';
import { APP_COLORS, PALETTE } from '../theme/colors';

type Action = {
  key: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

type Props = {
  visible: boolean;
  isDark: boolean;
  styles: ChatScreenStyles;
  title: string;
  actions: Action[];
  onClose: () => void;
};

export function MemberActionsSheetModal({
  visible,
  isDark,
  styles,
  title,
  actions,
  onClose,
}: Props): React.JSX.Element {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.actionMenuOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={sheetStyles.centerWrap} pointerEvents="box-none">
          <View style={[styles.actionMenuCard, isDark ? styles.actionMenuCardDark : null]}>
            <View style={[sheetStyles.titleRow, isDark ? sheetStyles.titleRowDark : null]}>
              <Text style={[sheetStyles.titleText, isDark ? sheetStyles.titleTextDark : null]}>
                {title}
              </Text>
            </View>

            <View style={sheetStyles.actionsRow}>
              {actions
                .filter((a) => a && typeof a.label === 'string' && a.label)
                .map((a) => (
                  <Pressable
                    key={a.key}
                    style={({ pressed }) => [
                      styles.toolBtn,
                      isDark ? styles.toolBtnDark : null,
                      pressed ? sheetStyles.btnPressed : null,
                      a.disabled ? { opacity: 0.6 } : null,
                    ]}
                    disabled={!!a.disabled}
                    onPress={() => {
                      onClose();
                      a.onPress();
                    }}
                  >
                    <Text
                      style={[
                        styles.toolBtnText,
                        isDark ? styles.toolBtnTextDark : null,
                      ]}
                    >
                      {a.label}
                    </Text>
                  </Pressable>
                ))}
            </View>

            <View style={sheetStyles.footer}>
              <Pressable
                style={[styles.toolBtn, isDark ? styles.toolBtnDark : null]}
                onPress={onClose}
              >
                <Text style={[styles.toolBtnText, isDark ? styles.toolBtnTextDark : null]}>
                  Cancel
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  titleRow: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.paper200,
  },
  titleRowDark: {
    borderBottomColor: APP_COLORS.dark.border.default,
  },
  titleText: {
    color: APP_COLORS.light.text.primary,
    fontWeight: '800',
    fontSize: 14,
  },
  titleTextDark: { color: APP_COLORS.dark.text.primary },
  actionsRow: {
    padding: 12,
    paddingTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  btnPressed: { opacity: 0.75 },
  footer: {
    padding: 12,
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});

