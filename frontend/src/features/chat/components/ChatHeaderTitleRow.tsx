import React from 'react';
import { Pressable, Text, View } from 'react-native';

import type { ChatScreenStyles } from '../../../screens/ChatScreen.styles';

type Props = {
  styles: ChatScreenStyles;
  isDark: boolean;
  title: string;
  onPressSummarize: () => void;
  onPressAiHelper: () => void;
};

export function ChatHeaderTitleRow({
  styles,
  isDark,
  title,
  onPressSummarize,
  onPressAiHelper,
}: Props) {
  return (
    <View style={styles.titleRow}>
      <Text
        style={[styles.title, isDark ? styles.titleDark : null]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {title}
      </Text>
      <View style={styles.headerTools}>
        <Pressable
          style={[styles.summarizeBtn, isDark ? styles.summarizeBtnDark : null]}
          onPress={onPressSummarize}
        >
          <Text style={[styles.summarizeBtnText, isDark ? styles.summarizeBtnTextDark : null]}>
            Summarize
          </Text>
        </Pressable>
        <Pressable
          style={[styles.summarizeBtn, isDark ? styles.summarizeBtnDark : null]}
          onPress={onPressAiHelper}
        >
          <Text style={[styles.summarizeBtnText, isDark ? styles.summarizeBtnTextDark : null]}>
            AI Helper
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
