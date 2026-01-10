import * as React from 'react';
import type { GroupMember, GroupMeta } from './useHydrateGroupRoster';
import type { TextInput } from 'react-native';

export function useChatGroupUiState() {
  // Group DM state (used for encryption + admin UI)
  const [groupMeta, setGroupMeta] = React.useState<GroupMeta | null>(null);
  const [groupMembers, setGroupMembers] = React.useState<GroupMember[]>([]);
  const [groupPublicKeyBySub, setGroupPublicKeyBySub] = React.useState<Record<string, string>>({});

  const [groupMembersOpen, setGroupMembersOpen] = React.useState<boolean>(false);
  const [groupRefreshNonce, setGroupRefreshNonce] = React.useState<number>(0);

  const [groupNameEditOpen, setGroupNameEditOpen] = React.useState<boolean>(false);
  const [groupNameDraft, setGroupNameDraft] = React.useState<string>('');
  const [groupAddMembersDraft, setGroupAddMembersDraft] = React.useState<string>('');
  const groupAddMembersInputRef = React.useRef<TextInput | null>(null);
  const [groupActionBusy, setGroupActionBusy] = React.useState<boolean>(false);

  return {
    groupMeta,
    setGroupMeta,
    groupMembers,
    setGroupMembers,
    groupPublicKeyBySub,
    setGroupPublicKeyBySub,
    groupMembersOpen,
    setGroupMembersOpen,
    groupRefreshNonce,
    setGroupRefreshNonce,
    groupNameEditOpen,
    setGroupNameEditOpen,
    groupNameDraft,
    setGroupNameDraft,
    groupAddMembersDraft,
    setGroupAddMembersDraft,
    groupAddMembersInputRef,
    groupActionBusy,
    setGroupActionBusy,
  };
}

