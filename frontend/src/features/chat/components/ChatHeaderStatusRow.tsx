import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { AvatarBubble } from '../../../components/AvatarBubble';
import { AnimatedDots } from '../../../components/AnimatedDots';
import type { ChatScreenStyles } from '../../../screens/ChatScreen.styles';
import type { PublicAvatarProfileLite } from '../../../hooks/usePublicAvatarProfiles';

type Props = {
  styles: ChatScreenStyles;
  isDark: boolean;
  displayName: string;

  myUserId: string | null | undefined;
  avatarProfileBySub: Record<string, PublicAvatarProfileLite>;
  avatarUrlByPath: Record<string, string>;

  isConnecting: boolean;
  isConnected: boolean;

  showCaret: boolean;
  caretExpanded: boolean;
  caretA11yLabel: string;
  onPressCaret: () => void;
};

export function ChatHeaderStatusRow({
  styles,
  isDark,
  displayName,
  myUserId,
  avatarProfileBySub,
  avatarUrlByPath,
  isConnecting,
  isConnected,
  showCaret,
  caretExpanded,
  caretA11yLabel,
  onPressCaret,
}: Props) {
  const myProf = myUserId ? avatarProfileBySub[String(myUserId)] : undefined;
  const myAvatarImageUri = myProf?.avatarImagePath ? avatarUrlByPath[String(myProf.avatarImagePath)] : undefined;

  return (
    <View style={styles.headerSubRow}>
      <View style={styles.welcomeRow}>
        <AvatarBubble
          size={34}
          seed={String(myUserId || displayName || 'me')}
          label={displayName || 'me'}
          backgroundColor={myProf?.avatarBgColor}
          textColor={myProf?.avatarTextColor}
          imageUri={myAvatarImageUri}
          imageBgColor={isDark ? '#1c1c22' : '#f2f2f7'}
          style={styles.welcomeAvatar}
        />
        <Text
          style={[styles.welcomeText, isDark ? styles.welcomeTextDark : null, styles.welcomeTextFlex]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {`Welcome ${displayName}!`}
        </Text>
        <View style={styles.welcomeStatusRow}>
          <Text
            style={[
              styles.welcomeStatusText,
              isDark ? styles.statusTextDark : null,
              !isConnecting ? (isConnected ? styles.ok : styles.err) : null,
            ]}
            numberOfLines={1}
          >
            {isConnecting ? 'Connecting' : isConnected ? 'Connected' : 'Disconnected'}
          </Text>
          {isConnecting ? (
            <AnimatedDots
              // Don't read colors off StyleSheet objects (can be numeric in prod).
              color={isDark ? '#a7a7b4' : '#666'}
              size={16}
            />
          ) : null}
          {showCaret ? (
            <Pressable
              style={({ pressed }) => [styles.dmSettingsCaretBtn, pressed ? { opacity: 0.65 } : null]}
              onPress={onPressCaret}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={caretA11yLabel}
            >
              <MaterialIcons
                name={caretExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                size={18}
                color={isDark ? '#b7b7c2' : '#555'}
              />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}
