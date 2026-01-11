import React from 'react';
import { KeyboardAvoidingView, LayoutAnimation, Platform, Text, View } from 'react-native';

import { getNativeEventNumber } from '../../../utils/nativeEvent';
import { ChannelSettingsPanel } from './ChannelSettingsPanel';
import { ChatBackgroundLayer } from './ChatBackgroundLayer';
import { ChatComposer } from './ChatComposer';
import { ChatHeaderStatusRow } from './ChatHeaderStatusRow';
import { ChatHeaderTitleRow } from './ChatHeaderTitleRow';
import { ChatMessageList } from './ChatMessageList';
import { DmSettingsPanel } from './DmSettingsPanel';

type ChatScreenMainProps = {
  styles: any;
  isDark: boolean;
  isWideChatLayout: boolean;

  header: {
    headerTop?: React.ReactNode;
    headerTitle: string;
    onPressSummarize: () => void;
    onPressAiHelper: () => void;

    displayName: string;
    myUserId: string | null;
    avatarProfileBySub: Record<string, any>;
    avatarUrlByPath: Record<string, string>;
    isConnecting: boolean;
    isConnected: boolean;

    isEncryptedChat: boolean;
    isChannel: boolean;

    dmSettingsOpen: boolean;
    setDmSettingsOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
    channelSettingsOpen: boolean;
    setChannelSettingsOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
    dmSettingsCompact: boolean;

    // DM settings panel
    isDm: boolean;
    isGroup: boolean;
    myPrivateKeyReady: boolean;
    autoDecrypt: boolean;
    setAutoDecrypt: (v: boolean) => void;
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

    // Channel settings panel
    channelBusy: boolean;
    channelMeIsAdmin: boolean;
    channelIsPublic: boolean;
    channelHasPassword: boolean;
    channelMembersCountLabel: string;
    onOpenChannelMembers: () => void;
    onOpenChannelAbout: () => void;
    onOpenChannelName: () => void;
    onLeaveChannel: () => void;
    channelOnTogglePublic: (next: boolean) => void;
    channelOnPressPassword: () => void;

    error: string | null;
  };

  body: { resolvedChatBg: any };

  list: {
    API_URL: string;
    isGroup: boolean;
    groupStatus: any;
    visibleMessagesCount: number;
    messageListData: any[];
    webPinned: any;
    listRef: React.RefObject<any>;
    historyHasMore: boolean;
    historyLoading: boolean;
    loadOlderHistory: () => void | Promise<void>;
    renderItem: (args: { item: any; index: number }) => React.ReactElement | null;
  };

  composer: {
    isDm: boolean;
    isGroup: boolean;
    isEncryptedChat: boolean;
    groupMeta: any;
    inlineEditTargetId: string | null;
    inlineEditUploading: boolean;
    cancelInlineEdit: () => void;
    pendingMedia: any[];
    setPendingMedia: (items: any[]) => void;
    isUploading: boolean;
    replyTarget: any;
    setReplyTarget: (v: any) => void;
    messages: any[];
    openViewer: (...args: any[]) => void;
    typingIndicatorText: string;
    TypingIndicator: any;
    typingColor: string;
    mentionSuggestions: any[];
    insertMention: (v: any) => void;
    composerSafeAreaStyle: any;
    composerHorizontalInsetsStyle: any;
    textInputRef: any;
    inputEpoch: number;
    input: string;
    onChangeInput: (v: string) => void;
    isTypingRef: any;
    sendTyping: (...args: any[]) => void;
    sendMessage: (...args: any[]) => void;
    handlePickMedia: (...args: any[]) => void;
  };
};

