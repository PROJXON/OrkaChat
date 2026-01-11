import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { AnimatedDots } from '../../../components/AnimatedDots';

export function MainAppChannelsModals({
  styles,
  isDark,
  // "My Channels" modal
  channelsOpen,
  setChannelsOpen,
  myChannelsLoading,
  myChannelsError,
  myChannels,
  enterChannelConversation,
  leaveChannelFromSettings,
  // Inline create channel
  createChannelOpen,
  setCreateChannelOpen,
  createChannelName,
  setCreateChannelName,
  createChannelPassword,
  setCreateChannelPassword,
  createChannelIsPublic,
  setCreateChannelIsPublic,
  createChannelLoading,
  setCreateChannelLoading,
  createChannelError,
  setCreateChannelError,
  submitCreateChannelInline,
  // Search/join channels modal
  channelSearchOpen,
  setChannelSearchOpen,
  channelsQuery,
  setChannelsQuery,
  channelsLoading,
  channelsError,
  setChannelsError,
  channelJoinError,
  setChannelJoinError,
  globalUserCount,
  channelsResults,
  fetchChannelsSearch,
  joinChannel,
  // Password prompt
  channelPasswordPrompt,
  setChannelPasswordPrompt,
  channelPasswordInput,
  setChannelPasswordInput,
  submitChannelPassword,
}: {
  styles: any;
  isDark: boolean;

  channelsOpen: boolean;
  setChannelsOpen: (v: boolean) => void;
  myChannelsLoading: boolean;
  myChannelsError: string | null;
  myChannels: Array<{ channelId: string; name: string }>;
  enterChannelConversation: (conversationId: string) => void;
  leaveChannelFromSettings: (channelId: string) => void | Promise<void>;

  createChannelOpen: boolean;
  setCreateChannelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  createChannelName: string;
  setCreateChannelName: (v: string) => void;
  createChannelPassword: string;
  setCreateChannelPassword: (v: string) => void;
  createChannelIsPublic: boolean;
  setCreateChannelIsPublic: (v: boolean) => void;
  createChannelLoading: boolean;
  setCreateChannelLoading: (v: boolean) => void;
  createChannelError: string | null;
  setCreateChannelError: (v: string | null) => void;
  submitCreateChannelInline: () => void | Promise<void>;

  channelSearchOpen: boolean;
  setChannelSearchOpen: (v: boolean) => void;
  channelsQuery: string;
  setChannelsQuery: (v: string) => void;
  channelsLoading: boolean;
  channelsError: string | null;
  setChannelsError: (v: string | null) => void;
  channelJoinError: string | null;
  setChannelJoinError: (v: string | null) => void;
  globalUserCount: number | null;
  channelsResults: Array<{ channelId: string; name: string; hasPassword?: boolean; activeMemberCount?: number }>;
  fetchChannelsSearch: (q: string) => void | Promise<void>;
  joinChannel: (c: any) => void | Promise<void>;

  channelPasswordPrompt: null | { channelId: string; name: string };
  setChannelPasswordPrompt: (v: null | { channelId: string; name: string }) => void;
  channelPasswordInput: string;
  setChannelPasswordInput: (v: string) => void;
  submitChannelPassword: () => void | Promise<void>;
}): React.JSX.Element {
  return (
    <>
      {/* Settings → Channels: list joined channels (like Chats) */}
      <Modal visible={channelsOpen} transparent animationType="fade" onRequestClose={() => setChannelsOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setChannelsOpen(false)} />
          <View style={[styles.chatsCard, isDark ? styles.chatsCardDark : null]}>
            <View style={styles.chatsTopRow}>
              <Text style={[styles.modalTitle, isDark ? styles.modalTitleDark : null]}>Channels</Text>
            </View>

            {myChannelsError ? <Text style={[styles.errorText, isDark ? styles.errorTextDark : null]}>{myChannelsError}</Text> : null}

            {createChannelOpen ? (
              <>
                <TextInput
                  value={createChannelName}
                  onChangeText={(v) => {
                    setCreateChannelName(v);
                    setCreateChannelError(null);
                  }}
                  placeholder="Channel name"
                  maxLength={21}
                  placeholderTextColor={isDark ? '#8f8fa3' : '#999'}
                  selectionColor={isDark ? '#ffffff' : '#111'}
                  cursorColor={isDark ? '#ffffff' : '#111'}
                  autoCapitalize="words"
                  autoCorrect={false}
                  style={[
                    styles.blocksInput,
                    isDark ? styles.blocksInputDark : null,
                    {
                      // `blocksInput` uses flex:1 for row layouts; override for column layout.
                      flex: 0,
                      alignSelf: 'stretch',
                      width: '100%',
                      height: 44,
                      fontSize: 16,
                      lineHeight: 20,
                      paddingVertical: 10,
                      textAlignVertical: 'center',
                      color: isDark ? '#fff' : '#111',
                    },
                  ]}
                />

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 10 }}>
                  <Pressable
                    onPress={() => setCreateChannelIsPublic(true)}
                    style={({ pressed }) => [
                      styles.modalButton,
                      styles.modalButtonSmall,
                      createChannelIsPublic ? styles.modalButtonCta : null,
                      isDark ? (createChannelIsPublic ? styles.modalButtonCtaDark : styles.modalButtonDark) : null,
                      // Dark-mode selector: make the active choice visibly different.
                      isDark && createChannelIsPublic ? { backgroundColor: '#3a3a46' } : null,
                      pressed ? { opacity: 0.9 } : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modalButtonText,
                        isDark ? styles.modalButtonTextDark : null,
                        isDark && !createChannelIsPublic ? { color: '#a7a7b4' } : null,
                        createChannelIsPublic ? styles.modalButtonCtaText : null,
                      ]}
                    >
                      Public
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setCreateChannelIsPublic(false);
                      setCreateChannelPassword('');
                    }}
                    style={({ pressed }) => [
                      styles.modalButton,
                      styles.modalButtonSmall,
                      !createChannelIsPublic ? styles.modalButtonCta : null,
                      isDark ? (!createChannelIsPublic ? styles.modalButtonCtaDark : styles.modalButtonDark) : null,
                      // Dark-mode selector: make the active choice visibly different.
                      isDark && !createChannelIsPublic ? { backgroundColor: '#3a3a46' } : null,
                      pressed ? { opacity: 0.9 } : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modalButtonText,
                        isDark ? styles.modalButtonTextDark : null,
                        isDark && createChannelIsPublic ? { color: '#a7a7b4' } : null,
                        !createChannelIsPublic ? styles.modalButtonCtaText : null,
                      ]}
                    >
                      Private
                    </Text>
                  </Pressable>
                </View>

                {createChannelIsPublic ? (
                  <TextInput
                    value={createChannelPassword}
                    onChangeText={(v) => {
                      setCreateChannelPassword(v);
                      setCreateChannelError(null);
                    }}
                    placeholder="Password (optional)"
                    placeholderTextColor={isDark ? '#8f8fa3' : '#999'}
                    selectionColor={isDark ? '#ffffff' : '#111'}
                    cursorColor={isDark ? '#ffffff' : '#111'}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[
                      styles.blocksInput,
                      isDark ? styles.blocksInputDark : null,
                      {
                        flex: 0,
                        alignSelf: 'stretch',
                        width: '100%',
                        height: 44,
                        fontSize: 16,
                        lineHeight: 20,
                        paddingVertical: 10,
                        textAlignVertical: 'center',
                        color: isDark ? '#fff' : '#111',
                      },
                    ]}
                  />
                ) : null}

                {createChannelError ? (
                  <Text style={[styles.errorText, isDark ? styles.errorTextDark : null]}>{createChannelError}</Text>
                ) : null}

                <View style={[styles.modalButtons, { justifyContent: 'flex-end', marginTop: 12 }]}>
                  <Pressable
                    style={[
                      styles.modalButton,
                      styles.modalButtonSmall,
                      styles.modalButtonCta,
                      isDark ? styles.modalButtonCtaDark : null,
                      createChannelLoading ? { opacity: 0.7 } : null,
                    ]}
                    onPress={() => void Promise.resolve(submitCreateChannelInline())}
                  >
                    <Text style={[styles.modalButtonText, styles.modalButtonCtaText]}>
                      {createChannelLoading ? 'Creating…' : 'Create'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modalButton, styles.modalButtonSmall, isDark ? styles.modalButtonDark : null]}
                    onPress={() => {
                      setCreateChannelOpen(false);
                      setCreateChannelError(null);
                      setCreateChannelLoading(false);
                      setCreateChannelName('');
                      setCreateChannelPassword('');
                      setCreateChannelIsPublic(true);
                    }}
                  >
                    <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>Cancel</Text>
                  </Pressable>
                </View>
              </>
            ) : null}

            <ScrollView style={styles.chatsScroll}>
              <Pressable
                key="mychannel:global"
                style={({ pressed }) => [styles.chatRow, isDark ? styles.chatRowDark : null, pressed ? { opacity: 0.9 } : null]}
                onPress={() => enterChannelConversation('global')}
              >
                <View style={styles.chatRowLeft}>
                  <Text style={[styles.chatRowName, isDark ? styles.chatRowNameDark : null]} numberOfLines={1}>
                    Global
                  </Text>
                </View>
                <View style={styles.chatRowRight}>
                  <View style={[styles.defaultChip, isDark ? styles.defaultChipDark : null]}>
                    <Text style={[styles.defaultChipText, isDark ? styles.defaultChipTextDark : null]}>Default</Text>
                  </View>
                </View>
              </Pressable>

              {myChannelsLoading ? (
                <View style={styles.chatsLoadingRow}>
                  <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null, styles.chatsLoadingText]}>
                    Loading
                  </Text>
                  <View style={styles.chatsLoadingDotsWrap}>
                    <AnimatedDots color={isDark ? '#ffffff' : '#111'} size={18} />
                  </View>
                </View>
              ) : myChannels.length ? (
                myChannels.map((c) => (
                  <Pressable
                    key={`mychannel:${c.channelId}`}
                    style={({ pressed }) => [styles.chatRow, isDark ? styles.chatRowDark : null, pressed ? { opacity: 0.9 } : null]}
                    onPress={() => {
                      setChannelsOpen(false);
                      enterChannelConversation(`ch#${c.channelId}`);
                    }}
                  >
                    <View style={styles.chatRowLeft}>
                      <Text style={[styles.chatRowName, isDark ? styles.chatRowNameDark : null]} numberOfLines={1}>
                        {c.name}
                      </Text>
                    </View>
                    <View style={styles.chatRowRight}>
                      <Pressable
                        onPress={() => void Promise.resolve(leaveChannelFromSettings(c.channelId))}
                        style={({ pressed }) => [styles.leaveChip, isDark ? styles.leaveChipDark : null, pressed ? { opacity: 0.9 } : null]}
                        accessibilityRole="button"
                        accessibilityLabel="Leave channel"
                      >
                        <Text style={[styles.leaveChipText, isDark ? styles.leaveChipTextDark : null]}>Leave</Text>
                      </Pressable>
                    </View>
                  </Pressable>
                ))
              ) : (
                <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null]}>No joined channels</Text>
              )}
            </ScrollView>

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonSmall, isDark ? styles.modalButtonDark : null]}
                onPress={() => {
                  setCreateChannelError(null);
                  setCreateChannelLoading(false);
                  setCreateChannelIsPublic(true);
                  setCreateChannelPassword('');
                  setCreateChannelName('');
                  setCreateChannelOpen((v) => !v);
                }}
              >
                <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>
                  {createChannelOpen ? 'Hide Create' : 'Create'}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonSmall, isDark ? styles.modalButtonDark : null]}
                onPress={() => setChannelsOpen(false)}
              >
                <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Header channel pill: search/join channels (like Start DM) */}
      <Modal visible={channelSearchOpen} transparent animationType="fade" onRequestClose={() => setChannelSearchOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setChannelSearchOpen(false)} />
          <View style={[styles.chatsCard, isDark ? styles.chatsCardDark : null]}>
            <View style={styles.chatsTopRow}>
              <Text style={[styles.modalTitle, isDark ? styles.modalTitleDark : null]}>Find Channels</Text>
            </View>

            <View style={styles.blocksSearchRow}>
              <TextInput
                value={channelsQuery}
                onChangeText={(v) => {
                  setChannelsQuery(v);
                  setChannelsError(null);
                  setChannelJoinError(null);
                }}
                placeholder="Search Channels"
                placeholderTextColor={isDark ? '#8f8fa3' : '#999'}
                selectionColor={isDark ? '#ffffff' : '#111'}
                cursorColor={isDark ? '#ffffff' : '#111'}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.blocksInput, isDark ? styles.blocksInputDark : null]}
              />
              <Pressable
                onPress={() => void Promise.resolve(fetchChannelsSearch(channelsQuery))}
                style={({ pressed }) => [styles.blocksBtn, isDark ? styles.blocksBtnDark : null, pressed ? { opacity: 0.9 } : null]}
                accessibilityRole="button"
                accessibilityLabel="Search Channels"
              >
                <Text style={[styles.blocksBtnText, isDark ? styles.blocksBtnTextDark : null]}>Search</Text>
              </Pressable>
            </View>

            {channelsError ? <Text style={[styles.errorText, isDark ? styles.errorTextDark : null]}>{channelsError}</Text> : null}
            {channelJoinError ? (
              <Text style={[styles.errorText, isDark ? styles.errorTextDark : null]}>{channelJoinError}</Text>
            ) : null}

            <ScrollView style={styles.chatsScroll}>
              {/* Only show Global as a suggestion when not actively searching */}
              {!String(channelsQuery || '').trim() ? (
                <Pressable
                  key="searchchannel:global"
                  style={({ pressed }) => [styles.chatRow, isDark ? styles.chatRowDark : null, pressed ? { opacity: 0.9 } : null]}
                  onPress={() => enterChannelConversation('global')}
                >
                  <View style={styles.chatRowLeft}>
                    <Text style={[styles.chatRowName, isDark ? styles.chatRowNameDark : null]} numberOfLines={1}>
                      Global
                    </Text>
                  </View>
                  <View style={[styles.chatRowRight, { marginLeft: 10 }]}>
                    <View style={[styles.memberChip, isDark ? styles.memberChipDark : null]}>
                      <Text style={[styles.memberChipText, isDark ? styles.memberChipTextDark : null]}>
                        {typeof globalUserCount === 'number' ? String(globalUserCount) : '—'}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ) : null}

              {channelsLoading ? (
                <View style={styles.chatsLoadingRow}>
                  <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null, styles.chatsLoadingText]}>
                    Loading
                  </Text>
                  <View style={styles.chatsLoadingDotsWrap}>
                    <AnimatedDots color={isDark ? '#ffffff' : '#111'} size={18} />
                  </View>
                </View>
              ) : channelsResults.length ? (
                channelsResults.map((c) => (
                  <Pressable
                    key={`searchchannel:${c.channelId}`}
                    style={({ pressed }) => [styles.chatRow, isDark ? styles.chatRowDark : null, pressed ? { opacity: 0.9 } : null]}
                    onPress={() => void Promise.resolve(joinChannel(c))}
                  >
                    <View style={styles.chatRowLeft}>
                      <Text style={[styles.chatRowName, isDark ? styles.chatRowNameDark : null]} numberOfLines={1}>
                        {c.name}
                      </Text>
                      {c.hasPassword ? (
                        <View style={{ marginLeft: 8 }}>
                          <Feather name="lock" size={14} color={isDark ? '#a7a7b4' : '#666'} />
                        </View>
                      ) : null}
                    </View>
                    <View style={[styles.chatRowRight, { marginLeft: 10 }]}>
                      <View style={[styles.memberChip, isDark ? styles.memberChipDark : null]}>
                        <Text style={[styles.memberChipText, isDark ? styles.memberChipTextDark : null]}>
                          {String(typeof c.activeMemberCount === 'number' ? c.activeMemberCount : 0)}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                ))
              ) : (
                <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null]}>No channels found</Text>
              )}
            </ScrollView>

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonSmall, isDark ? styles.modalButtonDark : null]}
                onPress={() => setChannelSearchOpen(false)}
              >
                <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!channelPasswordPrompt}
        transparent
        animationType="fade"
        onRequestClose={() => setChannelPasswordPrompt(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setChannelPasswordPrompt(null)} />
          <View style={[styles.profileCard, isDark ? styles.profileCardDark : null]}>
            <View style={styles.chatsTopRow}>
              <Text style={[styles.modalTitle, isDark ? styles.modalTitleDark : null]}>
                Join {channelPasswordPrompt?.name || 'Channel'}
              </Text>
            </View>
            <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null, { marginBottom: 8 }]}>
              Enter Channel Password
            </Text>
            <TextInput
              value={channelPasswordInput}
              onChangeText={(v) => {
                setChannelPasswordInput(v);
                setChannelJoinError(null);
              }}
              placeholder="Channel Password"
              placeholderTextColor={isDark ? '#8f8fa3' : '#999'}
              selectionColor={isDark ? '#ffffff' : '#111'}
              cursorColor={isDark ? '#ffffff' : '#111'}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => void Promise.resolve(submitChannelPassword())}
              style={[
                styles.blocksInput,
                isDark ? styles.blocksInputDark : null,
                // `blocksInput` is used in row layouts and has flex: 1; override for standalone column input.
                { flex: 0, alignSelf: 'stretch', marginBottom: 12 },
              ]}
            />
            {channelJoinError ? (
              <Text style={[styles.errorText, isDark ? styles.errorTextDark : null]}>{channelJoinError}</Text>
            ) : null}
            <View style={[styles.modalButtons, { marginTop: 2 }]}>
              <Pressable
                // Keep Join consistent with other modal actions (no heavy "blackened" CTA for this prompt).
                style={[styles.modalButton, styles.modalButtonSmall, isDark ? styles.modalButtonDark : null]}
                onPress={() => void Promise.resolve(submitChannelPassword())}
              >
                <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>Join</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonSmall, isDark ? styles.modalButtonDark : null, { marginLeft: 8 }]}
                onPress={() => {
                  setChannelPasswordPrompt(null);
                  setChannelPasswordInput('');
                  setChannelJoinError(null);
                }}
              >
                <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

