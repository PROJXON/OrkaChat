import React from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { GroupMembersSectionList } from '../../../components/GroupMembersSectionList';
import type { ChatScreenStyles } from '../../../screens/ChatScreen.styles';
import type { MemberRow } from '../../../types/members';
import { APP_COLORS, PALETTE } from '../../../theme/colors';

type Props = {
  visible: boolean;
  isDark: boolean;
  styles: ChatScreenStyles;
  busy: boolean;

  meIsAdmin: boolean;
  addMembersDraft: string;
  onChangeAddMembersDraft: (t: string) => void;
  onAddMembers: () => void | Promise<void>;
  addMembersInputRef: React.MutableRefObject<TextInput | null>;

  members: MemberRow[];
  mySub: string;
  kickCooldownUntilBySub: Record<string, number>;
  avatarUrlByPath: Record<string, string>;

  onKick: (memberSub: string) => void;
  onUnban: (memberSub: string) => void;
  onToggleAdmin: (args: { memberSub: string; isAdmin: boolean }) => void;
  onBan: (args: { memberSub: string; label: string }) => void | Promise<void>;

  onClose: () => void;
};

export function GroupMembersModal({
  visible,
  isDark,
  styles,
  busy,
  meIsAdmin,
  addMembersDraft,
  onChangeAddMembersDraft,
  onAddMembers,
  addMembersInputRef,
  members,
  mySub,
  kickCooldownUntilBySub,
  avatarUrlByPath,
  onKick,
  onUnban,
  onToggleAdmin,
  onBan,
  onClose,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.summaryModal, isDark ? styles.summaryModalDark : null]}>
          <Text style={[styles.summaryTitle, isDark ? styles.summaryTitleDark : null]}>Members</Text>

          {meIsAdmin ? (
            <View style={{ marginTop: 10 }}>
              <TextInput
                ref={(r) => {
                  addMembersInputRef.current = r;
                }}
                value={addMembersDraft}
                onChangeText={onChangeAddMembersDraft}
                placeholder="Add usernames (comma/space separated)"
                placeholderTextColor={isDark ? PALETTE.slate400 : PALETTE.slate350}
                selectionColor={isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary}
                cursorColor={isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary}
                // Use a fully explicit style here (avoid theme/style collisions in Android modals).
                style={{
                  width: '100%',
                  height: 48,
                  paddingHorizontal: 12,
                  borderWidth: 1,
                  borderRadius: 10,
                  // Off-color (so it stands out from the modal background).
                  backgroundColor: isDark ? APP_COLORS.dark.bg.header : APP_COLORS.light.bg.surface2,
                  borderColor: isDark ? APP_COLORS.dark.border.default : APP_COLORS.light.border.subtle,
                  color: isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary,
                  fontSize: 16,
                }}
                // Keep focusable even while requests are running; only the Add button is disabled.
                editable
                returnKeyType="done"
              />
              <View style={[styles.summaryButtons, { justifyContent: 'flex-end' }]}>
                <Pressable
                  style={[styles.toolBtn, isDark ? styles.toolBtnDark : null, busy ? { opacity: 0.6 } : null]}
                  disabled={busy}
                  onPress={() => void Promise.resolve(onAddMembers())}
                >
                  <Text style={[styles.toolBtnText, isDark ? styles.toolBtnTextDark : null]}>Add</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <ScrollView
            style={{ marginTop: 0, maxHeight: 360 }}
            contentContainerStyle={{ paddingTop: 0 }}
            keyboardShouldPersistTaps="handled"
          >
            <GroupMembersSectionList
              members={members}
              mySub={mySub}
              isDark={!!isDark}
              styles={styles}
              meIsAdmin={!!meIsAdmin}
              groupActionBusy={!!busy}
              kickCooldownUntilBySub={kickCooldownUntilBySub}
              avatarUrlByPath={avatarUrlByPath}
              onKick={onKick}
              onUnban={onUnban}
              onToggleAdmin={onToggleAdmin}
              onBan={onBan}
            />
          </ScrollView>

          <View style={styles.summaryButtons}>
            <Pressable style={[styles.toolBtn, isDark ? styles.toolBtnDark : null]} onPress={onClose}>
              <Text style={[styles.toolBtnText, isDark ? styles.toolBtnTextDark : null]}>Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
