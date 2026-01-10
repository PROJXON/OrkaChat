import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { ChannelMembersSectionList } from '../../../components/ChannelMembersSectionList';

type Props = {
  visible: boolean;
  isDark: boolean;
  styles: Record<string, any>;
  members: any[];
  mySub: string;
  meIsAdmin: boolean;
  actionBusy: boolean;
  kickCooldownUntilBySub: Record<string, number>;
  avatarUrlByPath: Record<string, string>;
  onBan: (args: { memberSub: string; label: string }) => void | Promise<void>;
  onUnban: (memberSub: string) => void;
  onKick: (memberSub: string) => void;
  onToggleAdmin: (args: { memberSub: string; isAdmin: boolean }) => void;
  onClose: () => void;
};

export function ChannelMembersModal({
  visible,
  isDark,
  styles,
  members,
  mySub,
  meIsAdmin,
  actionBusy,
  kickCooldownUntilBySub,
  avatarUrlByPath,
  onBan,
  onUnban,
  onKick,
  onToggleAdmin,
  onClose,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.summaryModal, isDark ? styles.summaryModalDark : null]}>
          <Text style={[styles.summaryTitle, isDark ? styles.summaryTitleDark : null]}>Members</Text>
          <ScrollView style={{ maxHeight: 520, alignSelf: 'stretch' }}>
            <ChannelMembersSectionList
              members={members as any}
              mySub={mySub}
              isDark={isDark}
              styles={styles}
              meIsAdmin={meIsAdmin}
              actionBusy={actionBusy}
              kickCooldownUntilBySub={kickCooldownUntilBySub}
              avatarUrlByPath={avatarUrlByPath}
              onBan={onBan}
              onUnban={onUnban}
              onKick={onKick}
              onToggleAdmin={onToggleAdmin}
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
