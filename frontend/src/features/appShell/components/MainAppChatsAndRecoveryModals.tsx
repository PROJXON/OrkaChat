import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { AppStyles } from '../../../../App.styles';
import { AnimatedDots } from '../../../components/AnimatedDots';
import { APP_COLORS } from '../../../theme/colors';

export function MainAppChatsAndRecoveryModals({
  styles,
  isDark,
  // Recovery
  recoveryOpen,
  setRecoveryOpen,
  recoveryLocked,
  recoveryBlobKnown,
  hasRecoveryBlob,
  enterRecoveryPassphrase,
  setupRecovery,
  changeRecoveryPassphrase,
  resetRecovery,
  // Chats
  chatsOpen,
  setChatsOpen,
  chatsLoading,
  chatsList,
  goToConversation,
  deleteConversationFromList,
  formatChatActivityDate,
}: {
  styles: AppStyles;
  isDark: boolean;

  recoveryOpen: boolean;
  setRecoveryOpen: (v: boolean) => void;
  recoveryLocked: boolean;
  recoveryBlobKnown: boolean;
  hasRecoveryBlob: boolean;
  enterRecoveryPassphrase: () => void | Promise<void>;
  setupRecovery: () => void | Promise<void>;
  changeRecoveryPassphrase: () => void | Promise<void>;
  resetRecovery: () => void | Promise<void>;

  chatsOpen: boolean;
  setChatsOpen: (v: boolean) => void;
  chatsLoading: boolean;
  chatsList: Array<{
    conversationId: string;
    peer?: string | null;
    lastActivityAt?: number | null;
    unreadCount?: number;
  }>;
  goToConversation: (conversationId: string) => void;
  deleteConversationFromList: (conversationId: string) => void | Promise<void>;
  formatChatActivityDate: (ts: number) => string;
}): React.JSX.Element {
  return (
    <>
      <Modal
        visible={recoveryOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRecoveryOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setRecoveryOpen(false)} />
          <View style={[styles.profileCard, isDark ? styles.profileCardDark : null]}>
            <View style={styles.chatsTopRow}>
              <Text style={[styles.modalTitle, isDark ? styles.modalTitleDark : null]}>
                Recovery
              </Text>
            </View>
            <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null]}>
              {recoveryLocked
                ? 'Recovery is locked on this device. Enter your passphrase to decrypt older messages, or reset recovery if you no longer remember it.'
                : !recoveryBlobKnown
                  ? 'Checking whether your account has a recovery backup...'
                  : hasRecoveryBlob
                    ? 'Your account has a recovery backup. You can change your recovery passphrase here.'
                    : 'Set up a recovery passphrase so you can restore encrypted messages if you switch devices'}
            </Text>

            <View style={styles.recoveryActionList}>
              {recoveryLocked ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.modalButton,
                    styles.modalButtonCta,
                    isDark ? styles.modalButtonCtaDark : null,
                    pressed && { opacity: 0.9 },
                  ]}
                  onPress={async () => {
                    setRecoveryOpen(false);
                    await Promise.resolve(enterRecoveryPassphrase());
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Enter recovery passphrase"
                >
                  <Text style={[styles.modalButtonText, styles.modalButtonCtaText]}>
                    Enter Passphrase
                  </Text>
                </Pressable>
              ) : !recoveryBlobKnown ? null : !hasRecoveryBlob ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.modalButton,
                    styles.modalButtonCta,
                    isDark ? styles.modalButtonCtaDark : null,
                    pressed && { opacity: 0.9 },
                  ]}
                  onPress={async () => {
                    setRecoveryOpen(false);
                    await Promise.resolve(setupRecovery());
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Set up recovery passphrase"
                >
                  <Text style={[styles.modalButtonText, styles.modalButtonCtaText]}>
                    Set Up Recovery Passphrase
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  style={({ pressed }) => [
                    styles.modalButton,
                    isDark ? styles.modalButtonDark : null,
                    pressed && { opacity: 0.9 },
                  ]}
                  onPress={async () => {
                    setRecoveryOpen(false);
                    await Promise.resolve(changeRecoveryPassphrase());
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Change recovery passphrase"
                >
                  <Text
                    style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}
                  >
                    Change Your Recovery Passphrase
                  </Text>
                </Pressable>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  isDark ? styles.modalButtonDark : null,
                  pressed && { opacity: 0.9 },
                ]}
                onPress={async () => {
                  setRecoveryOpen(false);
                  await Promise.resolve(resetRecovery());
                }}
                accessibilityRole="button"
                accessibilityLabel="Reset recovery"
              >
                <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>
                  Reset Recovery
                </Text>
              </Pressable>
            </View>

            <View style={[styles.modalButtons, { justifyContent: 'flex-end', marginTop: 10 }]}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalButtonSmall,
                  isDark ? styles.modalButtonDark : null,
                  pressed ? { opacity: 0.92 } : null,
                ]}
                onPress={() => setRecoveryOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close recovery"
              >
                <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>
                  Close
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={chatsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setChatsOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setChatsOpen(false)} />
          <View style={[styles.chatsCard, isDark ? styles.chatsCardDark : null]}>
            <View style={styles.chatsTopRow}>
              <Text style={[styles.modalTitle, isDark ? styles.modalTitleDark : null]}>Chats</Text>
            </View>
            <ScrollView style={styles.chatsScroll}>
              {chatsLoading ? (
                <View style={styles.chatsLoadingRow}>
                  <Text
                    style={[
                      styles.modalHelperText,
                      isDark ? styles.modalHelperTextDark : null,
                      styles.chatsLoadingText,
                    ]}
                  >
                    Loading
                  </Text>
                  <View style={styles.chatsLoadingDotsWrap}>
                    <AnimatedDots
                      color={isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary}
                      size={18}
                    />
                  </View>
                </View>
              ) : chatsList.length ? (
                chatsList.map((t) => (
                  <Pressable
                    key={`chat:${t.conversationId}`}
                    style={({ pressed }) => [
                      styles.chatRow,
                      isDark ? styles.chatRowDark : null,
                      pressed ? { opacity: 0.9 } : null,
                    ]}
                    onPress={() => {
                      setChatsOpen(false);
                      goToConversation(t.conversationId);
                    }}
                  >
                    <View style={styles.chatRowLeft}>
                      <Text
                        style={[styles.chatRowName, isDark ? styles.chatRowNameDark : null]}
                        numberOfLines={1}
                      >
                        {t.peer || 'Direct Message'}
                      </Text>
                    </View>
                    <View style={styles.chatRowRight}>
                      {t.lastActivityAt ? (
                        <Text
                          style={[styles.chatRowDate, isDark ? styles.chatRowDateDark : null]}
                          numberOfLines={1}
                          accessibilityLabel="Last message date"
                        >
                          {formatChatActivityDate(t.lastActivityAt)}
                        </Text>
                      ) : null}
                      {(t.unreadCount || 0) > 0 ? (
                        <View style={[styles.unreadChip, isDark ? styles.unreadChipDark : null]}>
                          <Text
                            style={[
                              styles.unreadChipText,
                              isDark ? styles.unreadChipTextDark : null,
                            ]}
                          >
                            {t.unreadCount}
                          </Text>
                        </View>
                      ) : null}
                      <Pressable
                        onPress={() =>
                          void Promise.resolve(deleteConversationFromList(t.conversationId))
                        }
                        style={({ pressed }) => [
                          styles.chatDeleteBtn,
                          isDark ? styles.chatDeleteBtnDark : null,
                          pressed ? { opacity: 0.85 } : null,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Remove chat"
                      >
                        <Feather
                          name="trash-2"
                          size={16}
                          color={
                            isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary
                          }
                        />
                      </Pressable>
                    </View>
                  </Pressable>
                ))
              ) : (
                <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null]}>
                  No active chats
                </Text>
              )}
            </ScrollView>
            <View style={styles.modalButtons}>
              <Pressable
                style={[
                  styles.modalButton,
                  styles.modalButtonSmall,
                  isDark ? styles.modalButtonDark : null,
                ]}
                onPress={() => setChatsOpen(false)}
              >
                <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>
                  Close
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
