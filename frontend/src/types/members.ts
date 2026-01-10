export type MemberStatus = 'active' | 'banned' | 'left';

// Shared member row model used by ChannelMembersSectionList/GroupMembersSectionList.
export type MemberRow = {
  memberSub: string;
  displayName?: string;
  isAdmin?: boolean;
  status?: MemberStatus;
  avatarBgColor?: string;
  avatarTextColor?: string;
  avatarImagePath?: string;
};
