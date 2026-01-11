import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { AppBrandIcon } from '../../../components/AppBrandIcon';

export function MainAppHeaderTop({
  styles,
  isDark,
  isWideUi,

  activeChannelLabel,
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

  onPressChannelTab,
  onStartDm,
}: {
  styles: any;
  isDark: boolean;
  isWideUi: boolean;

  activeChannelLabel: string;
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

  menuRef: any;
  openMenu: () => void;

  onPressChannelTab: () => void;
  onStartDm: () => void | Promise<void>;
}): React.JSX.Element {
  return (
    <>
      <View style={styles.topRow}>
        <View style={[styles.segment, isDark && styles.segmentDark]}>
          <Pressable
            onPress={onPressChannelTab}
            style={({ pressed }) => [
              styles.segmentBtn,
              isChannelMode && styles.segmentBtnActive,
              isChannelMode && isDark && styles.segmentBtnActiveDark,
              pressed && { opacity: 0.9 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Channels"
          >
            <Text
              style={[
                styles.segmentBtnText,
                isDark && styles.segmentBtnTextDark,
                isChannelMode && styles.segmentBtnTextActive,
                isChannelMode && isDark && styles.segmentBtnTextActiveDark,
              ]}
            >
              {activeChannelLabel}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setSearchOpen((prev) => !prev)}
            style={({ pressed }) => [
              styles.segmentBtn,
              (isDmMode || searchOpen) && styles.segmentBtnActive,
              (isDmMode || searchOpen) && isDark && styles.segmentBtnActiveDark,
              pressed && { opacity: 0.9 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Direct messages"
          >
            <View style={styles.dmPillInner}>
              <Text
                style={[
                  styles.segmentBtnText,
                  isDark && styles.segmentBtnTextDark,
                  (isDmMode || searchOpen) && styles.segmentBtnTextActive,
                  (isDmMode || searchOpen) && isDark && styles.segmentBtnTextActiveDark,
                ]}
              >
                DM
              </Text>
              {hasUnreadDms ? <View style={styles.unreadDot} /> : null}
            </View>
          </Pressable>
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
            <AppBrandIcon isDark={isDark} fit="contain" slotWidth={32} slotHeight={32} accessible={false} />
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
            <TextInput
              value={peerInput}
              onChangeText={(value) => {
                setPeerInput(value);
                setSearchError(null);
              }}
              placeholder="Enter Names"
              placeholderTextColor={isDark ? '#8f8fa3' : '#999'}
              selectionColor={isDark ? '#ffffff' : '#111'}
              cursorColor={isDark ? '#ffffff' : '#111'}
              style={[styles.searchInput, isDark && styles.searchInputDark]}
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
              <Text style={[styles.startDmBtnText, isDark && styles.startDmBtnTextDark]}>Start DM</Text>
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
                    <Text style={[styles.unreadHintBold, isDark && styles.unreadHintBoldDark]}>{info.user}</Text>
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

