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

type WideProps = Omit<Props, 'compact'>;

type WidePlacement = {
  shouldWrap: boolean;
  clusterLeft?: number;
};

type WideLayoutMode = 'overlay_both' | 'overlay_visibility_only' | 'wrap_all';

type WideLayoutDecision = {
  mode: WideLayoutMode;
  clusterLeft?: number;
};

function WideChannelSettingsPanel({
  isDark,
  styles,
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
}: WideProps) {
  // Measure *content* widths (not flex slot widths) so we only wrap when the
  // actual controls would collide.
  const [wideLayout, setWideLayout] = React.useState<{
    containerW: number;
    membersActualW: number;
    visibilityW: number;
    passwordW: number;
    actionsActualW: number;
  }>({
    containerW: 0,
    membersActualW: 0,
    visibilityW: 0,
    passwordW: 0,
    actionsActualW: 0,
  });

  const setIfChanged = React.useCallback(
    (
      key: 'containerW' | 'membersActualW' | 'visibilityW' | 'passwordW' | 'actionsActualW',
      w: number,
    ) => {
      if (!(w > 0) || !Number.isFinite(w)) return;
      setWideLayout((prev) => {
        const prevW = prev[key];
        if (Math.abs(prevW - w) < 1) return prev;
        return { ...prev, [key]: w };
      });
    },
    [],
  );

  const hasPasswordControl = meIsAdmin ? !!isPublic : !!(isPublic && hasPassword);
  const memberPasswordProtected = !meIsAdmin && isPublic && hasPasswordControl;

  // If the password control disappears, clear the cached width so we don't
  // keep wrapping based on stale measurements.
  React.useEffect(() => {
    if (hasPasswordControl) return;
    setWideLayout((prev) => (prev.passwordW === 0 ? prev : { ...prev, passwordW: 0 }));
  }, [hasPasswordControl]);

  // Decide what to keep on the top row:
  // - Prefer keeping BOTH (Visibility + Password) up if possible
  // - Otherwise keep Visibility up and move Password to row 2
  // - Otherwise wrap both to row 2
  const wideDecision = React.useMemo<WideLayoutDecision>(() => {
    const { containerW, membersActualW, actionsActualW, visibilityW, passwordW } = wideLayout;
    if (!(containerW > 0 && visibilityW > 0)) {
      return { mode: 'overlay_both' };
    }

    // The overlay is absolutely positioned; don't reserve extra space here.
    // We want wrapping to happen only when we truly cannot place the control
    // anywhere without overlapping.
    const leftGap = 8; // keep a little space from Members chip
    const rightGap = 4; // small buffer from right-side actions

    // Use the *actual* rendered widths from the real row (post-flex/truncation),
    // not the hidden "intrinsic" widths. This avoids wrapping too early when
    // there's still plenty of space.
    const membersEffW = membersActualW;
    const actionsEffW = actionsActualW;

    const computePlacement = (w: number): WidePlacement => {
      if (!(w > 0)) return { shouldWrap: false };
      const minCenter = membersEffW + leftGap + w / 2;
      const maxCenter = containerW - actionsEffW - rightGap - w / 2;
      if (minCenter > maxCenter) return { shouldWrap: true };

      const desiredCenter = containerW / 2;
      const clampedCenter = Math.min(Math.max(desiredCenter, minCenter), maxCenter);
      const left = Math.min(Math.max(0, clampedCenter - w / 2), Math.max(0, containerW - w));
      return { shouldWrap: false, clusterLeft: left };
    };

    const passwordSpacing = hasPasswordControl ? 10 : 0;
    const bothW = visibilityW + (hasPasswordControl ? passwordSpacing + passwordW : 0);

    // 1) Try keeping the whole cluster up (Visibility + Password)
    const both = computePlacement(bothW);
    if (!both.shouldWrap) return { mode: 'overlay_both', clusterLeft: both.clusterLeft };

    // If this is the member "Password Protected" chip, keep it paired with
    // Public/Private: if one drops, both drop.
    if (memberPasswordProtected) return { mode: 'wrap_all' };

    // 2) Otherwise keep Visibility up (and let Password drop)
    const vis = computePlacement(visibilityW);
    if (!vis.shouldWrap) return { mode: 'overlay_visibility_only', clusterLeft: vis.clusterLeft };

    // 3) Last resort: wrap all controls down
    return { mode: 'wrap_all' };
  }, [hasPasswordControl, memberPasswordProtected, wideLayout]);

  const visibilityControl = (
    <View style={styles.dmSettingGroup}>
      {meIsAdmin ? (
        <>
          <Text
            style={[
              styles.decryptLabel,
              isDark ? styles.decryptLabelDark : null,
              styles.dmSettingLabel,
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
          ]}
          numberOfLines={1}
        >
          {isPublic ? 'Public' : 'Private'}
        </Text>
      )}
    </View>
  );

  const passwordControl =
    meIsAdmin && isPublic ? (
      <Pressable
        style={[styles.toolBtn, isDark ? styles.toolBtnDark : null, busy ? { opacity: 0.6 } : null]}
        disabled={busy}
        onPress={onPressPassword}
      >
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0 }}
        >
          <Feather
            name={hasPassword ? 'lock' : 'unlock'}
            size={14}
            color={isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary}
          />
          <Text
            style={[
              styles.toolBtnText,
              isDark ? styles.toolBtnTextDark : null,
              { flexShrink: 1, minWidth: 0 },
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {hasPassword ? 'Password: On' : 'Password: Off'}
          </Text>
        </View>
      </Pressable>
    ) : !meIsAdmin && isPublic && hasPassword ? (
      <View style={[styles.toolBtn, isDark ? styles.toolBtnDark : null, { maxWidth: '100%' }]}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0 }}
        >
          <Feather
            name="lock"
            size={14}
            color={isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary}
          />
          <Text
            style={[
              styles.toolBtnText,
              isDark ? styles.toolBtnTextDark : null,
              { flexShrink: 1, minWidth: 0 },
            ]}
            numberOfLines={1}
          >
            Password Protected
          </Text>
        </View>
      </View>
    ) : null;

  const MembersControl = ({ onLayout }: { onLayout?: (w: number) => void }) => (
    <View
      style={styles.dmSettingGroup}
      onLayout={onLayout ? (e) => onLayout(Number(e?.nativeEvent?.layout?.width ?? 0)) : undefined}
    >
      <Text
        style={[
          styles.decryptLabel,
          isDark ? styles.decryptLabelDark : null,
          styles.dmSettingLabel,
        ]}
        numberOfLines={1}
      >
        Members
      </Text>
      <Pressable
        style={[styles.toolBtn, isDark ? styles.toolBtnDark : null, busy ? { opacity: 0.6 } : null]}
        accessibilityRole="button"
        accessibilityLabel="Members"
        disabled={busy}
        onPress={onOpenMembers}
      >
        <Text style={[styles.toolBtnText, isDark ? styles.toolBtnTextDark : null]}>
          {membersCountLabel}
        </Text>
      </Pressable>
    </View>
  );

  const ClusterControl = ({ onLayout }: { onLayout?: (w: number) => void }) => (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
      onLayout={onLayout ? (e) => onLayout(Number(e?.nativeEvent?.layout?.width ?? 0)) : undefined}
    >
      {visibilityControl}
      {passwordControl ? <View style={{ marginLeft: 10 }}>{passwordControl}</View> : null}
    </View>
  );

  const VisibilityOnlyControl = ({ onLayout }: { onLayout?: (w: number) => void }) => (
    <View
      onLayout={onLayout ? (e) => onLayout(Number(e?.nativeEvent?.layout?.width ?? 0)) : undefined}
    >
      {visibilityControl}
    </View>
  );

  const PasswordOnlyControl = ({ onLayout }: { onLayout?: (w: number) => void }) =>
    passwordControl ? (
      <View
        onLayout={
          onLayout ? (e) => onLayout(Number(e?.nativeEvent?.layout?.width ?? 0)) : undefined
        }
      >
        {passwordControl}
      </View>
    ) : null;

  const ActionsControl = ({ onLayout }: { onLayout?: (w: number) => void }) => (
    <View
      style={[styles.channelAdminActions, { justifyContent: 'flex-end', marginLeft: 0 }]}
      onLayout={onLayout ? (e) => onLayout(Number(e?.nativeEvent?.layout?.width ?? 0)) : undefined}
    >
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
          <Text style={[styles.toolBtnText, isDark ? styles.toolBtnTextDark : null]}>About</Text>
        </Pressable>
      ) : null}

      {meIsAdmin ? (
        <Pressable
          style={[
            styles.toolBtn,
            isDark ? styles.toolBtnDark : null,
            busy ? { opacity: 0.6 } : null,
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
          { marginLeft: 10 },
        ]}
        disabled={busy}
        onPress={onLeave}
      >
        <Text style={[styles.toolBtnText, isDark ? styles.toolBtnTextDark : null]}>Leave</Text>
      </Pressable>
    </View>
  );

  return (
    <View
      style={styles.channelAdminPanel}
      onLayout={(e) => setIfChanged('containerW', Number(e?.nativeEvent?.layout?.width ?? 0))}
    >
      {/* Hidden measurement row (intrinsic widths, no flex). */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', opacity: 0, left: 0, top: 0, flexDirection: 'row' }}
      >
        <View style={{ marginLeft: 10 }}>
          <VisibilityOnlyControl onLayout={(w) => setIfChanged('visibilityW', w)} />
        </View>
        <View style={{ marginLeft: 10 }}>
          <PasswordOnlyControl onLayout={(w) => setIfChanged('passwordW', w)} />
        </View>
      </View>

      {wideDecision.mode === 'wrap_all' ? (
        <>
          <View style={styles.channelAdminRow}>
            <View style={{ flex: 1, alignItems: 'flex-start', minWidth: 0 }}>
              <MembersControl onLayout={(w) => setIfChanged('membersActualW', w)} />
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end', minWidth: 0 }}>
              <ActionsControl onLayout={(w) => setIfChanged('actionsActualW', w)} />
            </View>
          </View>
          {memberPasswordProtected ? (
            <View style={[styles.channelAdminRow, { marginTop: 8, flexWrap: 'wrap' }]}>
              <View style={{ marginRight: 10 }}>{visibilityControl}</View>
              {passwordControl ? <View style={{ marginLeft: 10 }}>{passwordControl}</View> : null}
            </View>
          ) : (
            <View style={[styles.channelAdminRow, { marginTop: 8 }]}>
              <View style={{ flex: 1, alignItems: 'flex-start', minWidth: 0 }}>
                {visibilityControl}
              </View>
              <View style={{ flex: 1 }} />
              <View style={{ flex: 1, alignItems: 'flex-end', minWidth: 0 }}>
                {passwordControl}
              </View>
            </View>
          )}
        </>
      ) : (
        <>
          <View style={[styles.channelAdminRow, { position: 'relative' }]}>
            <View style={{ flex: 1, alignItems: 'flex-start', minWidth: 0 }}>
              <MembersControl onLayout={(w) => setIfChanged('membersActualW', w)} />
            </View>

            {/* Overlay (slides left/right) */}
            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute',
                left: wideDecision.clusterLeft,
                top: 0,
                bottom: 0,
                justifyContent: 'center',
              }}
            >
              {wideDecision.mode === 'overlay_both' ? (
                <ClusterControl />
              ) : (
                <VisibilityOnlyControl />
              )}
            </View>

            <View style={{ flex: 1, alignItems: 'flex-end', minWidth: 0 }}>
              <ActionsControl onLayout={(w) => setIfChanged('actionsActualW', w)} />
            </View>
          </View>

          {/* If only Visibility fits up top, put Password on row 2. */}
          {wideDecision.mode === 'overlay_visibility_only' && passwordControl ? (
            <View style={[styles.channelAdminRow, { marginTop: 8 }]}>
              <View style={{ flex: 1 }} />
              <View style={{ flex: 1 }} />
              <View style={{ flex: 1, alignItems: 'flex-end', minWidth: 0 }}>
                {passwordControl}
              </View>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

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
  // Wide screens: merge Visibility + Password into the same row as channel options.
  // Small screens: keep the current two-row layout (less crowded, better wrapping).
  if (!compact) {
    return (
      <WideChannelSettingsPanel
        isDark={isDark}
        styles={styles}
        busy={busy}
        meIsAdmin={meIsAdmin}
        isPublic={isPublic}
        hasPassword={hasPassword}
        membersCountLabel={membersCountLabel}
        onOpenMembers={onOpenMembers}
        onOpenAbout={onOpenAbout}
        onOpenName={onOpenName}
        onLeave={onLeave}
        onTogglePublic={onTogglePublic}
        onPressPassword={onPressPassword}
      />
    );
  }

  return (
    <View style={[styles.channelAdminPanel, compact ? { rowGap: 8 } : null]}>
      {/* Row 1: Members + (About/Name/Leave) */}
      <View style={[styles.channelAdminRow, compact ? { flexWrap: 'wrap' } : null]}>
        <View style={[styles.dmSettingGroup, { flexGrow: 1 }]}>
          {!compact ? (
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
          ) : null}
          <Pressable
            style={[
              styles.toolBtn,
              isDark ? styles.toolBtnDark : null,
              busy ? { opacity: 0.6 } : null,
              // On compact screens, keep the Members chip slightly tighter to avoid
              // visual collisions in the header row.
              compact ? { paddingVertical: 4 } : null,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Members"
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
              {isPublic ? 'Public' : 'Private'}
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
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  flexShrink: 1,
                  minWidth: 0,
                }}
              >
                <Feather
                  name={hasPassword ? 'lock' : 'unlock'}
                  size={14}
                  color={isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary}
                />
                <Text
                  style={[
                    styles.toolBtnText,
                    isDark ? styles.toolBtnTextDark : null,
                    { flexShrink: 1, minWidth: 0 },
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {compact ? 'Password' : hasPassword ? 'Password: On' : 'Password: Off'}
                </Text>
              </View>
            </Pressable>
          </View>
        ) : !meIsAdmin && isPublic && hasPassword ? (
          <View style={styles.channelAdminActions}>
            <View style={[styles.toolBtn, isDark ? styles.toolBtnDark : null]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Feather
                  name="lock"
                  size={14}
                  color={isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary}
                />
                <Text style={[styles.toolBtnText, isDark ? styles.toolBtnTextDark : null]}>
                  Password Protected
                </Text>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}
