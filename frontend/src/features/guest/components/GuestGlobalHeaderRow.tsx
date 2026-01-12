import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { AppBrandIcon } from '../../../components/AppBrandIcon';
import { useMenuAnchor } from '../../../hooks/useMenuAnchor';

export function GuestGlobalHeaderRow({
  isDark,
  isWideUi,
  activeChannelTitle,
  onOpenChannelPicker,
  menu,
  setMenuOpen,
  styles,
}: {
  isDark: boolean;
  isWideUi: boolean;
  activeChannelTitle: string;
  onOpenChannelPicker: () => void;
  menu: ReturnType<typeof useMenuAnchor<React.ElementRef<typeof Pressable>>>;
  setMenuOpen: (v: boolean) => void;
  styles: typeof import('../../../screens/GuestGlobalScreen.styles').styles;
}): React.JSX.Element {
  return (
    <View style={[styles.headerRow, isDark && styles.headerRowDark]}>
      <View style={[styles.headerRowContent, isWideUi ? styles.contentColumn : null]}>
        <Pressable
          onPress={onOpenChannelPicker}
          style={({ pressed }) => [
            { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 2 },
            pressed ? { opacity: 0.9 } : null,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Browse channels"
        >
          <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]} numberOfLines={1}>
            {activeChannelTitle}
          </Text>
          <Feather name="chevron-down" size={16} color={isDark ? '#fff' : '#111'} />
        </Pressable>
        <View style={styles.headerRight}>
          <Pressable
            ref={menu.ref}
            onPress={() => {
              menu.openFromRef({ enabled: isWideUi, onOpen: () => setMenuOpen(true) });
            }}
            style={({ pressed }) => [styles.menuIconBtn, isDark && styles.menuIconBtnDark, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel="Open menu"
          >
            <AppBrandIcon isDark={isDark} fit="contain" slotWidth={32} slotHeight={32} accessible={false} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

