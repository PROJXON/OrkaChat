import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { APP_COLORS, PALETTE } from '../../../theme/colors';

type Props = {
  isDark: boolean;
  hasMore: boolean;
  loading: boolean;
  isEmpty: boolean;
  onPress: () => void;
  emptyText?: string;
  noMoreText?: string;
  enablePressedOpacity?: boolean;
};

export function ChatHistoryLoadMore({
  isDark,
  hasMore,
  loading,
  isEmpty,
  onPress,
  emptyText,
  noMoreText,
  enablePressedOpacity,
}: Props) {
  return (
    <View style={{ paddingVertical: 10, alignItems: 'center' }}>
      {hasMore ? (
        <Pressable
          onPress={onPress}
          disabled={loading}
          style={({ pressed }) => ({
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: 999,
            backgroundColor: isDark ? APP_COLORS.dark.border.subtle : PALETTE.mist,
            opacity: loading ? 0.6 : enablePressedOpacity && pressed ? 0.85 : 1,
          })}
        >
          <Text
            style={{
              color: isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary,
              fontWeight: '700',
            }}
          >
            {loading ? 'Loading older…' : 'Load older messages'}
          </Text>
        </Pressable>
      ) : (
        <Text style={{ color: isDark ? APP_COLORS.dark.text.muted : APP_COLORS.light.text.muted }}>
          {isEmpty ? emptyText || 'Start the Conversation!' : noMoreText || 'No Older Messages'}
        </Text>
      )}
    </View>
  );
}
