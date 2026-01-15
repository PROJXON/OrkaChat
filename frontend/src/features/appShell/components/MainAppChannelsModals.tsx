import { icons } from '@aws-amplify/ui-react-native/dist/assets';
import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { AppStyles } from '../../../../App.styles';
import { AnimatedDots } from '../../../components/AnimatedDots';
import { AppTextInput } from '../../../components/AppTextInput';
import {
  calcCenteredModalBottomPadding,
  useKeyboardOverlap,
} from '../../../hooks/useKeyboardOverlap';
import { APP_COLORS } from '../../../theme/colors';
import { shouldShowGlobalForChannelSearch } from '../../../utils/channelSearch';

type ChannelSearchResult = {
  channelId: string;
  name: string;
  hasPassword?: boolean;
  activeMemberCount?: number;
};

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
  showPinnedChannelInSearch,
  pinnedChannelConversationId,
  pinnedChannelLabel,
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
  channelPasswordSubmitting,
  submitChannelPassword,
}: {
  styles: AppStyles;
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
  showPinnedChannelInSearch?: boolean;
  pinnedChannelConversationId?: string | null;
  pinnedChannelLabel?: string | null;
  channelsQuery: string;
  setChannelsQuery: (v: string) => void;
  channelsLoading: boolean;
  channelsError: string | null;
  setChannelsError: (v: string | null) => void;
  channelJoinError: string | null;
  setChannelJoinError: (v: string | null) => void;
  globalUserCount: number | null;
  channelsResults: ChannelSearchResult[];
  fetchChannelsSearch: (q: string) => void | Promise<void>;
  joinChannel: (c: ChannelSearchResult) => void | Promise<void>;

  channelPasswordPrompt: null | { channelId: string; name: string };
  setChannelPasswordPrompt: (v: null | { channelId: string; name: string }) => void;
  channelPasswordInput: string;
  setChannelPasswordInput: (v: string) => void;
  channelPasswordSubmitting: boolean;
  submitChannelPassword: () => void | Promise<void>;
}): React.JSX.Element {
  const channelsKb = useKeyboardOverlap({ enabled: channelsOpen });
  const searchKb = useKeyboardOverlap({ enabled: channelSearchOpen });
  const passwordKb = useKeyboardOverlap({ enabled: !!channelPasswordPrompt });
  const [channelsSheetHeight, setChannelsSheetHeight] = React.useState<number>(0);
  const [searchSheetHeight, setSearchSheetHeight] = React.useState<number>(0);
  const [passwordSheetHeight, setPasswordSheetHeight] = React.useState<number>(0);
  const channelsBottomPad = React.useMemo(
    () =>
      calcCenteredModalBottomPadding(
        {
          keyboardVisible: channelsKb.keyboardVisible,
          remainingOverlap: channelsKb.remainingOverlap,
          windowHeight: channelsKb.windowHeight,
        },
        channelsSheetHeight,
        12,
      ),
    [
      channelsKb.keyboardVisible,
      channelsKb.remainingOverlap,
      channelsKb.windowHeight,
      channelsSheetHeight,
    ],
  );
  const searchBottomPad = React.useMemo(
    () =>
      calcCenteredModalBottomPadding(
        {
          keyboardVisible: searchKb.keyboardVisible,
          remainingOverlap: searchKb.remainingOverlap,
          windowHeight: searchKb.windowHeight,
        },
        searchSheetHeight,
        12,
      ),
    [searchKb.keyboardVisible, searchKb.remainingOverlap, searchKb.windowHeight, searchSheetHeight],
  );
  const passwordBottomPad = React.useMemo(
    () =>
      calcCenteredModalBottomPadding(
        {
          keyboardVisible: passwordKb.keyboardVisible,
          remainingOverlap: passwordKb.remainingOverlap,
          windowHeight: passwordKb.windowHeight,
        },
        passwordSheetHeight,
        12,
      ),
    [
      passwordKb.keyboardVisible,
      passwordKb.remainingOverlap,
      passwordKb.windowHeight,
      passwordSheetHeight,
    ],
  );

  const [channelPasswordVisible, setChannelPasswordVisible] = React.useState<boolean>(false);
  const showGlobalInChannelSearch = shouldShowGlobalForChannelSearch(channelsQuery);
  const pinnedChannelConversationIdNorm = String(pinnedChannelConversationId || '').trim();
  const pinnedChannelLabelNorm = String(pinnedChannelLabel || '').trim();
  const pinnedChannelId = pinnedChannelConversationIdNorm.startsWith('ch#')
    ? pinnedChannelConversationIdNorm.slice('ch#'.length).trim()
    : '';
  const pinnedChannelIsGlobal = pinnedChannelConversationIdNorm === 'global';
  const pinnedFromResults = pinnedChannelId
    ? channelsResults.find((c) => String(c.channelId || '').trim() === pinnedChannelId) || null
    : null;
  const showPinned =
    !!showPinnedChannelInSearch &&
    !String(channelsQuery || '').trim() &&
    !!pinnedChannelId &&
    !!pinnedChannelLabelNorm;
  const channelsResultsWithoutPinned =
    showPinned && pinnedChannelId
      ? channelsResults.filter((c) => String(c.channelId || '').trim() !== pinnedChannelId)
      : channelsResults;

  // Always default to hidden when opening/closing the prompt.
  React.useEffect(() => {
    if (!channelPasswordPrompt) {
      setChannelPasswordVisible(false);
      return;
    }
    setChannelPasswordVisible(false);
  }, [channelPasswordPrompt]);

  return (
    <>
      {/* Settings → Channels: list joined channels (like Chats) */}
      <Modal
        visible={channelsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setChannelsOpen(false)}
      >
        <View
          style={[
            styles.modalOverlay,
            Platform.OS !== 'web' && channelsBottomPad > 0
              ? { paddingBottom: channelsBottomPad }
              : null,
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setChannelsOpen(false)} />
          <View
            style={[
              styles.chatsCard,
              isDark ? styles.chatsCardDark : null,
              Platform.OS !== 'web' && channelsKb.keyboardVisible
                ? { maxHeight: channelsKb.availableHeightAboveKeyboard, minHeight: 0 }
                : null,
            ]}
            onLayout={(e) => {
              const h = e?.nativeEvent?.layout?.height;
              if (typeof h === 'number' && Number.isFinite(h) && h > 0) setChannelsSheetHeight(h);
            }}
          >
            <View style={styles.chatsTopRow}>
              <Text style={[styles.modalTitle, isDark ? styles.modalTitleDark : null]}>
                Channels
              </Text>
            </View>

            {myChannelsError ? (
              <Text style={[styles.errorText, isDark ? styles.errorTextDark : null]}>
                {myChannelsError}
              </Text>
            ) : null}

            {createChannelOpen ? (
              <>
                <AppTextInput
                  isDark={isDark}
                  value={createChannelName}
                  onChangeText={(v) => {
                    setCreateChannelName(v);
                    setCreateChannelError(null);
                  }}
                  placeholder="Channel name"
                  maxLength={21}
                  autoCapitalize="words"
                  autoCorrect={false}
                  baseStyle={styles.blocksInput}
                  darkStyle={styles.blocksInputDark}
                  variant="blocksStandalone"
                />

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 10,
                    marginBottom: 10,
                  }}
                >
                  <Pressable
                    onPress={() => setCreateChannelIsPublic(true)}
                    style={({ pressed }) => [
                      styles.modalButton,
                      styles.modalButtonSmall,
                      createChannelIsPublic ? styles.modalButtonCta : null,
                      isDark
                        ? createChannelIsPublic
                          ? styles.modalButtonCtaDark
                          : styles.modalButtonDark
                        : null,
                      // Dark-mode selector: make the active choice visibly different.
                      isDark && createChannelIsPublic
                        ? { backgroundColor: APP_COLORS.dark.border.default }
                        : null,
                      pressed ? { opacity: 0.9 } : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modalButtonText,
                        isDark ? styles.modalButtonTextDark : null,
                        isDark && !createChannelIsPublic
                          ? { color: APP_COLORS.dark.text.muted }
                          : null,
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
                      isDark
                        ? !createChannelIsPublic
                          ? styles.modalButtonCtaDark
                          : styles.modalButtonDark
                        : null,
                      // Dark-mode selector: make the active choice visibly different.
                      isDark && !createChannelIsPublic
                        ? { backgroundColor: APP_COLORS.dark.border.default }
                        : null,
                      pressed ? { opacity: 0.9 } : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modalButtonText,
                        isDark ? styles.modalButtonTextDark : null,
                        isDark && createChannelIsPublic
                          ? { color: APP_COLORS.dark.text.muted }
                          : null,
                        !createChannelIsPublic ? styles.modalButtonCtaText : null,
                      ]}
                    >
                      Private
                    </Text>
                  </Pressable>
                </View>

                {createChannelIsPublic ? (
                  <AppTextInput
                    isDark={isDark}
                    value={createChannelPassword}
                    onChangeText={(v) => {
                      setCreateChannelPassword(v);
                      setCreateChannelError(null);
                    }}
                    placeholder="Password (optional)"
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    baseStyle={styles.blocksInput}
                    darkStyle={styles.blocksInputDark}
                    variant="blocksStandalone"
                  />
                ) : null}

                {createChannelError ? (
                  <Text style={[styles.errorText, isDark ? styles.errorTextDark : null]}>
                    {createChannelError}
                  </Text>
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
                    style={[
                      styles.modalButton,
                      styles.modalButtonSmall,
                      isDark ? styles.modalButtonDark : null,
                    ]}
                    onPress={() => {
                      setCreateChannelOpen(false);
                      setCreateChannelError(null);
                      setCreateChannelLoading(false);
                      setCreateChannelName('');
                      setCreateChannelPassword('');
                      setCreateChannelIsPublic(true);
                    }}
                  >
                    <Text
                      style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}
                    >
                      Cancel
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : null}

            <ScrollView style={styles.chatsScroll}>
              <Pressable
                key="mychannel:global"
                style={({ pressed }) => [
                  styles.chatRow,
                  isDark ? styles.chatRowDark : null,
                  pressed ? { opacity: 0.9 } : null,
                ]}
                onPress={() => enterChannelConversation('global')}
              >
                <View style={styles.chatRowLeft}>
                  <Text
                    style={[styles.chatRowName, isDark ? styles.chatRowNameDark : null]}
                    numberOfLines={1}
                  >
                    Global
                  </Text>
                </View>
                <View style={styles.chatRowRight}>
                  <View style={[styles.defaultChip, isDark ? styles.defaultChipDark : null]}>
                    <Text
                      style={[styles.defaultChipText, isDark ? styles.defaultChipTextDark : null]}
                    >
                      Default
                    </Text>
                  </View>
                </View>
              </Pressable>

              {myChannelsLoading ? (
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
              ) : myChannels.length ? (
                myChannels.map((c) => (
                  <Pressable
                    key={`mychannel:${c.channelId}`}
                    style={({ pressed }) => [
                      styles.chatRow,
                      isDark ? styles.chatRowDark : null,
                      pressed ? { opacity: 0.9 } : null,
                    ]}
                    onPress={() => {
                      setChannelsOpen(false);
                      enterChannelConversation(`ch#${c.channelId}`);
                    }}
                  >
                    <View style={styles.chatRowLeft}>
                      <Text
                        style={[styles.chatRowName, isDark ? styles.chatRowNameDark : null]}
                        numberOfLines={1}
                      >
                        {c.name}
                      </Text>
                    </View>
                    <View style={styles.chatRowRight}>
                      <Pressable
                        onPress={() => void Promise.resolve(leaveChannelFromSettings(c.channelId))}
                        style={({ pressed }) => [
                          styles.leaveChip,
                          isDark ? styles.leaveChipDark : null,
                          pressed ? { opacity: 0.9 } : null,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Leave channel"
                      >
                        <Text
                          style={[styles.leaveChipText, isDark ? styles.leaveChipTextDark : null]}
                        >
                          Leave
                        </Text>
                      </Pressable>
                    </View>
                  </Pressable>
                ))
              ) : (
                <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null]}>
                  No joined channels
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
                style={[
                  styles.modalButton,
                  styles.modalButtonSmall,
                  isDark ? styles.modalButtonDark : null,
                ]}
                onPress={() => setChannelsOpen(false)}
              >
                <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>
                  Close
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Header channel pill: search/join channels (like Start DM) */}
      <Modal
        visible={channelSearchOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setChannelSearchOpen(false)}
      >
        <View
          style={[
            styles.modalOverlay,
            Platform.OS !== 'web' && searchBottomPad > 0
              ? { paddingBottom: searchBottomPad }
              : null,
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setChannelSearchOpen(false)} />
          <View
            style={[
              styles.chatsCard,
              isDark ? styles.chatsCardDark : null,
              Platform.OS !== 'web' && searchKb.keyboardVisible
                ? { maxHeight: searchKb.availableHeightAboveKeyboard, minHeight: 0 }
                : null,
            ]}
            onLayout={(e) => {
              const h = e?.nativeEvent?.layout?.height;
              if (typeof h === 'number' && Number.isFinite(h) && h > 0) setSearchSheetHeight(h);
            }}
          >
            <View style={styles.chatsTopRow}>
              <Text style={[styles.modalTitle, isDark ? styles.modalTitleDark : null]}>
                Find Channels
              </Text>
            </View>

            <View style={styles.blocksSearchRow}>
              <AppTextInput
                isDark={isDark}
                value={channelsQuery}
                onChangeText={(v) => {
                  setChannelsQuery(v);
                  setChannelsError(null);
                  setChannelJoinError(null);
                }}
                placeholder="Search Channels"
                autoCapitalize="none"
                autoCorrect={false}
                baseStyle={styles.blocksInput}
                darkStyle={styles.blocksInputDark}
              />
              <Pressable
                onPress={() => void Promise.resolve(fetchChannelsSearch(channelsQuery))}
                style={({ pressed }) => [
                  styles.blocksBtn,
                  isDark ? styles.blocksBtnDark : null,
                  pressed ? { opacity: 0.9 } : null,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Search Channels"
              >
                <Text style={[styles.blocksBtnText, isDark ? styles.blocksBtnTextDark : null]}>
                  Search
                </Text>
              </Pressable>
            </View>

            {channelsError ? (
              <Text style={[styles.errorText, isDark ? styles.errorTextDark : null]}>
                {channelsError}
              </Text>
            ) : null}
            {channelJoinError ? (
              <Text style={[styles.errorText, isDark ? styles.errorTextDark : null]}>
                {channelJoinError}
              </Text>
            ) : null}

            <ScrollView style={styles.chatsScroll}>
              {showPinned ? (
                <Pressable
                  key="searchchannel:pinned"
                  style={({ pressed }) => [
                    styles.chatRow,
                    isDark ? styles.chatRowDark : null,
                    pressed ? { opacity: 0.9 } : null,
                  ]}
                  onPress={() =>
                    void Promise.resolve(
                      joinChannel(
                        pinnedFromResults
                          ? pinnedFromResults
                          : ({
                              channelId: pinnedChannelId,
                              name: pinnedChannelLabelNorm,
                              isMember: true,
                            } as unknown as ChannelSearchResult),
                      ),
                    )
                  }
                >
                  <View style={styles.chatRowLeft}>
                    <Feather
                      name="home"
                      size={14}
                      color={isDark ? APP_COLORS.dark.text.muted : APP_COLORS.light.text.muted}
                    />
                    <Text
                      style={[styles.chatRowName, isDark ? styles.chatRowNameDark : null]}
                      numberOfLines={1}
                    >
                      {pinnedFromResults?.name || pinnedChannelLabelNorm}
                    </Text>
                    {pinnedFromResults?.hasPassword ? (
                      <View style={{ marginLeft: 8 }}>
                        <Feather
                          name="lock"
                          size={14}
                          color={isDark ? APP_COLORS.dark.text.muted : APP_COLORS.light.text.muted}
                        />
                      </View>
                    ) : null}
                  </View>
                  <View style={[styles.chatRowRight, { marginLeft: 10 }]}>
                    <View style={[styles.memberChip, isDark ? styles.memberChipDark : null]}>
                      <Text
                        style={[styles.memberChipText, isDark ? styles.memberChipTextDark : null]}
                      >
                        {pinnedFromResults
                          ? String(
                              typeof pinnedFromResults.activeMemberCount === 'number'
                                ? pinnedFromResults.activeMemberCount
                                : 0,
                            )
                          : '—'}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ) : null}

              {/* Show Global as a suggestion when empty, otherwise only when it matches the query. */}
              {showGlobalInChannelSearch ? (
                <Pressable
                  key="searchchannel:global"
                  style={({ pressed }) => [
                    styles.chatRow,
                    isDark ? styles.chatRowDark : null,
                    pressed ? { opacity: 0.9 } : null,
                  ]}
                  onPress={() => enterChannelConversation('global')}
                >
                  <View style={styles.chatRowLeft}>
                    {pinnedChannelIsGlobal ? (
                      <Feather
                        name="home"
                        size={14}
                        color={isDark ? APP_COLORS.dark.text.muted : APP_COLORS.light.text.muted}
                      />
                    ) : null}
                    <Text
                      style={[styles.chatRowName, isDark ? styles.chatRowNameDark : null]}
                      numberOfLines={1}
                    >
                      Global
                    </Text>
                  </View>
                  <View style={[styles.chatRowRight, { marginLeft: 10 }]}>
                    <View style={[styles.memberChip, isDark ? styles.memberChipDark : null]}>
                      <Text
                        style={[styles.memberChipText, isDark ? styles.memberChipTextDark : null]}
                      >
                        {typeof globalUserCount === 'number' ? String(globalUserCount) : '—'}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ) : null}

              {channelsLoading ? (
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
              ) : channelsResultsWithoutPinned.length ? (
                channelsResultsWithoutPinned.map((c) => (
                  <Pressable
                    key={`searchchannel:${c.channelId}`}
                    style={({ pressed }) => [
                      styles.chatRow,
                      isDark ? styles.chatRowDark : null,
                      pressed ? { opacity: 0.9 } : null,
                    ]}
                    onPress={() => void Promise.resolve(joinChannel(c))}
                  >
                    <View style={styles.chatRowLeft}>
                      {pinnedChannelId && String(c.channelId || '').trim() === pinnedChannelId ? (
                        <Feather
                          name="home"
                          size={14}
                          color={isDark ? APP_COLORS.dark.text.muted : APP_COLORS.light.text.muted}
                        />
                      ) : null}
                      <Text
                        style={[styles.chatRowName, isDark ? styles.chatRowNameDark : null]}
                        numberOfLines={1}
                      >
                        {c.name}
                      </Text>
                      {c.hasPassword ? (
                        <View style={{ marginLeft: 8 }}>
                          <Feather
                            name="lock"
                            size={14}
                            color={
                              isDark ? APP_COLORS.dark.text.muted : APP_COLORS.light.text.muted
                            }
                          />
                        </View>
                      ) : null}
                    </View>
                    <View style={[styles.chatRowRight, { marginLeft: 10 }]}>
                      <View style={[styles.memberChip, isDark ? styles.memberChipDark : null]}>
                        <Text
                          style={[styles.memberChipText, isDark ? styles.memberChipTextDark : null]}
                        >
                          {String(
                            typeof c.activeMemberCount === 'number' ? c.activeMemberCount : 0,
                          )}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                ))
              ) : (
                <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null]}>
                  No channels found
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
                onPress={() => setChannelSearchOpen(false)}
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
        visible={!!channelPasswordPrompt}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (channelPasswordSubmitting) return;
          setChannelPasswordPrompt(null);
          setChannelPasswordVisible(false);
        }}
      >
        <View
          style={[
            styles.modalOverlay,
            Platform.OS !== 'web' && passwordBottomPad > 0
              ? { paddingBottom: passwordBottomPad }
              : null,
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (channelPasswordSubmitting) return;
              setChannelPasswordPrompt(null);
              setChannelPasswordVisible(false);
            }}
            disabled={channelPasswordSubmitting}
          />
          <View
            style={[
              styles.profileCard,
              isDark ? styles.profileCardDark : null,
              Platform.OS !== 'web' && passwordKb.keyboardVisible
                ? { maxHeight: passwordKb.availableHeightAboveKeyboard, minHeight: 0 }
                : null,
            ]}
            onLayout={(e) => {
              const h = e?.nativeEvent?.layout?.height;
              if (typeof h === 'number' && Number.isFinite(h) && h > 0) setPasswordSheetHeight(h);
            }}
          >
            <View style={styles.chatsTopRow}>
              <Text style={[styles.modalTitle, isDark ? styles.modalTitleDark : null]}>
                Join {channelPasswordPrompt?.name || 'Channel'}
              </Text>
            </View>
            <Text
              style={[
                styles.modalHelperText,
                isDark ? styles.modalHelperTextDark : null,
                { marginBottom: 8 },
              ]}
            >
              Enter Channel Password
            </Text>
            <View style={styles.passphraseFieldWrapper}>
              <AppTextInput
                isDark={isDark}
                value={channelPasswordInput}
                onChangeText={(v) => {
                  setChannelPasswordInput(v);
                  setChannelJoinError(null);
                }}
                placeholder="Channel Password"
                secureTextEntry={!channelPasswordVisible}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => void Promise.resolve(submitChannelPassword())}
                baseStyle={styles.blocksInput}
                darkStyle={styles.blocksInputDark}
                variant="blocksStandalone"
                style={[styles.passphraseInput, { marginBottom: 0 }]}
                editable={!channelPasswordSubmitting}
              />
              <Pressable
                style={styles.passphraseEyeBtn}
                onPress={() => setChannelPasswordVisible((v) => !v)}
                disabled={channelPasswordSubmitting}
                accessibilityRole="button"
                accessibilityLabel={
                  channelPasswordVisible ? 'Hide channel password' : 'Show channel password'
                }
              >
                <Image
                  source={channelPasswordVisible ? icons.visibilityOn : icons.visibilityOff}
                  tintColor={isDark ? APP_COLORS.dark.text.muted : APP_COLORS.light.text.muted}
                  style={{ width: 18, height: 18 }}
                />
              </Pressable>
            </View>
            {channelJoinError ? (
              <Text style={[styles.errorText, isDark ? styles.errorTextDark : null]}>
                {channelJoinError}
              </Text>
            ) : null}
            <View style={[styles.modalButtons, { marginTop: 2 }]}>
              <Pressable
                // Keep Join consistent with other modal actions (no heavy "blackened" CTA for this prompt).
                style={[
                  styles.modalButton,
                  styles.modalButtonSmall,
                  isDark ? styles.modalButtonDark : null,
                  channelPasswordSubmitting ? { opacity: 0.7 } : null,
                ]}
                onPress={() => void Promise.resolve(submitChannelPassword())}
                disabled={channelPasswordSubmitting}
              >
                {channelPasswordSubmitting ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Text
                      style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}
                    >
                      Loading
                    </Text>
                    <AnimatedDots
                      color={isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary}
                      size={18}
                    />
                  </View>
                ) : (
                  <Text
                    style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}
                  >
                    Join
                  </Text>
                )}
              </Pressable>
              <Pressable
                style={[
                  styles.modalButton,
                  styles.modalButtonSmall,
                  isDark ? styles.modalButtonDark : null,
                  { marginLeft: 8 },
                  channelPasswordSubmitting ? { opacity: 0.45 } : null,
                ]}
                onPress={() => {
                  setChannelPasswordPrompt(null);
                  setChannelPasswordVisible(false);
                  setChannelPasswordInput('');
                  setChannelJoinError(null);
                }}
                disabled={channelPasswordSubmitting}
              >
                <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>
                  Cancel
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
