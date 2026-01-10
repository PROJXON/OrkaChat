import React from 'react';
import { Platform, Pressable, Switch, Text, View } from 'react-native';

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
  styles: Record<string, any>;
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
  styles: Record<string, any>;
  compact: boolean;

  isDm: boolean;
  isGroup: boolean;

  myPrivateKeyReady: boolean;

  autoDecrypt: boolean;
  onToggleAutoDecrypt: (v: boolean) => void;

  ttlLabel: string;
  onOpenTtlPicker: () => void;

  sendReadReceipts: boolean;
  onToggleReadReceipts: (v: boolean) => void;

  groupMembersCountLabel: string;
  groupActionBusy: boolean;
  groupMeIsAdmin: boolean;
  onOpenGroupMembers: () => void;
  onOpenGroupName: () => void;
  onLeaveGroup: () => void;
};

export function DmSettingsPanel({
  isDark,
  styles,
  compact,
  isDm,
  isGroup,
  myPrivateKeyReady,
  autoDecrypt,
  onToggleAutoDecrypt,
  ttlLabel,
  onOpenTtlPicker,
  sendReadReceipts,
  onToggleReadReceipts,
  groupMembersCountLabel,
  groupActionBusy,
  groupMeIsAdmin,
  onOpenGroupMembers,
  onOpenGroupName,
  onLeaveGroup,
}: Props) {
  return (
    <>
      {isDm ? (
        <View style={styles.dmSettingsRow}>
          <View style={styles.dmSettingSlotLeft}>
            <View style={styles.dmSettingGroup}>
              <Text
                style={[
                  styles.decryptLabel,
                  isDark ? styles.decryptLabelDark : null,
                  styles.dmSettingLabel,
                  compact ? styles.dmSettingLabelCompact : null,
                ]}
                numberOfLines={1}
              >
                Auto‑Decrypt
              </Text>
              {compact ? (
                <MiniToggle
                  value={autoDecrypt}
                  onValueChange={onToggleAutoDecrypt}
                  disabled={!myPrivateKeyReady}
                  isDark={isDark}
                  styles={styles}
                />
              ) : Platform.OS === 'web' ? (
                <MiniToggle
                  value={autoDecrypt}
                  onValueChange={onToggleAutoDecrypt}
                  disabled={!myPrivateKeyReady}
                  isDark={isDark}
                  styles={styles}
                />
              ) : (
                <Switch
                  value={autoDecrypt}
                  onValueChange={onToggleAutoDecrypt}
                  disabled={!myPrivateKeyReady}
                  trackColor={{ false: '#d1d1d6', true: '#d1d1d6' }}
                  thumbColor={isDark ? '#2a2a33' : '#ffffff'}
                  ios_backgroundColor="#d1d1d6"
                />
              )}
            </View>
          </View>

          <View style={styles.dmSettingSlotCenter}>
            <View style={styles.dmSettingGroup}>
              <Text
                style={[
                  styles.decryptLabel,
                  isDark ? styles.decryptLabelDark : null,
                  styles.dmSettingLabel,
                  compact ? styles.dmSettingLabelCompact : null,
                ]}
                numberOfLines={1}
              >
                Self‑Destruct
              </Text>
              <Pressable
                style={[styles.ttlChip, isDark ? styles.ttlChipDark : null, compact ? styles.ttlChipCompact : null]}
                onPress={onOpenTtlPicker}
              >
                <Text style={[styles.ttlChipText, isDark ? styles.ttlChipTextDark : null]}>{ttlLabel}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.dmSettingSlotRight}>
            <View style={styles.dmSettingGroup}>
              <Text
                style={[
                  styles.decryptLabel,
                  isDark ? styles.decryptLabelDark : null,
                  styles.dmSettingLabel,
                  compact ? styles.dmSettingLabelCompact : null,
                ]}
                numberOfLines={1}
              >
                Read Receipts
              </Text>
              {compact ? (
                <MiniToggle
                  value={sendReadReceipts}
                  isDark={isDark}
                  styles={styles}
                  onValueChange={onToggleReadReceipts}
                />
              ) : Platform.OS === 'web' ? (
                <MiniToggle
                  value={sendReadReceipts}
                  isDark={isDark}
                  styles={styles}
                  onValueChange={onToggleReadReceipts}
                />
              ) : (
                <Switch
                  value={sendReadReceipts}
                  onValueChange={onToggleReadReceipts}
                  trackColor={{ false: '#d1d1d6', true: '#d1d1d6' }}
                  thumbColor={isDark ? '#2a2a33' : '#ffffff'}
                  ios_backgroundColor="#d1d1d6"
                />
              )}
            </View>
          </View>
        </View>
      ) : null}

      {isGroup ? (
        <View style={[styles.dmSettingsRow, styles.groupSettingsRow]}>
          <View style={styles.dmSettingSlotLeft}>
            <View style={styles.dmSettingGroup}>
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
                style={[styles.toolBtn, isDark ? styles.toolBtnDark : null, groupActionBusy ? { opacity: 0.6 } : null]}
                disabled={groupActionBusy}
                onPress={onOpenGroupMembers}
              >
                <Text style={[styles.toolBtnText, isDark ? styles.toolBtnTextDark : null]}>
                  {groupMembersCountLabel}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.dmSettingSlotCenter}>
            <View style={styles.dmSettingGroup}>
              <Text
                style={[
                  styles.decryptLabel,
                  isDark ? styles.decryptLabelDark : null,
                  styles.dmSettingLabel,
                  compact ? styles.dmSettingLabelCompact : null,
                ]}
                numberOfLines={1}
              >
                Auto‑Decrypt
              </Text>
              {compact ? (
                <MiniToggle
                  value={autoDecrypt}
                  onValueChange={onToggleAutoDecrypt}
                  disabled={!myPrivateKeyReady}
                  isDark={isDark}
                  styles={styles}
                />
              ) : Platform.OS === 'web' ? (
                <MiniToggle
                  value={autoDecrypt}
                  onValueChange={onToggleAutoDecrypt}
                  disabled={!myPrivateKeyReady}
                  isDark={isDark}
                  styles={styles}
                />
              ) : (
                <Switch
                  value={autoDecrypt}
                  onValueChange={onToggleAutoDecrypt}
                  disabled={!myPrivateKeyReady}
                  trackColor={{ false: '#d1d1d6', true: '#d1d1d6' }}
                  thumbColor={isDark ? '#2a2a33' : '#ffffff'}
                  ios_backgroundColor="#d1d1d6"
                />
              )}
            </View>
          </View>

          <View style={styles.dmSettingSlotRight}>
            <View style={[styles.dmSettingGroup, { justifyContent: 'flex-end', gap: 10 }]}>
              {groupMeIsAdmin ? (
                <Pressable
                  style={[
                    styles.toolBtn,
                    isDark ? styles.toolBtnDark : null,
                    groupActionBusy ? { opacity: 0.6 } : null,
                  ]}
                  disabled={groupActionBusy}
                  onPress={onOpenGroupName}
                >
                  <Text style={[styles.toolBtnText, isDark ? styles.toolBtnTextDark : null]}>Name</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={[styles.toolBtn, isDark ? styles.toolBtnDark : null, groupActionBusy ? { opacity: 0.6 } : null]}
                disabled={groupActionBusy}
                onPress={onLeaveGroup}
              >
                <Text style={[styles.toolBtnText, isDark ? styles.toolBtnTextDark : null]}>Leave</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </>
  );
}
