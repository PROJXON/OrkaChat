import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { AnimatedDots } from '../../../components/AnimatedDots';
import { AvatarBubble } from '../../../components/AvatarBubble';
import { CDN_URL } from '../../../config/env';
import type { PublicAvatarProfileLite } from '../../../hooks/usePublicAvatarProfiles';
import type { ChatScreenStyles } from '../../../screens/ChatScreen.styles';
import { APP_COLORS, PALETTE, withAlpha } from '../../../theme/colors';
import { toCdnUrl } from '../../../utils/cdn';

type Props = {
  styles: ChatScreenStyles;
  isDark: boolean;
  displayName: string;
  myUserId: string | null | undefined;
  avatarProfileBySub: Record<string, PublicAvatarProfileLite>;
  avatarUrlByPath: Record<string, string>;
  myAvatarOverride?: { bgColor?: string; textColor?: string; imagePath?: string } | null;
  isConnecting: boolean;
  isConnected: boolean;
  onPressSummarize: () => void;
  onPressAiHelper: () => void;
};

export function ChatHeaderTitleRow({
  styles,
  isDark,
  displayName,
  myUserId,
  avatarProfileBySub,
  avatarUrlByPath,
  myAvatarOverride,
  isConnecting,
  isConnected,
  onPressSummarize,
  onPressAiHelper,
}: Props) {
  const [welcomeRowWidth, setWelcomeRowWidth] = React.useState<number>(0);
  const [avatarWidth, setAvatarWidth] = React.useState<number>(0);
  const [statusWidth, setStatusWidth] = React.useState<number>(0);
  const [welcomePrefixWidth, setWelcomePrefixWidth] = React.useState<number>(0);
  const [welcomeNameWidth, setWelcomeNameWidth] = React.useState<number>(0);

  // Use a non-breaking space so web doesn't visually collapse/trim the gap between
  // "Welcome" and the username when rendered as separate <Text> nodes.
  const welcomePrefixText = 'Welcome\u00A0';
  const welcomeNameText = `${displayName}`;

  const showWelcomePrefix = React.useMemo(() => {
    // Only show "Welcome" if both pieces can fit without truncating the username.
    if (
      !(
        welcomeRowWidth > 0 &&
        avatarWidth >= 0 &&
        statusWidth >= 0 &&
        welcomePrefixWidth > 0 &&
        welcomeNameWidth > 0
      )
    )
      return false;

    // `onLayout().width` does NOT include margins, so subtract the margins we apply in styles.
    const avatarMarginRight = 8; // styles.welcomeAvatar.marginRight
    const statusMarginLeft = 6; // styles.welcomeStatusRow.marginLeft
    const availableTextWidth = Math.max(
      0,
      welcomeRowWidth - avatarWidth - avatarMarginRight - statusWidth - statusMarginLeft,
    );

    return welcomePrefixWidth + welcomeNameWidth <= availableTextWidth;
  }, [welcomeRowWidth, avatarWidth, statusWidth, welcomePrefixWidth, welcomeNameWidth]);

  const myProf = myUserId ? avatarProfileBySub[String(myUserId)] : undefined;
  const o = myAvatarOverride && typeof myAvatarOverride === 'object' ? myAvatarOverride : null;
  const oImagePath =
    o && typeof o.imagePath === 'string' && o.imagePath.trim().length ? o.imagePath.trim() : '';
  const myAvatarImageUri = myProf?.avatarImagePath
    ? avatarUrlByPath[String(myProf.avatarImagePath)]
    : undefined;
  const overrideAvatarImageUri = oImagePath
    ? avatarUrlByPath[oImagePath] || toCdnUrl(CDN_URL, oImagePath) || undefined
    : undefined;

  return (
    <View style={styles.titleRow}>
      <View
        style={styles.welcomeRow}
        onLayout={(e) => {
          const w = e?.nativeEvent?.layout?.width;
          if (typeof w === 'number' && Number.isFinite(w)) setWelcomeRowWidth(w);
        }}
      >
        <View
          style={styles.welcomeAvatar}
          onLayout={(e) => {
            const w = e?.nativeEvent?.layout?.width;
            if (typeof w === 'number' && Number.isFinite(w)) setAvatarWidth(w);
          }}
        >
          <AvatarBubble
            size={34}
            seed={String(myUserId || displayName || 'me')}
            label={displayName || 'me'}
            backgroundColor={myProf?.avatarBgColor || (o?.bgColor as string | undefined)}
            textColor={myProf?.avatarTextColor || (o?.textColor as string | undefined)}
            imageUri={myAvatarImageUri || overrideAvatarImageUri}
            imageBgColor={isDark ? APP_COLORS.dark.bg.header : APP_COLORS.light.bg.surface2}
          />
        </View>
        <View
          style={styles.welcomeTextRow}
          onLayout={(_e) => {
            // Intentionally NOT used for show/hide logic; this container may size to content.
            // Keeping this handler off avoids misleading calculations.
          }}
        >
          {/* Hidden measurement row (absolute so it doesn't affect layout). */}
          <View pointerEvents="none" style={styles.welcomeMeasureRow}>
            <Text
              style={[styles.welcomeText, isDark ? styles.welcomeTextDark : null]}
              numberOfLines={1}
              onLayout={(e) => {
                const w = e?.nativeEvent?.layout?.width;
                if (typeof w === 'number' && Number.isFinite(w)) setWelcomePrefixWidth(w);
              }}
            >
              {welcomePrefixText}
            </Text>
            <Text
              style={[styles.welcomeText, isDark ? styles.welcomeTextDark : null]}
              numberOfLines={1}
              onLayout={(e) => {
                const w = e?.nativeEvent?.layout?.width;
                if (typeof w === 'number' && Number.isFinite(w)) setWelcomeNameWidth(w);
              }}
            >
              {welcomeNameText}
            </Text>
          </View>

          {showWelcomePrefix ? (
            <Text
              style={[styles.welcomeText, isDark ? styles.welcomeTextDark : null]}
              numberOfLines={1}
            >
              {welcomePrefixText}
            </Text>
          ) : null}

          <Text
            style={[
              styles.welcomeText,
              isDark ? styles.welcomeTextDark : null,
              styles.welcomeNameFlex,
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {welcomeNameText}
          </Text>
        </View>
        <View
          style={styles.welcomeStatusRow}
          onLayout={(e) => {
            const w = e?.nativeEvent?.layout?.width;
            if (typeof w === 'number' && Number.isFinite(w)) setStatusWidth(w);
          }}
        >
          {isConnecting ? (
            <AnimatedDots
              color={isDark ? APP_COLORS.dark.text.muted : APP_COLORS.light.text.muted}
              size={14}
            />
          ) : (
            <FontAwesome
              name={isConnected ? 'plug' : 'unlink'}
              size={12}
              color={
                isConnected
                  ? isDark
                    ? withAlpha(APP_COLORS.dark.status.success, 0.55)
                    : withAlpha(PALETTE.successText, 0.75)
                  : isDark
                    ? APP_COLORS.dark.status.errorText
                    : APP_COLORS.light.status.errorText
              }
            />
          )}
        </View>
      </View>
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
