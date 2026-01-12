import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import type { AppStyles } from '../../../../App.styles';
import { AnimatedDots } from '../../../components/AnimatedDots';

export function MainAppBlocklistModal({
  styles,
  isDark,
  blocklistOpen,
  setBlocklistOpen,
  blockUsername,
  setBlockUsername,
  blockError,
  setBlockError,
  addBlockByUsername,
  blocklistLoading,
  blockedUsers,
  unblockUser,
}: {
  styles: AppStyles;
  isDark: boolean;

  blocklistOpen: boolean;
  setBlocklistOpen: (v: boolean) => void;
  blockUsername: string;
  setBlockUsername: (v: string) => void;
  blockError: string | null;
  setBlockError: (v: string | null) => void;
  addBlockByUsername: () => void | Promise<void>;

  blocklistLoading: boolean;
  blockedUsers: Array<{ blockedSub: string; blockedDisplayName?: string; blockedUsernameLower?: string }>;
  unblockUser: (sub: string, label?: string) => void | Promise<void>;
}): React.JSX.Element {
  return (
    <Modal visible={blocklistOpen} transparent animationType="fade" onRequestClose={() => setBlocklistOpen(false)}>
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setBlocklistOpen(false)} />
        <View style={[styles.blocksCard, isDark ? styles.blocksCardDark : null]}>
          <View style={styles.blocksTopRow}>
            <Text style={[styles.modalTitle, isDark ? styles.modalTitleDark : null]}>Blocklist</Text>
          </View>

          <View style={styles.blocksSearchRow}>
            <TextInput
              value={blockUsername}
              onChangeText={(v) => {
                setBlockUsername(v);
                setBlockError(null);
              }}
              placeholder="Username to block"
              placeholderTextColor={isDark ? '#8f8fa3' : '#999'}
              selectionColor={isDark ? '#ffffff' : '#111'}
              cursorColor={isDark ? '#ffffff' : '#111'}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.blocksInput, isDark ? styles.blocksInputDark : null]}
            />
            <Pressable
              onPress={() => void Promise.resolve(addBlockByUsername())}
              style={({ pressed }) => [styles.blocksBtn, isDark ? styles.blocksBtnDark : null, pressed ? { opacity: 0.9 } : null]}
              accessibilityRole="button"
              accessibilityLabel="Block user"
            >
              <Text style={[styles.blocksBtnText, isDark ? styles.blocksBtnTextDark : null]}>Block</Text>
            </Pressable>
          </View>

          {blockError ? <Text style={[styles.errorText, isDark ? styles.errorTextDark : null]}>{blockError}</Text> : null}

          <ScrollView style={styles.blocksScroll}>
            {blocklistLoading ? (
              <View style={styles.chatsLoadingRow}>
                <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null, styles.chatsLoadingText]}>Loading</Text>
                <View style={styles.chatsLoadingDotsWrap}>
                  <AnimatedDots color={isDark ? '#ffffff' : '#111'} size={18} />
                </View>
              </View>
            ) : blockedUsers.length ? (
              blockedUsers
                .slice()
                .sort((a, b) =>
                  String(a.blockedDisplayName || a.blockedUsernameLower || '').localeCompare(
                    String(b.blockedDisplayName || b.blockedUsernameLower || ''),
                  ),
                )
                .map((b) => (
                  <View key={`blocked:${b.blockedSub}`} style={[styles.blockRow, isDark ? styles.blockRowDark : null]}>
                    <Text style={[styles.blockRowName, isDark ? styles.blockRowNameDark : null]} numberOfLines={1}>
                      {b.blockedDisplayName || b.blockedUsernameLower || b.blockedSub}
                    </Text>
                    <Pressable
                      onPress={() => void Promise.resolve(unblockUser(b.blockedSub, b.blockedDisplayName || b.blockedUsernameLower))}
                      style={({ pressed }) => [
                        styles.blockActionBtn,
                        isDark ? styles.blockActionBtnDark : null,
                        pressed ? { opacity: 0.85 } : null,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Unblock user"
                    >
                      <Feather name="user-check" size={16} color={isDark ? '#fff' : '#111'} />
                    </Pressable>
                  </View>
                ))
            ) : (
              <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null]}>No blocked users</Text>
            )}
          </ScrollView>
          <View style={styles.modalButtons}>
            <Pressable
              style={[styles.modalButton, styles.modalButtonSmall, isDark ? styles.modalButtonDark : null]}
              onPress={() => setBlocklistOpen(false)}
            >
              <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

