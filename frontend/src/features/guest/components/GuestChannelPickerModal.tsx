import Feather from '@expo/vector-icons/Feather';
import * as React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AnimatedDots } from '../../../components/AnimatedDots';
import { AppTextInput } from '../../../components/AppTextInput';
import { APP_COLORS } from '../../../theme/colors';

export function GuestChannelPickerModal(props: {
  open: boolean;
  isDark: boolean;
  styles: typeof import('../../../screens/GuestGlobalScreen.styles').styles;
  query: string;
  onChangeQuery: (next: string) => void;
  loading: boolean;
  error: string | null;
  globalUserCount: number | null;
  channels: Array<{
    channelId: string;
    name: string;
    activeMemberCount?: number;
    hasPassword?: boolean;
  }>;
  onPickGlobal: () => void;
  onPickChannel: (channelId: string, name: string) => void;
  onLockedChannel: () => void;
  onClose: () => void;
}) {
  const {
    open,
    isDark,
    styles,
    query,
    onChangeQuery,
    loading,
    error,
    globalUserCount,
    channels,
    onPickGlobal,
    onPickChannel,
    onLockedChannel,
    onClose,
  } = props;

  const trimmedQuery = String(query || '').trim();
  // Match signed-in behavior: Global is a suggestion when empty, otherwise only show it if the
  // query is clearly trying to find "Global" (so it's not "pinned" during unrelated searches).
  const showGlobalRow =
    !trimmedQuery ||
    (trimmedQuery.length >= 2 && 'global'.includes(trimmedQuery.toLowerCase()));

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.modalCard, isDark ? styles.modalCardDark : null]}>
          <Text style={[styles.modalTitle, isDark ? styles.modalTitleDark : null]}>Channels</Text>

          <AppTextInput
            isDark={isDark}
            value={query}
            onChangeText={onChangeQuery}
            placeholder="Search Channels"
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 10,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: isDark ? APP_COLORS.dark.border.subtle : APP_COLORS.light.border.subtle,
              backgroundColor: isDark ? APP_COLORS.dark.bg.header : APP_COLORS.light.bg.surface2,
              color: isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary,
              marginBottom: 10,
            }}
          />

          {error ? (
            <Text style={[styles.errorText, isDark && styles.errorTextDark]} numberOfLines={2}>
              {error}
            </Text>
          ) : null}

          <ScrollView style={styles.modalScroll}>
            {showGlobalRow ? (
              <Pressable
                style={({ pressed }) => [
                  {
                    paddingVertical: 10,
                    paddingHorizontal: 10,
                    minHeight: 44,
                    borderRadius: 12,
                    alignSelf: 'stretch',
                    backgroundColor: isDark
                      ? APP_COLORS.dark.bg.header
                      : APP_COLORS.light.bg.surface2,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: isDark
                      ? APP_COLORS.dark.border.subtle
                      : APP_COLORS.light.border.subtle,
                    marginBottom: 8,
                    opacity: pressed ? 0.85 : 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  },
                ]}
                onPress={onPickGlobal}
                accessibilityRole="button"
                accessibilityLabel="Enter Global"
              >
                <Text
                  style={{
                    color: isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary,
                    fontWeight: '800',
                  }}
                >
                  Global
                </Text>
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 999,
                    backgroundColor: isDark
                      ? APP_COLORS.dark.border.subtle
                      : APP_COLORS.light.bg.app,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: isDark ? 'transparent' : APP_COLORS.light.border.subtle,
                    minWidth: 38,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontWeight: '900',
                      color: isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary,
                    }}
                  >
                    {typeof globalUserCount === 'number' ? String(globalUserCount) : '—'}
                  </Text>
                </View>
              </Pressable>
            ) : null}

            {loading ? (
              <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text
                    style={{
                      color: isDark ? APP_COLORS.dark.text.body : APP_COLORS.light.text.secondary,
                      fontWeight: '700',
                      fontSize: 14,
                    }}
                  >
                    Loading
                  </Text>
                  <AnimatedDots
                    color={isDark ? APP_COLORS.dark.text.body : APP_COLORS.light.text.secondary}
                    size={16}
                  />
                </View>
              </View>
            ) : channels.length ? (
              channels.map((c) => (
                <Pressable
                  key={`guest-channel:${c.channelId}`}
                  style={({ pressed }) => [
                    {
                      paddingVertical: 10,
                      paddingHorizontal: 10,
                      minHeight: 44,
                      borderRadius: 12,
                      alignSelf: 'stretch',
                      backgroundColor: isDark
                        ? APP_COLORS.dark.bg.header
                        : APP_COLORS.light.bg.surface2,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: isDark
                        ? APP_COLORS.dark.border.subtle
                        : APP_COLORS.light.border.subtle,
                      marginBottom: 8,
                      opacity: pressed ? 0.85 : 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    },
                  ]}
                  onPress={() => {
                    if (c.hasPassword) {
                      onLockedChannel();
                      return;
                    }
                    onPickChannel(c.channelId, c.name);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Enter ${c.name}`}
                >
                  <Text
                    style={{
                      color: isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary,
                      fontWeight: '800',
                      flexShrink: 1,
                      minWidth: 0,
                    }}
                    numberOfLines={1}
                  >
                    {c.name}
                  </Text>

                  {/* Keep lock placement consistent with signed-in channel rows: on the RIGHT, near the count pill. */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 10 }}>
                    {c.hasPassword ? (
                      <View style={{ marginRight: 8 }}>
                        <Feather
                          name="lock"
                          size={14}
                          color={isDark ? APP_COLORS.dark.text.muted : APP_COLORS.light.text.muted}
                        />
                      </View>
                    ) : null}
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 999,
                        backgroundColor: isDark
                          ? APP_COLORS.dark.border.subtle
                          : APP_COLORS.light.bg.app,
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: isDark ? 'transparent' : APP_COLORS.light.border.subtle,
                        minWidth: 38,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={{
                          fontWeight: '900',
                          color: isDark
                            ? APP_COLORS.dark.text.primary
                            : APP_COLORS.light.text.primary,
                        }}
                      >
                        {String(typeof c.activeMemberCount === 'number' ? c.activeMemberCount : 0)}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))
            ) : (
              <Text style={[styles.modalRowText, isDark ? styles.modalRowTextDark : null]}>
                {String(query || '').trim() ? 'No channels found' : 'No public channels yet'}
              </Text>
            )}
          </ScrollView>

          <View style={styles.modalButtons}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.modalBtn,
                isDark ? styles.modalBtnDark : null,
                pressed ? { opacity: 0.92 } : null,
              ]}
            >
              <Text style={[styles.modalBtnText, isDark ? styles.modalBtnTextDark : null]}>
                Close
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
