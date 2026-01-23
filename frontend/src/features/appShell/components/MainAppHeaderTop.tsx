import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import type { AppStyles } from '../../../../App.styles';
import { AppBrandIcon } from '../../../components/AppBrandIcon';
import { AppTextInput } from '../../../components/AppTextInput';
import { APP_COLORS } from '../../../theme/colors';

export function MainAppHeaderTop({
  styles,
  isDark,
  isWideUi: _isWideUi,

  activeChannelLabel,
  activeDmLabel,
  isChannelMode,
  isDmMode,
  hasUnreadDms,

  peerInput,
  setPeerInput,
  searchOpen,
  setSearchOpen,
  searchError,
  setSearchError,

  unreadEntries,
  goToConversation,

  menuRef,
  openMenu,

  onPressChannelNav,
  onPressChannelSearch,
  onPressDmNav,
  onPressDmSearch,
  onStartDm,
}: {
  styles: AppStyles;
  isDark: boolean;
  isWideUi: boolean;

  activeChannelLabel: string;
  activeDmLabel: string;
  isChannelMode: boolean;
  isDmMode: boolean;
  hasUnreadDms: boolean;

  peerInput: string;
  setPeerInput: (v: string) => void;
  searchOpen: boolean;
  setSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
  searchError: string | null;
  setSearchError: (v: string | null) => void;

  unreadEntries: Array<[string, { user: string; count: number }]>;
  goToConversation: (conversationId: string) => void;

  menuRef: React.MutableRefObject<React.ElementRef<typeof Pressable> | null>;
  openMenu: () => void;

  onPressChannelNav: () => void;
  onPressChannelSearch: () => void;
  onPressDmNav: () => void;
  onPressDmSearch: () => void;
  onStartDm: () => void | Promise<void>;
}): React.JSX.Element {
  const dmActive = isDmMode || searchOpen;
  return (
    <>
      <View style={styles.topRow}>
        <View style={[styles.segment, isDark && styles.segmentDark]}>
          <View
            style={[
              styles.segmentBtn,
              styles.segmentBtnGrow,
              isChannelMode && styles.segmentBtnActive,
              isChannelMode && isDark && styles.segmentBtnActiveDark,
            ]}
          >
            <Pressable
              onPress={onPressChannelNav}
              style={({ pressed }) => [
                styles.segmentBtnMainArea,
                styles.segmentBtnMainAreaShrink,
                pressed && { opacity: 0.9 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Go to channel"
            >
              <Text
                style={[
                  styles.segmentBtnText,
                  styles.segmentBtnTextTruncate,
                  isDark && styles.segmentBtnTextDark,
                  isChannelMode && styles.segmentBtnTextActive,
                  isChannelMode && isDark && styles.segmentBtnTextActiveDark,
                ]}
                numberOfLines={1}
              >
                {activeChannelLabel}
              </Text>
            </Pressable>

            <Pressable
              onPress={onPressChannelSearch}
              style={({ pressed }) => [styles.segmentBtnChipHitbox, pressed && { opacity: 0.9 }]}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Find channels"
            >
              <View style={styles.segmentBtnChipCircle}>
                <View
                  style={[
                    styles.segmentBtnChipBgTall,
                    !isDark && !isChannelMode && styles.segmentBtnChipBgTallLightUnselected,
                    isDark && styles.segmentBtnChipBgTallDark,
                  ]}
                />
                <Feather
                  name="search"
                  size={18}
                  color={isDark ? APP_COLORS.dark.text.muted : APP_COLORS.light.text.muted}
                />
              </View>
            </Pressable>
          </View>

          <View
            style={[
              styles.segmentBtn,
              styles.segmentBtnFixed,
              dmActive && styles.segmentBtnActive,
              dmActive && isDark && styles.segmentBtnActiveDark,
            ]}
          >
            <Pressable
              onPress={onPressDmNav}
              style={({ pressed }) => [
                styles.segmentBtnMainArea,
                styles.segmentBtnMainAreaShrink,
                pressed && { opacity: 0.9 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Go to last direct message"
            >
              <View style={styles.dmPillInner}>
                <Text
                  style={[
                    styles.segmentBtnText,
                    styles.segmentBtnTextTruncate,
                    isDark && styles.segmentBtnTextDark,
                    dmActive && styles.segmentBtnTextActive,
                    dmActive && isDark && styles.segmentBtnTextActiveDark,
                  ]}
                  numberOfLines={1}
                >
                  {activeDmLabel || 'DM'}
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={onPressDmSearch}
              style={({ pressed }) => [
                styles.segmentBtnChipHitbox,
                hasUnreadDms && styles.segmentBtnChipHitboxWide,
                pressed && { opacity: 0.9 },
              ]}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Enter names"
            >
              <View
                style={[
                  styles.segmentBtnChipCircle,
                  hasUnreadDms && styles.segmentBtnChipCircleWide,
                ]}
              >
                <View
                  style={[
                    styles.segmentBtnChipBgTall,
                    hasUnreadDms && styles.segmentBtnChipBgTallWide,
                    !isDark && !dmActive && styles.segmentBtnChipBgTallLightUnselected,
                    isDark && styles.segmentBtnChipBgTallDark,
                  ]}
                />
                {hasUnreadDms ? <View style={styles.unreadDot} /> : null}
                <Feather
                  name="search"
                  size={18}
                  color={isDark ? APP_COLORS.dark.text.muted : APP_COLORS.light.text.muted}
                />
              </View>
            </Pressable>
          </View>
        </View>

        <View style={styles.rightControls}>
          <Pressable
            ref={menuRef}
            onPress={openMenu}
            style={({ pressed }) => [
              styles.menuIconBtn,
              isDark && styles.menuIconBtnDark,
              pressed && { opacity: 0.85 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Open menu"
          >
            <AppBrandIcon
              isDark={isDark}
              fit="contain"
              slotWidth={32}
              slotHeight={32}
              accessible={false}
            />
          </Pressable>
        </View>
      </View>

      {searchOpen && (
        <View
          style={[
            styles.searchWrapper,
            // When there are no unread hints, add a bit more space before the chat title row.
            // If there ARE unread hints, keep it tight so we don't "double pad" the header.
            !unreadEntries.length ? { marginBottom: 6 } : null,
          ]}
        >
          <View style={styles.searchRow}>
            <AppTextInput
              isDark={isDark}
              value={peerInput}
              onChangeText={(value) => {
                setPeerInput(value);
                setSearchError(null);
              }}
              placeholder="Enter Names"
              baseStyle={styles.searchInput}
              darkStyle={styles.searchInputDark}
              returnKeyType="go"
              onSubmitEditing={() => void Promise.resolve(onStartDm())}
            />
            <Pressable
              onPress={() => void Promise.resolve(onStartDm())}
              style={({ pressed }) => [
                styles.startDmBtn,
                isDark && styles.startDmBtnDark,
                pressed && { opacity: 0.9 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Start direct message"
            >
              <Text style={[styles.startDmBtnText, isDark && styles.startDmBtnTextDark]}>
                Start DM
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setSearchOpen(false);
                setPeerInput('');
                setSearchError(null);
              }}
              style={({ pressed }) => [
                styles.cancelBtn,
                isDark && styles.cancelBtnDark,
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Cancel direct message"
            >
              <Text style={[styles.cancelBtnText, isDark && styles.cancelBtnTextDark]}>Cancel</Text>
            </Pressable>
          </View>
          {unreadEntries.length ? (
            <View style={styles.unreadList}>
              {unreadEntries.map(([convId, info]) => (
                <Pressable
                  key={convId}
                  style={styles.unreadHintWrapper}
                  onPress={() => goToConversation(convId)}
                >
                  <Text style={[styles.unreadHint, isDark && styles.unreadHintDark]}>
                    {info.count} unread {info.count === 1 ? 'message' : 'messages'} from{' '}
                    <Text style={[styles.unreadHintBold, isDark && styles.unreadHintBoldDark]}>
                      {info.user}
                    </Text>
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      )}

      {searchError ? (
        <Text style={[styles.errorText, isDark && styles.errorTextDark]}>{searchError}</Text>
      ) : null}
    </>
  );
}