export function ChatScreenMain({ styles, isDark, isWideChatLayout, header, body, list, composer }: ChatScreenMainProps): React.JSX.Element {
  return (
    <KeyboardAvoidingView
      style={styles.container}
      // iOS: use padding to lift input above keyboard.
      // Android: rely on `softwareKeyboardLayoutMode: "resize"` (app.json) so the window resizes like Signal.
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <View style={[styles.header, isDark ? styles.headerDark : null]}>
        <View style={isWideChatLayout ? styles.chatContentColumn : null}>
          {header.headerTop ? <View style={styles.headerTopSlot}>{header.headerTop}</View> : null}
          <ChatHeaderTitleRow
            styles={styles}
            isDark={isDark}
            title={header.headerTitle}
            onPressSummarize={header.onPressSummarize}
            onPressAiHelper={header.onPressAiHelper}
          />
          <ChatHeaderStatusRow
            styles={styles}
            isDark={isDark}
            displayName={header.displayName}
            myUserId={header.myUserId}
            avatarProfileBySub={header.avatarProfileBySub}
            avatarUrlByPath={header.avatarUrlByPath}
            isConnecting={header.isConnecting}
            isConnected={header.isConnected}
            showCaret={!!(header.isEncryptedChat || header.isChannel)}
            caretExpanded={!!(header.isEncryptedChat ? header.dmSettingsOpen : header.channelSettingsOpen)}
            caretA11yLabel={
              header.isEncryptedChat
                ? header.dmSettingsOpen
                  ? 'Hide message options'
                  : 'Show message options'
                : header.channelSettingsOpen
                  ? 'Hide channel options'
                  : 'Show channel options'
            }
            onPressCaret={() => {
              try {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              } catch {
                // ignore
              }
              if (header.isEncryptedChat) header.setDmSettingsOpen((v) => !v);
              else header.setChannelSettingsOpen((v) => !v);
            }}
          />

          {header.isEncryptedChat ? (
            header.dmSettingsOpen ? (
              <DmSettingsPanel
                isDark={isDark}
                styles={styles}
                compact={!!header.dmSettingsCompact}
                isDm={header.isDm}
                isGroup={header.isGroup}
                myPrivateKeyReady={header.myPrivateKeyReady}
                autoDecrypt={header.autoDecrypt}
                onToggleAutoDecrypt={header.setAutoDecrypt}
                ttlLabel={header.ttlLabel}
                onOpenTtlPicker={header.onOpenTtlPicker}
                sendReadReceipts={header.sendReadReceipts}
                onToggleReadReceipts={(v) => header.onToggleReadReceipts(!!v)}
                groupMembersCountLabel={header.groupMembersCountLabel}
                groupActionBusy={!!header.groupActionBusy}
                groupMeIsAdmin={!!header.groupMeIsAdmin}
                onOpenGroupMembers={header.onOpenGroupMembers}
                onOpenGroupName={header.onOpenGroupName}
                onLeaveGroup={header.onLeaveGroup}
              />
            ) : null
          ) : header.isChannel ? (
            header.channelSettingsOpen ? (
              <ChannelSettingsPanel
                isDark={isDark}
                styles={styles}
                compact={!!header.dmSettingsCompact}
                busy={!!header.channelBusy}
                meIsAdmin={!!header.channelMeIsAdmin}
                isPublic={!!header.channelIsPublic}
                hasPassword={!!header.channelHasPassword}
                membersCountLabel={header.channelMembersCountLabel}
                onOpenMembers={header.onOpenChannelMembers}
                onOpenAbout={header.onOpenChannelAbout}
                onOpenName={header.onOpenChannelName}
                onLeave={header.onLeaveChannel}
                onTogglePublic={header.channelOnTogglePublic}
                onPressPassword={header.channelOnPressPassword}
              />
            ) : null
          ) : null}

          {header.error ? <Text style={[styles.error, isDark ? styles.errorDark : null]}>{header.error}</Text> : null}
        </View>
      </View>

      <View style={styles.chatBody}>
        <ChatBackgroundLayer styles={styles} isDark={isDark} resolvedChatBg={body.resolvedChatBg as any} />

        {/* Keep the scroll container full-width so the web scrollbar stays at the window edge.
            Center the *content* via FlatList.contentContainerStyle instead. */}
        <View style={styles.chatBodyInner}>
          <ChatMessageList
            styles={styles}
            isDark={isDark}
            isWideChatLayout={isWideChatLayout}
            API_URL={list.API_URL}
            isGroup={list.isGroup}
            groupStatus={list.groupStatus}
            visibleMessagesCount={list.visibleMessagesCount}
            messageListData={list.messageListData as any}
            webReady={list.webPinned.ready}
            webOnLayout={list.webPinned.onLayout}
            webOnContentSizeChange={list.webPinned.onContentSizeChange}
            webOnScrollSync={(e: unknown) => {
              if (list.webPinned.onScroll) list.webPinned.onScroll(e);
              if (!list.API_URL) return;
              if (!list.historyHasMore) return;
              if (list.historyLoading) return;
              const y = getNativeEventNumber(e, ['nativeEvent', 'contentOffset', 'y']);
              if (y <= 40) list.loadOlderHistory();
            }}
            listRef={list.listRef}
            historyHasMore={list.historyHasMore}
            historyLoading={list.historyLoading}
            loadOlderHistory={list.loadOlderHistory}
            renderItem={list.renderItem}
          />

          <ChatComposer
            styles={styles}
            isDark={isDark}
            isDm={composer.isDm}
            isGroup={composer.isGroup}
            isEncryptedChat={composer.isEncryptedChat}
            groupMeta={composer.groupMeta}
            inlineEditTargetId={composer.inlineEditTargetId}
            inlineEditUploading={composer.inlineEditUploading}
            cancelInlineEdit={composer.cancelInlineEdit}
            pendingMedia={composer.pendingMedia}
            setPendingMedia={composer.setPendingMedia}
            isUploading={composer.isUploading}
            replyTarget={composer.replyTarget}
            setReplyTarget={composer.setReplyTarget}
            messages={composer.messages}
            openViewer={composer.openViewer}
            typingIndicatorText={composer.typingIndicatorText}
            TypingIndicator={composer.TypingIndicator}
            typingColor={composer.typingColor}
            mentionSuggestions={composer.mentionSuggestions}
            insertMention={composer.insertMention}
            composerSafeAreaStyle={composer.composerSafeAreaStyle}
            composerHorizontalInsetsStyle={composer.composerHorizontalInsetsStyle}
            isWideChatLayout={isWideChatLayout}
            textInputRef={composer.textInputRef}
            inputEpoch={composer.inputEpoch}
            input={composer.input}
            onChangeInput={composer.onChangeInput}
            isTypingRef={composer.isTypingRef}
            sendTyping={composer.sendTyping}
            sendMessage={composer.sendMessage}
            handlePickMedia={composer.handlePickMedia}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

