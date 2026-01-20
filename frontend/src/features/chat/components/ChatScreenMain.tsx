import React from 'react';
import type {
  FlatList,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import type { StyleProp, TextInput, ViewStyle } from 'react-native';
import {
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Text,
  View,
} from 'react-native';
import { useWindowDimensions } from 'react-native';

import type { PublicAvatarProfileLite } from '../../../hooks/usePublicAvatarProfiles';
import type { ChatScreenStyles } from '../../../screens/ChatScreen.styles';
import type { MediaItem } from '../../../types/media';
import { getNativeEventNumber } from '../../../utils/nativeEvent';
import type { PendingMediaItem } from '../attachments';
import type { ChatMessage } from '../types';
import { ChannelSettingsPanel } from './ChannelSettingsPanel';
import type { ResolvedChatBg } from './ChatBackgroundLayer';
import { ChatBackgroundLayer } from './ChatBackgroundLayer';
import { ChatComposer } from './ChatComposer';
import { ChatHeaderStatusRow } from './ChatHeaderStatusRow';
import { ChatHeaderTitleRow } from './ChatHeaderTitleRow';
import { ChatMessageList } from './ChatMessageList';
import { DmSettingsPanel } from './DmSettingsPanel';

type WebPinnedState = {
  ready: boolean;
  onLayout?: (e: LayoutChangeEvent) => void;
  onContentSizeChange?: (w: number, h: number) => void;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

type ChatScreenMainProps = {
  styles: ChatScreenStyles;
  isDark: boolean;
  isWideChatLayout: boolean;

  header: {
    headerTop?: React.ReactNode;
    headerTitle: string;
    onPressSummarize: () => void;
    onPressAiHelper: () => void;

    displayName: string;
    myUserId: string | null;
    avatarProfileBySub: Record<string, PublicAvatarProfileLite>;
    avatarUrlByPath: Record<string, string>;
    myAvatarOverride?: { bgColor?: string; textColor?: string; imagePath?: string } | null;
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

  body: { resolvedChatBg: ResolvedChatBg };

  list: {
    API_URL: string;
    isGroup: boolean;
    groupStatus?: string;
    visibleMessagesCount: number;
    messageListData: ChatMessage[];
    webPinned: WebPinnedState;
    listRef: React.RefObject<FlatList<ChatMessage> | null>;
    historyHasMore: boolean;
    historyLoading: boolean;
    loadOlderHistory: () => void | Promise<void>;
    renderItem: (args: { item: ChatMessage; index: number }) => React.ReactElement | null;
  };

  composer: {
    isDm: boolean;
    isGroup: boolean;
    isEncryptedChat: boolean;
    groupMeta: React.ComponentProps<typeof ChatComposer>['groupMeta'];
    inlineEditTargetId: string | null;
    inlineEditUploading: boolean;
    cancelInlineEdit: () => void;
    pendingMedia: PendingMediaItem[];
    setPendingMedia: (items: PendingMediaItem[]) => void;
    isUploading: boolean;
    replyTarget: React.ComponentProps<typeof ChatComposer>['replyTarget'];
    setReplyTarget: React.ComponentProps<typeof ChatComposer>['setReplyTarget'];
    messages: ChatMessage[];
    openViewer: (mediaList: MediaItem[], startIdx: number) => void;
    typingIndicatorText: string;
    TypingIndicator: React.ComponentProps<typeof ChatComposer>['TypingIndicator'];
    typingColor: string;
    mentionSuggestions: string[];
    insertMention: (v: string) => void;
    composerSafeAreaStyle: StyleProp<ViewStyle>;
    composerHorizontalInsetsStyle: StyleProp<ViewStyle>;
    composerBottomInsetBgHeight?: number;
    textInputRef: React.MutableRefObject<TextInput | null>;
    inputEpoch: number;
    input: string;
    onChangeInput: (v: string) => void;
    isTypingRef: React.MutableRefObject<boolean>;
    sendTyping: (isTyping: boolean) => void;
    sendMessage: () => void;
    handlePickMedia: () => void;
  };
};

export function ChatScreenMain({
  styles,
  isDark,
  isWideChatLayout,
  header,
  body,
  list,
  composer,
}: ChatScreenMainProps): React.JSX.Element {
  const { height: windowHeight } = useWindowDimensions();
  const [androidKeyboardVisible, setAndroidKeyboardVisible] = React.useState(false);
  const [androidKeyboardHeight, setAndroidKeyboardHeight] = React.useState<number>(0);
  const heightBeforeKeyboardRef = React.useRef<number>(windowHeight);
  const [androidWindowHeightDelta, setAndroidWindowHeightDelta] = React.useState<number>(0);

  React.useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subShow = Keyboard.addListener('keyboardDidShow', (e) => {
      setAndroidKeyboardVisible(true);
      const hRaw =
        e &&
        typeof e === 'object' &&
        typeof (e as { endCoordinates?: unknown }).endCoordinates === 'object'
          ? (e as { endCoordinates?: { height?: unknown } }).endCoordinates?.height
          : 0;
      const h = typeof hRaw === 'number' && Number.isFinite(hRaw) ? hRaw : Number(hRaw) || 0;
      setAndroidKeyboardHeight(h > 0 ? h : 0);
    });
    const subHide = Keyboard.addListener('keyboardDidHide', () => {
      setAndroidKeyboardVisible(false);
      setAndroidKeyboardHeight(0);
      setAndroidWindowHeightDelta(0);
    });
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  React.useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (!androidKeyboardVisible) {
      // Capture baseline height while keyboard is hidden.
      heightBeforeKeyboardRef.current = windowHeight;
      setAndroidWindowHeightDelta(0);
      return;
    }
    // Keyboard is visible: track how much the OS already shrank the window.
    // We'll subtract this from our own keyboard avoidance so we don't "double adjust".
    const before = heightBeforeKeyboardRef.current;
    const after = windowHeight;
    if (!(before > 0 && after > 0)) return;
    const delta = Math.max(0, before - after);
    // Wait for a stable non-trivial measurement.
    if (delta < 6) return;
    setAndroidWindowHeightDelta(delta);
  }, [androidKeyboardVisible, windowHeight]);

  // Android keyboard behavior varies:
  // - adjustResize: window shrinks by ~keyboard height (no extra lift needed)
  // - adjustPan / partial resize (emulators/IMEs): window shrinks a bit (need to lift the remainder)
  // Use the "remaining overlap" as an explicit composer lift so the input clears the whole keyboard,
  // including the suggestion/action bar.
  const androidKeyboardLift = React.useMemo(() => {
    if (Platform.OS !== 'android') return 0;
    if (!androidKeyboardVisible) return 0;
    const remaining = Math.max(0, androidKeyboardHeight - androidWindowHeightDelta);
    // Small buffer so we're never 1px under the IME chrome.
    return remaining > 0 ? remaining + 8 : 0;
  }, [androidKeyboardHeight, androidKeyboardVisible, androidWindowHeightDelta]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      // iOS: use padding to lift input above keyboard.
      // Android: edge-to-edge can prevent the window from resizing reliably in release builds,
      // so use a KeyboardAvoidingView fallback here as well.
      behavior={Platform.select({ ios: 'padding', android: 'height' })}
      // On Android we do an explicit composer lift (below) based on keyboard + window resize.
      // Keeping KAV enabled on Android can create double-adjust gaps depending on IME settings.
      enabled={Platform.OS === 'ios'}
    >
      <View style={[styles.header, isDark ? styles.headerDark : null]}>
        <View style={isWideChatLayout ? styles.chatContentColumn : null}>
          {header.headerTop ? <View style={styles.headerTopSlot}>{header.headerTop}</View> : null}
          <ChatHeaderTitleRow
            styles={styles}
            isDark={isDark}
            displayName={header.displayName}
            myUserId={header.myUserId}
            avatarProfileBySub={header.avatarProfileBySub}
            avatarUrlByPath={header.avatarUrlByPath}
            myAvatarOverride={header.myAvatarOverride}
            isConnecting={header.isConnecting}
            isConnected={header.isConnected}
            onPressSummarize={header.onPressSummarize}
            onPressAiHelper={header.onPressAiHelper}
          />
          <ChatHeaderStatusRow
            styles={styles}
            isDark={isDark}
            showCaret={!!(header.isEncryptedChat || header.isChannel)}
            caretExpanded={
              !!(header.isEncryptedChat ? header.dmSettingsOpen : header.channelSettingsOpen)
            }
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

          {header.error ? (
            <Text style={[styles.error, isDark ? styles.errorDark : null]}>{header.error}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.chatBody}>
        <ChatBackgroundLayer styles={styles} isDark={isDark} resolvedChatBg={body.resolvedChatBg} />

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
            messageListData={list.messageListData}
            webReady={list.webPinned.ready}
            webOnLayout={list.webPinned.onLayout}
            webOnContentSizeChange={list.webPinned.onContentSizeChange}
            webOnScrollSync={(e) => {
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
            composerBottomInsetBgHeight={composer.composerBottomInsetBgHeight}
            androidKeyboardLift={androidKeyboardLift}
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
