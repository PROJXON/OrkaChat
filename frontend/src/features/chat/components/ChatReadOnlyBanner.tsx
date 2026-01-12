import React from 'react';
import { Text, View } from 'react-native';

import { APP_COLORS } from '../../../theme/colors';

type Props = {
  isDark: boolean;
  status: string;
};

export function ChatReadOnlyBanner({ isDark, status }: Props) {
  const msg =
    status === 'banned'
      ? 'You are banned from this chat'
      : status === 'left'
        ? 'You left this chat'
        : 'This chat is read‑only';

  return (
    <View style={{ paddingVertical: 10, alignItems: 'center' }}>
      <Text
        style={{
          color: isDark ? APP_COLORS.dark.text.muted : APP_COLORS.light.text.muted,
          fontStyle: 'italic',
          fontWeight: '700',
        }}
      >
        {msg}
      </Text>
    </View>
  );
}
