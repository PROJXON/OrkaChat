import * as React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { AnimatedDots } from '../../../components/AnimatedDots';

export function GuestChannelPickerModal(props: {
  open: boolean;
  isDark: boolean;
  styles: typeof import('../../../screens/GuestGlobalScreen.styles').styles;
  query: string;
  onChangeQuery: (next: string) => void;
  loading: boolean;
  error: string | null;
  globalUserCount: number | null;
  channels: Array<{ channelId: string; name: string; activeMemberCount?: number; hasPassword?: boolean }>;
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

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.modalCard, isDark ? styles.modalCardDark : null]}>
          <Text style={[styles.modalTitle, isDark ? styles.modalTitleDark : null]}>Channels</Text>

          <TextInput
            value={query}
            onChangeText={onChangeQuery}
            placeholder="Search Channels"
            placeholderTextColor={isDark ? '#8f8fa3' : '#999'}
            selectionColor={isDark ? '#ffffff' : '#111'}
            cursorColor={isDark ? '#ffffff' : '#111'}
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 10,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: isDark ? '#2a2a33' : '#e3e3e3',
              backgroundColor: isDark ? '#1c1c22' : '#f2f2f7',
              color: isDark ? '#fff' : '#111',
              marginBottom: 10,
            }}
          />

          {error ? (
            <Text style={[styles.errorText, isDark && styles.errorTextDark]} numberOfLines={2}>
              {error}
            </Text>
          ) : null}

          <ScrollView style={styles.modalScroll}>
            <Pressable
              style={({ pressed }) => [
                {
                  paddingVertical: 10,
                  paddingHorizontal: 10,
                  minHeight: 44,
                  borderRadius: 12,
                  alignSelf: 'stretch',
                  backgroundColor: isDark ? '#1c1c22' : '#f2f2f7',
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: isDark ? '#2a2a33' : '#e3e3e3',
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
              <Text style={{ color: isDark ? '#fff' : '#111', fontWeight: '800' }}>Global</Text>
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 999,
                  backgroundColor: isDark ? '#2a2a33' : '#fff',
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: isDark ? 'transparent' : '#e3e3e3',
                  minWidth: 38,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontWeight: '900', color: isDark ? '#fff' : '#111' }}>
                  {typeof globalUserCount === 'number' ? String(globalUserCount) : '—'}
                </Text>
              </View>
            </Pressable>

            {loading ? (
              <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: isDark ? '#d7d7e0' : '#555', fontWeight: '700', fontSize: 14 }}>Loading</Text>
                  <AnimatedDots color={isDark ? '#d7d7e0' : '#555'} size={16} />
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
                      backgroundColor: isDark ? '#1c1c22' : '#f2f2f7',
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: isDark ? '#2a2a33' : '#e3e3e3',
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
                    style={{ color: isDark ? '#fff' : '#111', fontWeight: '800', flexShrink: 1, minWidth: 0 }}
                    numberOfLines={1}
                  >
                    {c.name}
                  </Text>

                  {/* Keep lock placement consistent with signed-in channel rows: on the RIGHT, near the count pill. */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 10 }}>
                    {c.hasPassword ? (
                      <View style={{ marginRight: 8 }}>
                        <Feather name="lock" size={14} color={isDark ? '#a7a7b4' : '#666'} />
                      </View>
                    ) : null}
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 999,
                        backgroundColor: isDark ? '#2a2a33' : '#fff',
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: isDark ? 'transparent' : '#e3e3e3',
                        minWidth: 38,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontWeight: '900', color: isDark ? '#fff' : '#111' }}>
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
              style={({ pressed }) => [styles.modalBtn, isDark ? styles.modalBtnDark : null, pressed ? { opacity: 0.92 } : null]}
            >
              <Text style={[styles.modalBtnText, isDark ? styles.modalBtnTextDark : null]}>Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

