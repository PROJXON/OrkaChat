import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import { Platform, Pressable, Switch, Text, View } from 'react-native';

import type { ChatScreenStyles } from '../../../screens/ChatScreen.styles';
import { APP_COLORS } from '../../../theme/colors';

function MiniToggle({
  value,
  onValueChange,
  disabled,
  isDark,
  styles,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  isDark: boolean;
  styles: ChatScreenStyles;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        onValueChange(!value);
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      style={({ pressed }) => [
        styles.miniToggleTrack,
        isDark ? styles.miniToggleTrackDark : null,
        value ? styles.miniToggleTrackOn : null,
        value && isDark ? styles.miniToggleTrackOnDark : null,
        disabled ? styles.miniToggleDisabled : null,
        pressed && !disabled ? styles.miniTogglePressed : null,
      ]}
    >
      <View
        style={[
          styles.miniToggleThumb,
          isDark ? styles.miniToggleThumbDark : null,
          value ? styles.miniToggleThumbOn : null,
        ]}
      />
    </Pressable>
  );
}

type Props = {
  isDark: boolean;
  styles: ChatScreenStyles;
  compact: boolean;
  busy: boolean;

  meIsAdmin: boolean;
  isPublic: boolean;
  hasPassword: boolean;

  membersCountLabel: string;

  onOpenMembers: () => void;
  onOpenAbout: () => void;
  onOpenName: () => void;
  onLeave: () => void;

  onTogglePublic: (next: boolean) => void;
  onPressPassword: () => void;
};

export function ChannelSettingsPanel({
  isDark,
  styles,
  compact,
  busy,
  meIsAdmin,
  isPublic,
  hasPassword,
  membersCountLabel,
  onOpenMembers,
  onOpenAbout,
  onOpenName,
  onLeave,
  onTogglePublic,
  onPressPassword,
}: Props) {
  return (
    <View style={[styles.channelAdminPanel, compact ? { rowGap: 8 } : null]}>
      {/* Row 1: Members + (About/Name/Leave) */}
      <View style={[styles.channelAdminRow, compact ? { flexWrap: 'wrap' } : null]}>
        <View style={[styles.dmSettingGroup, { flexGrow: 1 }]}>
          <Text
            style={[
              styles.decryptLabel,
              isDark ? styles.decryptLabelDark : null,
              styles.dmSettingLabel,
              compact ? styles.dmSettingLabelCompact : null,
            ]}
            numberOfLines={1}
          >
            Members
          </Text>
          <Pressable
            style={[
              styles.toolBtn,
              isDark ? styles.toolBtnDark : null,
              busy ? { opacity: 0.6 } : null,
            ]}
            disabled={busy}
            onPress={onOpenMembers}
          >
            <Text style={[styles.toolBtnText, isDark ? styles.toolBtnTextDark : null]}>
              {membersCountLabel}
            </Text>
          </Pressable>
        </View>

        <View style={[styles.channelAdminActions, compact ? { flexWrap: 'wrap' } : null]}>
          {meIsAdmin ? (
            <Pressable
              style={[
                styles.toolBtn,
                isDark ? styles.toolBtnDark : null,
                busy ? { opacity: 0.6 } : null,
              ]}
              disabled={busy}
              onPress={onOpenAbout}
            >
              <Text style={[styles.toolBtnText, isDark ? styles.toolBtnTextDark : null]}>
                About
              </Text>
            </Pressable>
          ) : null}

          {meIsAdmin ? (
            <Pressable
              style={[
                styles.toolBtn,
                isDark ? styles.toolBtnDark : null,
                busy ? { opacity: 0.6 } : null,
                // Some RN versions don't support `gap` reliably; enforce spacing explicitly.
                { marginLeft: 10 },
              ]}
              disabled={busy}
              onPress={onOpenName}
            >
              <Text style={[styles.toolBtnText, isDark ? styles.toolBtnTextDark : null]}>Name</Text>
            </Pressable>
          ) : null}

          <Pressable
            style={[
              styles.toolBtn,
              isDark ? styles.toolBtnDark : null,
              busy ? { opacity: 0.6 } : null,
              // Some RN versions don't support `gap` reliably; enforce spacing explicitly.
              { marginLeft: 10 },
            ]}
            disabled={busy}
            onPress={onLeave}
          >
            <Text style={[styles.toolBtnText, isDark ? styles.toolBtnTextDark : null]}>Leave</Text>
          </Pressable>
        </View>
      </View>

      {/* Row 2: Visibility + Password */}
      <View
        style={[styles.channelAdminRow, { marginTop: 8 }, compact ? { flexWrap: 'wrap' } : null]}
      >
        <View style={[styles.dmSettingGroup, { flexGrow: 1 }]}>
          {meIsAdmin ? (
            <>
              <Text
                style={[
                  styles.decryptLabel,
                  isDark ? styles.decryptLabelDark : null,
                  styles.dmSettingLabel,
                  compact ? styles.dmSettingLabelCompact : null,
                ]}
                numberOfLines={1}
              >
                Visibility
              </Text>
              {Platform.OS === 'web' ? (
                <MiniToggle
                  value={!!isPublic}
                  disabled={busy}
                  isDark={isDark}
                  styles={styles}
                  onValueChange={onTogglePublic}
                />
              ) : (
                <Switch
                  value={!!isPublic}
                  disabled={busy}
                  onValueChange={onTogglePublic}
                  trackColor={{
                    false: APP_COLORS.light.border.default,
                    true: APP_COLORS.light.border.default,
                  }}
                  thumbColor={isDark ? APP_COLORS.dark.border.subtle : APP_COLORS.light.bg.app}
                  ios_backgroundColor={APP_COLORS.light.border.default}
                />
              )}
              <Text
                style={[
                  styles.decryptLabel,
                  isDark ? styles.decryptLabelDark : null,
                  styles.dmSettingLabel,
                  compact ? styles.dmSettingLabelCompact : null,
                  { fontWeight: '900' },
                ]}
                numberOfLines={1}
              >
                {isPublic ? 'Public' : 'Private'}
              </Text>
            </>
          ) : (
            <Text
              style={[
                styles.decryptLabel,
                isDark ? styles.decryptLabelDark : null,
                styles.dmSettingLabel,
                compact ? styles.dmSettingLabelCompact : null,
              ]}
              numberOfLines={1}
            >
              {`Visibility: ${isPublic ? 'Public' : 'Private'}`}
            </Text>
          )}
        </View>

        {meIsAdmin && isPublic ? (
          <View style={styles.channelAdminActions}>
            <Pressable
              style={[
                styles.toolBtn,
                isDark ? styles.toolBtnDark : null,
                busy ? { opacity: 0.6 } : null,
              ]}
              disabled={busy}
              onPress={onPressPassword}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Feather
                  name={hasPassword ? 'lock' : 'unlock'}
                  size={14}
                  color={isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary}
                />
                <Text style={[styles.toolBtnText, isDark ? styles.toolBtnTextDark : null]}>
                  {compact ? 'Password' : hasPassword ? 'Password: On' : 'Password: Off'}
                </Text>
              </View>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}
