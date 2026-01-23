import type React from 'react';

import type { ChatScreenMain } from './components/ChatScreenMain';

type MainProps = React.ComponentProps<typeof ChatScreenMain>;
type HeaderProps = MainProps['header'];
type BodyProps = MainProps['body'];
type ListProps = MainProps['list'];
type ComposerProps = MainProps['composer'];
type SelectionProps = MainProps['selection'];

export function buildChatScreenMainProps(deps: {
  styles: MainProps['styles'];
  isDark: MainProps['isDark'];
  isWideChatLayout: MainProps['isWideChatLayout'];

  headerTop: HeaderProps['headerTop'];
  headerTitle: HeaderProps['headerTitle'];
  onPressSummarize: HeaderProps['onPressSummarize'];
  onPressAiHelper: HeaderProps['onPressAiHelper'];
  displayName: HeaderProps['displayName'];
  myUserId: HeaderProps['myUserId'];
  avatarProfileBySub: HeaderProps['avatarProfileBySub'];
  avatarUrlByPath: HeaderProps['avatarUrlByPath'];
  myAvatarOverride: HeaderProps['myAvatarOverride'];
  isConnecting: HeaderProps['isConnecting'];
  isConnected: HeaderProps['isConnected'];
  isEncryptedChat: HeaderProps['isEncryptedChat'];
  isChannel: HeaderProps['isChannel'];
  dmSettingsOpen: HeaderProps['dmSettingsOpen'];
  setDmSettingsOpen: HeaderProps['setDmSettingsOpen'];
  channelSettingsOpen: HeaderProps['channelSettingsOpen'];
  setChannelSettingsOpen: HeaderProps['setChannelSettingsOpen'];
  dmSettingsCompact: HeaderProps['dmSettingsCompact'];
  isDm: HeaderProps['isDm'];
  isGroup: HeaderProps['isGroup'];
  myPrivateKeyReady: HeaderProps['myPrivateKeyReady'];
  autoDecrypt: HeaderProps['autoDecrypt'];
  setAutoDecrypt: HeaderProps['setAutoDecrypt'];
  ttlLabel: HeaderProps['ttlLabel'];
  onOpenTtlPicker: HeaderProps['onOpenTtlPicker'];
  sendReadReceipts: HeaderProps['sendReadReceipts'];
  onToggleReadReceipts: HeaderProps['onToggleReadReceipts'];
  groupMembersCountLabel: HeaderProps['groupMembersCountLabel'];
  groupActionBusy: HeaderProps['groupActionBusy'];
  groupMeIsAdmin: HeaderProps['groupMeIsAdmin'];
  onOpenGroupMembers: HeaderProps['onOpenGroupMembers'];
  onOpenGroupName: HeaderProps['onOpenGroupName'];
  onLeaveGroup: HeaderProps['onLeaveGroup'];
  channelBusy: HeaderProps['channelBusy'];
  channelMeIsAdmin: HeaderProps['channelMeIsAdmin'];
  channelIsPublic: HeaderProps['channelIsPublic'];
  channelHasPassword: HeaderProps['channelHasPassword'];
  channelMembersCountLabel: HeaderProps['channelMembersCountLabel'];
  onOpenChannelMembers: HeaderProps['onOpenChannelMembers'];
  onOpenChannelAbout: HeaderProps['onOpenChannelAbout'];
  onOpenChannelName: HeaderProps['onOpenChannelName'];
  onLeaveChannel: HeaderProps['onLeaveChannel'];
  channelOnTogglePublic: HeaderProps['channelOnTogglePublic'];
  channelOnPressPassword: HeaderProps['channelOnPressPassword'];
  error: HeaderProps['error'];

  resolvedChatBg: BodyProps['resolvedChatBg'];

  apiUrl: ListProps['API_URL'];
  listIsGroup: ListProps['isGroup'];
  groupStatus: ListProps['groupStatus'];
  visibleMessagesCount: ListProps['visibleMessagesCount'];
  messageListData: ListProps['messageListData'];
  webPinned: ListProps['webPinned'];
  listRef: ListProps['listRef'];
  historyHasMore: ListProps['historyHasMore'];
  historyLoading: ListProps['historyLoading'];
  loadOlderHistory: ListProps['loadOlderHistory'];
  renderItem: ListProps['renderItem'];

  composerIsDm: ComposerProps['isDm'];
  composerIsGroup: ComposerProps['isGroup'];
  composerIsEncryptedChat: ComposerProps['isEncryptedChat'];
  composerGroupMeta: ComposerProps['groupMeta'];
  inlineEditTargetId: ComposerProps['inlineEditTargetId'];
  inlineEditUploading: ComposerProps['inlineEditUploading'];
  cancelInlineEdit: ComposerProps['cancelInlineEdit'];
  pendingMedia: ComposerProps['pendingMedia'];
  setPendingMedia: ComposerProps['setPendingMedia'];
  isUploading: ComposerProps['isUploading'];
  replyTarget: ComposerProps['replyTarget'];
  setReplyTarget: ComposerProps['setReplyTarget'];
  messages: ComposerProps['messages'];
  openViewer: ComposerProps['openViewer'];
  typingIndicatorText: ComposerProps['typingIndicatorText'];
  TypingIndicator: ComposerProps['TypingIndicator'];
  typingColor: ComposerProps['typingColor'];
  mentionSuggestions: ComposerProps['mentionSuggestions'];
  insertMention: ComposerProps['insertMention'];
  composerSafeAreaStyle: ComposerProps['composerSafeAreaStyle'];
  composerHorizontalInsetsStyle: ComposerProps['composerHorizontalInsetsStyle'];
  composerBottomInsetBgHeight: ComposerProps['composerBottomInsetBgHeight'];
  textInputRef: ComposerProps['textInputRef'];
  inputEpoch: ComposerProps['inputEpoch'];
  input: ComposerProps['input'];
  onChangeInput: ComposerProps['onChangeInput'];
  isTypingRef: ComposerProps['isTypingRef'];
  sendTyping: ComposerProps['sendTyping'];
  sendMessage: ComposerProps['sendMessage'];
  handlePickMedia: ComposerProps['handlePickMedia'];
  showAlert: ComposerProps['showAlert'];
  stopAudioPlayback: ComposerProps['stopAudioPlayback'];

  selectionActive: SelectionProps['active'];
  selectionCount: SelectionProps['count'];
  selectionCanCopy: SelectionProps['canCopy'];
  selectionCanDeleteForEveryone: SelectionProps['canDeleteForEveryone'];
  selectionOnCancel: SelectionProps['onCancel'];
  selectionOnCopy: SelectionProps['onCopy'];
  selectionOnDelete: SelectionProps['onDelete'];
  selectionOnDeleteForEveryone: SelectionProps['onDeleteForEveryone'];
}): MainProps {
  return {
    styles: deps.styles,
    isDark: deps.isDark,
    isWideChatLayout: deps.isWideChatLayout,
    header: {
      headerTop: deps.headerTop,
      headerTitle: deps.headerTitle,
      onPressSummarize: deps.onPressSummarize,
      onPressAiHelper: deps.onPressAiHelper,
      displayName: deps.displayName,
      myUserId: deps.myUserId,
      avatarProfileBySub: deps.avatarProfileBySub,
      avatarUrlByPath: deps.avatarUrlByPath,
      myAvatarOverride: deps.myAvatarOverride,
      isConnecting: deps.isConnecting,
      isConnected: deps.isConnected,
      isEncryptedChat: deps.isEncryptedChat,
      isChannel: deps.isChannel,
      dmSettingsOpen: deps.dmSettingsOpen,
      setDmSettingsOpen: deps.setDmSettingsOpen,
      channelSettingsOpen: deps.channelSettingsOpen,
      setChannelSettingsOpen: deps.setChannelSettingsOpen,
      dmSettingsCompact: deps.dmSettingsCompact,
      isDm: deps.isDm,
      isGroup: deps.isGroup,
      myPrivateKeyReady: deps.myPrivateKeyReady,
      autoDecrypt: deps.autoDecrypt,
      setAutoDecrypt: deps.setAutoDecrypt,
      ttlLabel: deps.ttlLabel,
      onOpenTtlPicker: deps.onOpenTtlPicker,
      sendReadReceipts: deps.sendReadReceipts,
      onToggleReadReceipts: deps.onToggleReadReceipts,
      groupMembersCountLabel: deps.groupMembersCountLabel,
      groupActionBusy: deps.groupActionBusy,
      groupMeIsAdmin: deps.groupMeIsAdmin,
      onOpenGroupMembers: deps.onOpenGroupMembers,
      onOpenGroupName: deps.onOpenGroupName,
      onLeaveGroup: deps.onLeaveGroup,
      channelBusy: deps.channelBusy,
      channelMeIsAdmin: deps.channelMeIsAdmin,
      channelIsPublic: deps.channelIsPublic,
      channelHasPassword: deps.channelHasPassword,
      channelMembersCountLabel: deps.channelMembersCountLabel,
      onOpenChannelMembers: deps.onOpenChannelMembers,
      onOpenChannelAbout: deps.onOpenChannelAbout,
      onOpenChannelName: deps.onOpenChannelName,
      onLeaveChannel: deps.onLeaveChannel,
      channelOnTogglePublic: deps.channelOnTogglePublic,
      channelOnPressPassword: deps.channelOnPressPassword,
      error: deps.error,
    },
    body: { resolvedChatBg: deps.resolvedChatBg },
    list: {
      API_URL: deps.apiUrl,
      isGroup: deps.listIsGroup,
      groupStatus: deps.groupStatus,
      visibleMessagesCount: deps.visibleMessagesCount,
      messageListData: deps.messageListData,
      webPinned: deps.webPinned,
      listRef: deps.listRef,
      historyHasMore: deps.historyHasMore,
      historyLoading: deps.historyLoading,
      loadOlderHistory: deps.loadOlderHistory,
      renderItem: deps.renderItem,
    },
    composer: {
      isDm: deps.composerIsDm,
      isGroup: deps.composerIsGroup,
      isEncryptedChat: deps.composerIsEncryptedChat,
      groupMeta: deps.composerGroupMeta,
      inlineEditTargetId: deps.inlineEditTargetId,
      inlineEditUploading: deps.inlineEditUploading,
      cancelInlineEdit: deps.cancelInlineEdit,
      pendingMedia: deps.pendingMedia,
      setPendingMedia: deps.setPendingMedia,
      isUploading: deps.isUploading,
      replyTarget: deps.replyTarget,
      setReplyTarget: deps.setReplyTarget,
      messages: deps.messages,
      openViewer: deps.openViewer,
      typingIndicatorText: deps.typingIndicatorText,
      TypingIndicator: deps.TypingIndicator,
      typingColor: deps.typingColor,
      mentionSuggestions: deps.mentionSuggestions,
      insertMention: deps.insertMention,
      composerSafeAreaStyle: deps.composerSafeAreaStyle,
      composerHorizontalInsetsStyle: deps.composerHorizontalInsetsStyle,
      composerBottomInsetBgHeight: deps.composerBottomInsetBgHeight,
      textInputRef: deps.textInputRef,
      inputEpoch: deps.inputEpoch,
      input: deps.input,
      onChangeInput: deps.onChangeInput,
      isTypingRef: deps.isTypingRef,
      sendTyping: deps.sendTyping,
      sendMessage: deps.sendMessage,
      handlePickMedia: deps.handlePickMedia,
      showAlert: deps.showAlert,
      stopAudioPlayback: deps.stopAudioPlayback,
    },
    selection: {
      active: deps.selectionActive,
      count: deps.selectionCount,
      canCopy: deps.selectionCanCopy,
      canDeleteForEveryone: deps.selectionCanDeleteForEveryone,
      onCancel: deps.selectionOnCancel,
      onCopy: deps.selectionOnCopy,
      onDelete: deps.selectionOnDelete,
      onDeleteForEveryone: deps.selectionOnDeleteForEveryone,
    },
  };
}
