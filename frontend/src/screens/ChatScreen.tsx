import React from 'react';
import {
  AppState,
  AppStateStatus,
  useWindowDimensions,
  Platform,
  TextInput,
} from 'react-native';
import { styles } from './ChatScreen.styles';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WS_URL, API_URL, CDN_URL } from '../config/env';
import { useAuthenticator } from '@aws-amplify/ui-react-native/dist';
import { useCdnUrlCache } from '../hooks/useCdnUrlCache';
import { useMessageActionMenu } from '../features/chat/useMessageActionMenu';
import { ChatScreenMain } from '../features/chat/components/ChatScreenMain';
import { fetchAuthSession } from '@aws-amplify/auth';
import {
  aesGcmDecryptBytes,
  decryptChatMessageV1,
  deriveChatKeyBytesV1,
  encryptChatMessageV1,
} from '../utils/crypto';
import { getRandomBytes } from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { fromByteArray } from 'base64-js';
import { hexToBytes } from '@noble/hashes/utils.js';
import { gcm } from '@noble/ciphers/aes.js';
import { getDmMediaSignedUrl } from '../utils/dmSignedUrl';
import type { MemberRow } from '../types/members';
import type {
  ChatMessage,
} from '../features/chat/types';
import {
  normalizeDmMediaItems,
  normalizeGroupMediaItems,
  normalizeReactions,
  parseChatEnvelope,
  parseDmMediaEnvelope,
  parseGroupMediaEnvelope,
} from '../features/chat/parsers';
import { MAX_ATTACHMENTS_PER_MESSAGE } from '../features/chat/uploads';
import {
  pendingMediaFromDocumentPickerAssets,
  pendingMediaFromImagePickerAssets,
  pendingMediaFromInAppCameraCapture,
} from '../features/chat/attachments';
import { useChatAttachments } from '../features/chat/useChatAttachments';
import { useDisplayNameBySub } from '../features/chat/useDisplayNameBySub';
import { useUiPromptHelpers } from '../hooks/useUiPromptHelpers';
import { renderChatListItem } from '../features/chat/renderChatListItem';
import { getChatHeaderTitle } from '../utils/conversationTitles';
import { useConfirmLinkModal } from '../hooks/useConfirmLinkModal';
import { useViewportWidth } from '../hooks/useViewportWidth';
import { usePublicAvatarProfiles } from '../hooks/usePublicAvatarProfiles';
import { markChannelAboutSeen } from '../utils/channelAboutSeen';
import { getPreviewKind } from '../utils/mediaKinds';
import { useAiHelper } from '../features/chat/useAiHelper';
import { useAiSummary } from '../features/chat/useAiSummary';
import { useAiDmConsentGate } from '../features/chat/useAiDmConsent';
import { useChatSendActions } from '../features/chat/useChatSendActions';
import { useChatInlineEditActions } from '../features/chat/useChatInlineEditActions';
import { useChatReplyActions } from '../features/chat/useChatReplyActions';
import { useChatMessageOps } from '../features/chat/useChatMessageOps';
import { useChatKickActions } from '../features/chat/useChatKickActions';
import { useGroupMembersModalActions } from '../features/chat/useGroupMembersModalActions';
import { useChannelMembersModalActions } from '../features/chat/useChannelMembersModalActions';
import { useChannelSettingsPanelActions } from '../features/chat/useChannelSettingsPanelActions';
import { useGroupNameModalActions } from '../features/chat/useGroupNameModalActions';
import { useChannelAboutModalActions } from '../features/chat/useChannelAboutModalActions';
import { useChannelNameModalActions } from '../features/chat/useChannelNameModalActions';
import { useChannelPasswordModalActions } from '../features/chat/useChannelPasswordModalActions';
import { useChatPressToDecrypt } from '../features/chat/useChatPressToDecrypt';
import { MORE_REACTIONS, QUICK_REACTIONS } from '../features/chat/reactionEmojis';
import { getSeenLabelForCreatedAt } from '../utils/seenLabels';
import { sortReactionSubs } from '../features/chat/reactionsUi';
import { isVisibleMemberRow, toMemberRow } from '../features/chat/memberRows';

import { usePersistedNumberMinMap } from '../hooks/usePersistedNumberMinMap';
import { usePersistedBool } from '../hooks/usePersistedBool';
import { useTtlNowSec } from '../hooks/useTtlNowSec';
import { formatRemaining } from '../utils/formatRemaining';
import { usePruneExpiredMessages } from '../hooks/usePruneExpiredMessages';
import { useHiddenMessageIds } from '../hooks/useHiddenMessageIds';
import { useChannelHeaderCache } from '../hooks/useChannelHeaderCache';
import { normalizeUser } from '../utils/normalizeUser';
import { useChatDecryptors } from '../features/chat/useChatDecryptors';
import { useChatMediaDecryptCache } from '../features/chat/useChatMediaDecryptCache';
import { usePrefetchDmDecryptedThumbs, usePrefetchGroupDecryptedThumbs } from '../features/chat/usePrefetchDecryptedThumbs';
import { useLazyDecryptDmViewerPages, useLazyDecryptGroupViewerPages } from '../features/chat/useLazyDecryptViewerPages';
import { useChatMyKeys } from '../features/chat/useChatMyKeys';
import { useHydratePeerPublicKey } from '../features/chat/usePeerPublicKey';
import { useHydrateGroupRoster } from '../features/chat/useHydrateGroupRoster';
import { useGroupReadOnlyRefreshTicker, useRefreshGroupRosterOnMembersModalOpen } from '../features/chat/useGroupRefreshTriggers';
import { timestampId } from '../utils/ids';
// (history fetching extracted to useChatHistory)
import {
  encryptGroupOutgoingEncryptedText,
  prepareDmOutgoingEncryptedText,
  prepareGroupMediaPlaintext,
} from '../features/chat/prepareOutgoingEncryptedText';
import { applyOptimisticSendForTextOnly } from '../features/chat/applyOptimisticSend';
import { useChatWsMessageHandler } from '../features/chat/useChatWsMessageHandler';
import { useChatHistory } from '../features/chat/useChatHistory';
import { useChatWsConnection } from '../features/chat/useChatWsConnection';
import { useChatTyping } from '../features/chat/useChatTyping';
import { useChatAdminOps } from '../features/chat/useChatAdminOps';
import { useChannelRoster } from '../features/chat/useChannelRoster';
import { useMentions } from '../features/chat/useMentions';
import { useChatReport } from '../features/chat/useChatReport';
import { useReactionInfo } from '../hooks/useReactionInfo';
import { useMediaViewer } from '../hooks/useMediaViewer';
import type { ChatMediaViewerState } from '../features/chat/viewerTypes';
import { useToast } from '../hooks/useToast';
import { useOpenGlobalViewer } from '../hooks/useOpenGlobalViewer';
import { useChatEncryptedMediaViewer } from '../features/chat/useChatEncryptedMediaViewer';
import { useChatImageAspectPrefetch } from '../features/chat/useChatImageAspectPrefetch';
import { useChatCdnMediaPrefetch } from '../features/chat/useChatCdnMediaPrefetch';
import { TypingIndicator } from '../features/chat/components/TypingIndicator';
import { calcCappedMediaSize } from '../utils/mediaSizing';
import { useRecoverPendingImagePicker } from '../features/chat/useRecoverPendingImagePicker';
import { useLatestOutgoingMessageId } from '../features/chat/useLatestOutgoingMessageId';
import { useChatAttachmentPickers } from '../features/chat/useChatAttachmentPickers';
import { useStorageSessionReady } from '../hooks/useStorageSessionReady';
import { useHydrateDmReads } from '../features/chat/useHydrateDmReads';
import { useChatReadReceipts } from '../features/chat/useChatReadReceipts';
import { useChatAutoDecrypt } from '../features/chat/useChatAutoDecrypt';
import { ChatScreenOverlays } from '../features/chat/components/ChatScreenOverlays';
import { useChatInfoModal } from '../features/chat/useChatInfoModal';
import { useChatTtlPickerState } from '../features/chat/useChatTtlPickerState';
import { useChatChannelUiState } from '../features/chat/useChatChannelUiState';
import { useChatGroupUiState } from '../features/chat/useChatGroupUiState';
import { useChatCipherState } from '../features/chat/useChatCipherState';
import { useChatMessageListState } from '../features/chat/useChatMessageListState';
import { useChatConversationJoin } from '../features/chat/useChatConversationJoin';
import { useChatComposerInput } from '../features/chat/useChatComposerInput';
import { useChatCopyToClipboard } from '../features/chat/useChatCopyToClipboard';
import { usePushGroupTitleToParent } from '../features/chat/usePushGroupTitleToParent';
import { useFocusGroupAddMembersInputOnOpen } from '../features/chat/useFocusGroupAddMembersInputOnOpen';
import { useChatScreenRefSync } from '../features/chat/useChatScreenRefSync';
import type { ResolvedChatBg } from '../features/chat/components/ChatBackgroundLayer';
import { useGroupMembersUi } from '../features/chat/useGroupMembersUi';
import { useChatUploadHandlers } from '../features/chat/useChatUploadHandlers';
import { buildChatScreenMainProps } from '../features/chat/buildChatScreenMainProps';
import { buildChatScreenOverlaysProps } from '../features/chat/buildChatScreenOverlaysProps';

type ChatScreenProps = {
  conversationId?: string | null;
  peer?: string | null;
  displayName: string;
  onNewDmNotification?: (conversationId: string, user: string, userSub?: string) => void;
  onKickedFromConversation?: (conversationId: string) => void;
  // Notify the parent (Chats list) that the current conversation's title changed.
  onConversationTitleChanged?: (conversationId: string, title: string) => void;
  // App-level Settings dropdown can request opening the current channel's About modal (view-only).
  channelAboutRequestEpoch?: number;
  headerTop?: React.ReactNode;
  theme?: 'light' | 'dark';
  chatBackground?: {
    mode: 'default' | 'color' | 'image';
    color?: string;
    uri?: string;
    blur?: number;
    opacity?: number;
  };
  blockedUserSubs?: string[];
  // Bump this when keys are generated/recovered/reset so ChatScreen reloads them from storage.
  keyEpoch?: number;
  onBlockUserSub?: (blockedSub: string, label?: string) => void | Promise<void>;
};

const ENCRYPTED_PLACEHOLDER = 'Encrypted message (tap to decrypt)';

const EMPTY_URI_BY_PATH: Record<string, string> = {};
const HISTORY_PAGE_SIZE = 50;
const CHAT_MEDIA_MAX_HEIGHT = 240; // dp
const CHAT_MEDIA_MAX_WIDTH_FRACTION = 0.86; // fraction of screen width (roughly bubble width)

export default function ChatScreen({
  conversationId,
  peer,
  displayName,
  onNewDmNotification,
  onKickedFromConversation,
  onConversationTitleChanged,
  channelAboutRequestEpoch,
  headerTop,
  theme = 'light',
  chatBackground,
  blockedUserSubs = [],
  keyEpoch,
  onBlockUserSub,
}: ChatScreenProps): React.JSX.Element {
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();
  const { user } = useAuthenticator();
  const { width: windowWidth } = useWindowDimensions();
  const { isWide: isWideChatLayout, viewportWidth: chatViewportWidth } = useViewportWidth(windowWidth, {
    wideBreakpointPx: 900,
    maxContentWidthPx: 1040,
  });
  const composerSafeAreaStyle = React.useMemo(() => ({ paddingBottom: insets.bottom }), [insets.bottom]);
  const composerHorizontalInsetsStyle = React.useMemo(
    () => ({ paddingLeft: 12 + insets.left, paddingRight: 12 + insets.right }),
    [insets.left, insets.right],
  );
  const dmSettingsCompact = windowWidth < 420;
  const [dmSettingsOpen, setDmSettingsOpen] = React.useState<boolean>(true);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const blockedSubsSet = React.useMemo(() => new Set((blockedUserSubs || []).filter(Boolean)), [blockedUserSubs]);
  const { visibleMessages, messageListData, webPinned } = useChatMessageListState({ messages, blockedSubsSet });
  const AVATAR_SIZE = 44;
  const AVATAR_GAP = 8;
  const AVATAR_GUTTER = AVATAR_SIZE + AVATAR_GAP;
  const [input, setInput] = React.useState<string>('');
  const inputRef = React.useRef<string>('');
  const textInputRef = React.useRef<TextInput | null>(null);
  const [inputEpoch, setInputEpoch] = React.useState<number>(0);
  const [replyTarget, setReplyTarget] = React.useState<null | {
    id: string;
    createdAt: number;
    user?: string;
    userSub?: string;
    preview: string;
    mediaKind?: 'image' | 'video' | 'file';
    mediaCount?: number;
    mediaThumbUri?: string | null;
  }>(null);
  const sendTimeoutRef = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [typingByUserExpiresAt, setTypingByUserExpiresAt] = React.useState<Record<string, number>>({}); // user -> expiresAtMs
  const [error, setError] = React.useState<string | null>(null);
  const appStateRef = React.useRef<AppStateStatus>(AppState.currentState);
  const activeConversationIdRef = React.useRef<string>('global');
  const displayNameRef = React.useRef<string>('');
  const myPublicKeyRef = React.useRef<string | null>(null);
  const onNewDmNotificationRef = React.useRef<typeof onNewDmNotification | undefined>(undefined);
  const onKickedFromConversationRef = React.useRef<typeof onKickedFromConversation | undefined>(undefined);
  const pendingJoinConversationIdRef = React.useRef<string | null>(null);
  const { myUserId, myPrivateKey, myPublicKey } = useChatMyKeys({ user, keyEpoch });
  const [peerPublicKey, setPeerPublicKey] = React.useState<string | null>(null);
  const { parseEncrypted, parseGroupEncrypted, decryptGroupForDisplay, decryptForDisplay, buildDmMediaKey } = useChatDecryptors({
    myPrivateKey,
    myPublicKey,
    peerPublicKey,
    myUserId,
    decryptChatMessageV1,
    aesGcmDecryptBytes,
    deriveChatKeyBytesV1,
    hexToBytes,
  });
  const groupUi = useChatGroupUiState();
  const {
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
  } = groupUi;
  const { groupMembersVisible, groupMembersActiveCount, computeDefaultGroupTitleForMe } = useGroupMembersUi({
    groupMembers,
    myUserId,
  });
  const [autoDecrypt, setAutoDecrypt] = React.useState<boolean>(false);
  const { cipherOpen, setCipherOpen, cipherText, setCipherText } = useChatCipherState();
  const { nameBySub, ensureNames: ensureNameBySub } = useDisplayNameBySub(API_URL);
  const [reactionPickerOpen, setReactionPickerOpen] = React.useState<boolean>(false);
  const [reactionPickerTarget, setReactionPickerTarget] = React.useState<ChatMessage | null>(null);
  const messageActionMenu = useMessageActionMenu<ChatMessage>();
  const messageActionTarget = messageActionMenu.target;
  const openMessageActions = messageActionMenu.openMenu;
  const closeMessageActions = messageActionMenu.closeMenu;
  const [inlineEditTargetId, setInlineEditTargetId] = React.useState<string | null>(null);
  const [inlineEditDraft, setInlineEditDraft] = React.useState<string>('');
  const [inlineEditAttachmentMode, setInlineEditAttachmentMode] = React.useState<'keep' | 'replace' | 'remove'>('keep');
  const [inlineEditUploading, setInlineEditUploading] = React.useState<boolean>(false);
  const hiddenKey = React.useMemo(() => {
    // Keep key stable per-account (prefer sub) and match existing normalization (trim + lowercase).
    const who = myUserId ? String(myUserId) : String(displayName || 'anon').trim().toLowerCase();
    const convKey = conversationId && conversationId.length > 0 ? conversationId : 'global';
    return `chat:hidden:${who}:${convKey}`;
  }, [myUserId, displayName, conversationId]);
  const { hiddenMessageIds, hideMessageId } = useHiddenMessageIds(hiddenKey);

  const { historyHasMore, historyLoading, loadOlderHistory } = useChatHistory({
    apiUrl: API_URL,
    activeConversationId: conversationId && conversationId.length > 0 ? conversationId : 'global',
    hiddenMessageIds,
    setMessages,
    setError,
    encryptedPlaceholder: ENCRYPTED_PLACEHOLDER,
    parseEncrypted,
    parseGroupEncrypted,
    normalizeUser,
    normalizeReactions,
    pageSize: HISTORY_PAGE_SIZE,
  });
  const infoModal = useChatInfoModal();
  const { infoOpen, setInfoOpen, infoTitle, infoBody, openInfo, setInfoTitle, setInfoBody } = infoModal;
  const wsRef = React.useRef<WebSocket | null>(null);
  const { TTL_OPTIONS, ttlIdx, setTtlIdx, ttlIdxDraft, setTtlIdxDraft, ttlPickerOpen, setTtlPickerOpen } =
    useChatTtlPickerState();

  // NOTE: We intentionally do NOT call `UIManager.setLayoutAnimationEnabledExperimental` here.
  // In React Native New Architecture (Fabric), it's a no-op and spams Metro warnings.

  // Persist DM settings visibility per-device, per-account.
  usePersistedBool({
    enabled: !!myUserId,
    storageKey: `chat:dmSettingsOpen:${String(myUserId || '')}`,
    value: dmSettingsOpen,
    setValue: setDmSettingsOpen,
  });

  const { uiAlert, uiConfirm, showAlert } = useUiPromptHelpers();

  const [isUploading, setIsUploading] = React.useState(false);
  const {
    pendingMedia,
    pendingMediaRef,
    setPendingMediaItems,
    clearPendingMedia,
    addPickedMediaItems,
    mergeRecoveredPickerItems,
  } = useChatAttachments({
    inlineEditAttachmentMode,
    maxAttachmentsPerMessage: MAX_ATTACHMENTS_PER_MESSAGE,
    showAlert,
  });
  const cdnMedia = useCdnUrlCache(CDN_URL);
  const mediaUrlByPath = cdnMedia.urlByPath;
  const cdnAvatar = useCdnUrlCache(CDN_URL);
  const avatarUrlByPath = cdnAvatar.urlByPath;
  useStorageSessionReady({ user, fetchAuthSession });
  const {
    imageAspectByPath,
    setImageAspectByPath,
    dmThumbUriByPath,
    dmFileUriByPath,
    decryptDmThumbToDataUri,
    decryptDmFileToCacheUri,
    decryptGroupThumbToDataUri,
    decryptGroupFileToCacheUri,
  } = useChatMediaDecryptCache({
    aesGcmDecryptBytes,
    hexToBytes,
    gcm,
    fromByteArray,
    getDmMediaSignedUrl,
    buildDmMediaKey,
  });
  // When we receive a message from a sender, refresh their avatar profile (throttled),
  // so profile changes propagate quickly without global polling.
  const AVATAR_REFETCH_ON_MESSAGE_COOLDOWN_MS = 15_000;
  const lastAvatarRefetchAtBySubRef = React.useRef<Record<string, number>>({});
  const wantedAvatarSubs = React.useMemo(() => {
    const subs: string[] = [];
    if (myUserId) subs.push(String(myUserId));
    for (const m of messages) {
      const sub = m?.userSub ? String(m.userSub) : '';
      if (sub) subs.push(sub);
    }
    return subs;
  }, [messages, myUserId]);
  const { avatarProfileBySub, invalidate: invalidateAvatarProfile, upsertMany: upsertAvatarProfiles } = usePublicAvatarProfiles({
    apiUrl: API_URL,
    subs: wantedAvatarSubs,
    // Chat flow refetches by invalidating on new messages; otherwise only fetch missing.
    ttlMs: Number.POSITIVE_INFINITY,
    resetKey: conversationId,
    cdn: cdnAvatar,
  });

  const { toast, anim: toastAnim, showToast } = useToast();

  function onViewerSavePermissionDenied() {
    showToast('Allow Photos permission to save.', 'error');
  }
  function onViewerSaveSuccess() {
    showToast('Saved to your device.', 'success');
  }
  function onViewerSaveError(msg: string) {
    const m = String(msg || '');
    showToast(m.length > 120 ? `${m.slice(0, 120)}…` : m, 'error');
  }

  const viewer = useMediaViewer<NonNullable<ChatMediaViewerState>>({
    getSaveItem: (vs) => {
      if (!vs) return null;
      if (vs.mode === 'global') return vs.globalItems?.[vs.index] ?? null;
      if (vs.mode === 'dm') {
        const it = vs.dmItems?.[vs.index];
        if (!it?.media?.path) return null;
        const url = dmFileUriByPath[it.media.path];
        if (!url) return null;
        const kind = it.media.kind === 'video' ? 'video' : it.media.kind === 'image' ? 'image' : 'file';
        return { url, kind, fileName: it.media.fileName };
      }
      return null;
    },
    onPermissionDenied: onViewerSavePermissionDenied,
    onSuccess: onViewerSaveSuccess,
    onError: onViewerSaveError,
  });
  // DM media caches + decrypt helpers are managed by useChatMediaDecryptCache().
  const inFlightDmViewerDecryptRef = React.useRef<Set<string>>(new Set());
  const [attachOpen, setAttachOpen] = React.useState<boolean>(false);
  const [cameraOpen, setCameraOpen] = React.useState<boolean>(false);
  const activeConversationId = React.useMemo(
    () => (conversationId && conversationId.length > 0 ? conversationId : 'global'),
    [conversationId],
  );
  // Per-message "Seen" state for outgoing messages (keyed by message createdAt ms)
  const { map: peerSeenAtByCreatedAt, setMap: setPeerSeenAtByCreatedAt } = usePersistedNumberMinMap(
    `chat:peerSeen:${activeConversationId}`,
  );
  const { setMap: setMySeenAtByCreatedAt } = usePersistedNumberMinMap(
    `chat:seen:${activeConversationId}`,
  );
  const isDm = React.useMemo(() => activeConversationId.startsWith('dm#'), [activeConversationId]);
  const isGroup = React.useMemo(() => activeConversationId.startsWith('gdm#'), [activeConversationId]);
  const isChannel = React.useMemo(() => activeConversationId.startsWith('ch#'), [activeConversationId]);
  const isEncryptedChat = isDm || isGroup;

  const { kickCooldownUntilBySub, groupKick, channelKick } = useChatKickActions({
    wsRef,
    activeConversationId,
    isGroup,
    isChannel,
    showAlert,
  });

  const aiSummary = useAiSummary({
    apiUrl: API_URL,
    activeConversationId,
    peer,
    messages,
    fetchAuthSession,
    showAlert,
    openInfo,
  });

  const aiHelper = useAiHelper({
    apiUrl: API_URL,
    activeConversationId,
    peer,
    messages,
    isDm,
    mediaUrlByPath,
    cdnResolve: (p) => cdnMedia.resolve(p),
    fetchAuthSession,
    openInfo,
  });

  const aiConsentGate = useAiDmConsentGate({ isDm });

  const runAiAction = React.useCallback(
    (action: 'summary' | 'helper') => {
      if (action === 'summary') void aiSummary.summarize();
      else aiHelper.openHelper();
    },
    [aiHelper, aiSummary],
  );
  const { sendReadReceipts, onToggleReadReceipts, sendReadReceipt, flushPendingRead } = useChatReadReceipts({
    enabled: isEncryptedChat,
    myUserId,
    conversationIdForStorage: conversationId && conversationId.length > 0 ? conversationId : 'global',
    activeConversationId,
    displayName,
    wsRef,
  });
  useHydratePeerPublicKey({
    enabled: isDm,
    apiUrl: API_URL,
    activeConversationId,
    myUserId,
    peer,
    setPeerPublicKey,
  });
  const activeChannelId = React.useMemo(
    () => (isChannel ? String(activeConversationId).slice('ch#'.length).trim() : ''),
    [isChannel, activeConversationId],
  );
  const channelHeaderCache = useChannelHeaderCache({ enabled: isChannel, channelId: activeChannelId });
  const channelUi = useChatChannelUiState();
  const {
    channelMeta,
    setChannelMeta,
    channelRosterChannelId,
    setChannelRosterChannelId,
    channelMembers,
    setChannelMembers,
    channelMembersActiveCountHint,
    setChannelMembersActiveCountHint,
    channelMembersOpen,
    setChannelMembersOpen,
    channelSettingsOpen,
    setChannelSettingsOpen,
    channelActionBusy,
    setChannelActionBusy,
    channelNameEditOpen,
    setChannelNameEditOpen,
    channelNameDraft,
    setChannelNameDraft,
    channelAboutOpen,
    setChannelAboutOpen,
    channelAboutEdit,
    setChannelAboutEdit,
    channelAboutDraft,
    setChannelAboutDraft,
    channelPasswordEditOpen,
    setChannelPasswordEditOpen,
    channelPasswordDraft,
    setChannelPasswordDraft,
  } = channelUi;
  const channelRosterMatchesActive = !!activeChannelId && channelRosterChannelId === activeChannelId;
  const channelMembersForUi = React.useMemo(
    () => (channelRosterMatchesActive ? channelMembers : []),
    [channelMembers, channelRosterMatchesActive],
  );
  const channelMembersVisible = React.useMemo(
    () => {
      const rows: MemberRow[] = [];
      for (const m of channelMembersForUi) {
        if (!isVisibleMemberRow(m)) continue;
        const row = toMemberRow(m);
        if (!row) continue;
        if (row.status !== 'active' && row.status !== 'banned') continue;
        rows.push(row);
      }
      return rows;
    },
    [channelMembersForUi],
  );
  const channelMembersActiveCount = React.useMemo(
    () => channelMembersForUi.reduce((acc, m) => (m && m.status === 'active' ? acc + 1 : acc), 0),
    [channelMembersForUi],
  );
  const channelMembersCountLabel = React.useMemo(() => {
    // When roster is loaded for this channel, show the real active count.
    if (channelRosterMatchesActive && channelMembersForUi.length) return `${channelMembersActiveCount || 0}`;
    // Otherwise, show cached hint if we have one; else a neutral placeholder.
    if (typeof channelMembersActiveCountHint === 'number' && Number.isFinite(channelMembersActiveCountHint)) {
      return `${Math.max(0, Math.floor(channelMembersActiveCountHint))}`;
    }
    return '—';
  }, [
    channelRosterMatchesActive,
    channelMembersForUi.length,
    channelMembersActiveCount,
    channelMembersActiveCountHint,
  ]);
  const { requestOpenLink, confirmLinkModal } = useConfirmLinkModal(isDark);
  const { refreshChannelRoster } = useChannelRoster({
    apiUrl: API_URL,
    enabled: isChannel,
    activeConversationId,
    activeChannelId,
    channelHeaderCache,
    channelMembersOpen,
    channelAboutRequestEpoch: channelAboutRequestEpoch ?? 0,
    uiAlert,
    onConversationTitleChanged,
    channelMeta,
    setChannelMeta,
    setChannelRosterChannelId,
    setChannelMembers,
    setChannelMembersActiveCountHint,
    setChannelAboutDraft,
    setChannelAboutEdit,
    setChannelAboutOpen,
  });

  const { mentionSuggestions, insertMention } = useMentions({
    enabled: !isEncryptedChat,
    input,
    setInput,
    inputRef,
    textInputRef,
    messages,
    myUserId,
    mentionTextStyle: styles.mentionText,
  });

  const chatReport = useChatReport({ apiUrl: API_URL, activeConversationId });

  const reactionInfo = useReactionInfo<ChatMessage>({
    sortSubs: (subs) => sortReactionSubs({ subs, myUserId, nameBySub }),
    ensureNamesBySub: async (subs) => {
      await ensureNameBySub(subs);
    },
  });

  usePushGroupTitleToParent({
    enabled: isGroup,
    activeConversationId,
    groupName: groupMeta?.groupName,
    computeDefaultTitle: computeDefaultGroupTitleForMe,
    onConversationTitleChanged,
  });
  const resolvedChatBg: ResolvedChatBg = React.useMemo(() => {
    const bg = chatBackground;
    if (!bg || bg.mode === 'default') return { mode: 'default' as const };
    if (bg.mode === 'color' && typeof bg.color === 'string' && bg.color.trim()) {
      return { mode: 'color' as const, color: bg.color.trim() };
    }
    if (bg.mode === 'image' && typeof bg.uri === 'string' && bg.uri.trim()) {
      const blurRaw = typeof bg.blur === 'number' ? bg.blur : 0;
      const opacityRaw = typeof bg.opacity === 'number' ? bg.opacity : 1;
      const blur = Math.max(0, Math.min(10, Math.round(blurRaw)));
      const opacity = Math.max(0.2, Math.min(1, Math.round(opacityRaw * 100) / 100));
      return { mode: 'image' as const, uri: bg.uri.trim(), blur, opacity };
    }
    return { mode: 'default' as const };
  }, [chatBackground]);

  const headerTitle = React.useMemo(() => {
    return getChatHeaderTitle({
      isChannel,
      channelName: channelMeta?.name,
      peer,
      isGroup,
      groupName: groupMeta?.groupName,
    });
  }, [isChannel, channelMeta?.name, peer, isGroup, groupMeta?.groupName]);

  useChatScreenRefSync({
    activeConversationId,
    activeConversationIdRef,
    cdnAvatarReset: cdnAvatar.reset,
    displayName,
    displayNameRef,
    input,
    inputRef,
    myPublicKey,
    myPublicKeyRef,
    onNewDmNotification,
    onNewDmNotificationRef,
    onKickedFromConversation,
    onKickedFromConversationRef,
  });

  // Avatar profiles are fetched via shared hook (usePublicAvatarProfiles).

  const latestOutgoingMessageId = useLatestOutgoingMessageId({ messages, myUserId, myPublicKey, displayName, normalizeUser });

  const getCappedMediaSize = React.useCallback(
    (aspect: number | undefined, availableWidth?: number) =>
      calcCappedMediaSize({
        aspect,
        availableWidth:
          typeof availableWidth === 'number' && Number.isFinite(availableWidth) && availableWidth > 0 ? availableWidth : windowWidth,
        maxWidthFraction: CHAT_MEDIA_MAX_WIDTH_FRACTION,
        maxHeight: CHAT_MEDIA_MAX_HEIGHT,
        minMaxWidth: 220,
        minW: 140,
        minH: 120,
        rounding: 'floor',
      }),
    [windowWidth],
  );

  useRecoverPendingImagePicker({
    trigger: inlineEditAttachmentMode,
    getPendingResultAsync: ImagePicker.getPendingResultAsync,
    pendingMediaFromImagePickerAssets,
    mergeRecoveredPickerItems,
  });

  const { pickFromLibrary, pickDocument, openCamera, handleInAppCameraCaptured } = useChatAttachmentPickers({
    showAlert,
    addPickedMediaItems,
    pendingMediaFromImagePickerAssets,
    pendingMediaFromDocumentPickerAssets,
    pendingMediaFromInAppCameraCapture,
    setCameraOpen,
  });

  // Attachments: Global = plaintext S3; DM = E2EE (client-side encryption before upload)
  const handlePickMedia = React.useCallback(() => {
    if (isDm) {
      if (!myPrivateKey) {
        showAlert('Encryption not ready', 'Missing your private key on this device.');
        return;
      }
      if (!peerPublicKey) {
        showAlert('Encryption not ready', "Can't find the recipient's public key.");
        return;
      }
    }
    setAttachOpen(true);
  }, [isDm, myPrivateKey, peerPublicKey, showAlert]);

  const { uploadPendingMedia, uploadPendingMediaDmEncrypted, uploadPendingMediaGroupEncrypted } = useChatUploadHandlers({
    activeConversationId,
    input,
  });

  // storageSessionReady is managed by useStorageSessionReady()

  useChatCdnMediaPrefetch({
    enabled: !isDm,
    messages,
    mediaUrlByPath,
    ensure: cdnMedia.ensure,
  });

  useChatImageAspectPrefetch({
    enabled: !isDm,
    messages,
    mediaUrlByPath,
    imageAspectByPath,
    setImageAspectByPath,
  });

  const openViewer = useOpenGlobalViewer<NonNullable<typeof viewer.state>>({
    resolveUrlForPath: (path) => (mediaUrlByPath[String(path)] ? mediaUrlByPath[String(path)] : null),
    includeFilesInViewer: true,
    openExternalIfFile: false,
    viewer,
    buildGlobalState: ({ index, items }) => ({ mode: 'global' as const, index, globalItems: items }),
  });

  // Fetch persisted read state so "Seen" works even if sender was offline when peer decrypted.
  useHydrateDmReads({
    enabled: !!isDm,
    apiUrl: API_URL,
    activeConversationId,
    myUserId,
    displayName,
    normalizeUser,
    setPeerSeenAtByCreatedAt,
  });

  // Seen maps are persisted via usePersistedNumberMinMap().

  // Persist autoDecrypt per-conversation, per-account so it doesn't bleed across users on the same device.
  usePersistedBool({
    storageKey: `chat:autoDecrypt:${String(myUserId || 'anon')}:${activeConversationId}`,
    value: autoDecrypt,
    setValue: setAutoDecrypt,
  });

  // ttlIdx is UI state for the disappearing-message setting.
  const nowSec = useTtlNowSec({ enabled: isDm, messages });

  // DM/group media decrypt helpers + caches come from useChatMediaDecryptCache().

  usePrefetchDmDecryptedThumbs({ enabled: isDm, messages, dmThumbUriByPath, decryptDmThumbToDataUri });
  usePrefetchGroupDecryptedThumbs({ enabled: isGroup, messages, dmThumbUriByPath, decryptGroupThumbToDataUri });

  const { openDmMediaViewer, openGroupMediaViewer } = useChatEncryptedMediaViewer({
    isDm,
    isGroup,
    viewer,
    showAlert,
    parseDmMediaEnvelope: (raw: unknown) => parseDmMediaEnvelope(String(raw ?? '')),
    parseGroupMediaEnvelope: (raw: unknown) => parseGroupMediaEnvelope(String(raw ?? '')),
    normalizeDmMediaItems,
    normalizeGroupMediaItems,
    decryptDmFileToCacheUri,
    decryptGroupFileToCacheUri,
  });

  useLazyDecryptDmViewerPages({
    viewerOpen: viewer.open,
    viewerState: viewer.state,
    dmFileUriByPath,
    inFlightRef: inFlightDmViewerDecryptRef,
    decryptDmFileToCacheUri,
  });

  useLazyDecryptGroupViewerPages({
    viewerOpen: viewer.open,
    viewerState: viewer.state,
    dmFileUriByPath,
    inFlightRef: inFlightDmViewerDecryptRef,
    decryptGroupFileToCacheUri,
  });

  const markMySeen = React.useCallback((messageCreatedAt: number, readAt: number) => {
    setMySeenAtByCreatedAt((prev) => ({
      ...prev,
      [String(messageCreatedAt)]: prev[String(messageCreatedAt)]
        ? Math.min(prev[String(messageCreatedAt)], readAt)
        : readAt,
    }));
  }, [setMySeenAtByCreatedAt]);

  // Keypair + myUserId hydration is handled by useChatMyKeys().

  useChatAutoDecrypt({
    autoDecrypt,
    myPrivateKey,
    myUserId,
    myPublicKey,
    peerPublicKey,
    isDm,
    isGroup,
    messages,
    setMessages,
    decryptForDisplay,
    decryptGroupForDisplay,
    parseDmMediaEnvelope,
    parseGroupMediaEnvelope,
    normalizeDmMediaItems,
    normalizeGroupMediaItems,
    markMySeen,
    sendReadReceipt,
  });

  // Peer public key hydration (DM) is handled by useHydratePeerPublicKey().

  const lastGroupRosterRefreshAtRef = React.useRef<number>(0);
  const lastChannelRosterRefreshAtRef = React.useRef<number>(0);

  // ws event handlers should always call the latest roster refresher.
  const refreshChannelRosterRef = React.useRef<null | (() => Promise<void>)>(null);
  React.useEffect(() => {
    refreshChannelRosterRef.current = refreshChannelRoster;
  }, [refreshChannelRoster]);

  useHydrateGroupRoster({
    enabled: isGroup,
    apiUrl: API_URL,
    activeConversationId,
    groupRefreshNonce,
    setGroupMeta,
    setGroupMembers,
    setGroupPublicKeyBySub,
    upsertAvatarProfiles,
  });

  useGroupReadOnlyRefreshTicker({
    enabled: isGroup,
    meStatus: groupMeta?.meStatus,
    tickMs: 4000,
    setGroupRefreshNonce,
  });
  // group UI state comes from useChatGroupUiState()

  useFocusGroupAddMembersInputOnOpen({
    enabled: isGroup,
    groupMembersOpen,
    meIsAdmin: !!groupMeta?.meIsAdmin,
    inputRef: groupAddMembersInputRef,
    delayMs: 150,
  });

  useRefreshGroupRosterOnMembersModalOpen({
    enabled: isGroup,
    groupMembersOpen,
    lastGroupRosterRefreshAtRef,
    setGroupRefreshNonce,
  });

  const { channelUpdate, channelLeave, groupUpdate, groupLeave } = useChatAdminOps({
    apiUrl: API_URL,
    activeConversationId,
    isChannel,
    isGroup,
    myUserId,
    wsRef,
    showAlert,
    uiConfirm,
    showToast,
    refreshChannelRoster,
    setChannelActionBusy,
    setGroupActionBusy,
    channelMetaMeIsAdmin: !!channelMeta?.meIsAdmin,
    channelMembers,
    setChannelMembers,
    setChannelMeta,
    setChannelMembersOpen,
    onKickedFromConversation: onKickedFromConversationRef.current,
    groupMetaMeIsAdmin: !!groupMeta?.meIsAdmin,
    groupMembers,
    setGroupMeta,
    bumpGroupRefreshNonce: () => setGroupRefreshNonce((v) => v + 1),
  });

  const groupMembersModalActions = useGroupMembersModalActions({
    groupAddMembersDraft,
    setGroupAddMembersDraft,
    groupUpdate,
    uiConfirm,
    wsRef,
    activeConversationId,
    setGroupMembersOpen,
  });
  const channelMembersModalActions = useChannelMembersModalActions({
    uiConfirm,
    wsRef,
    activeConversationId,
    channelUpdate,
    setChannelMembers,
    setChannelMembersOpen,
  });

  const channelSettingsPanelActions = useChannelSettingsPanelActions({
    channelMeta,
    setChannelMeta,
    setChannelActionBusy,
    channelUpdate,
    showToast,
    uiAlert,
    setChannelPasswordDraft,
    setChannelPasswordEditOpen,
  });

  const groupNameModalActions = useGroupNameModalActions({
    wsRef,
    activeConversationId,
    groupNameDraft,
    setGroupNameDraft,
    setGroupNameEditOpen,
    groupUpdate,
    setGroupMeta,
    computeDefaultGroupTitleForMe,
    onConversationTitleChanged,
  });

  const channelAboutModalActions = useChannelAboutModalActions({
    activeConversationId,
    channelMeta,
    channelAboutEdit,
    channelAboutDraft,
    setChannelAboutDraft,
    setChannelAboutEdit,
    setChannelAboutOpen,
    channelUpdate,
    markChannelAboutSeen,
    wsRef,
  });

  const channelNameModalActions = useChannelNameModalActions({
    wsRef,
    activeConversationId,
    channelNameDraft,
    setChannelMeta,
    setChannelNameEditOpen,
    channelUpdate,
  });

  const channelPasswordModalActions = useChannelPasswordModalActions({
    channelPasswordDraft,
    channelUpdate,
    setChannelMeta,
    setChannelPasswordEditOpen,
    setChannelPasswordDraft,
    showAlert,
  });

  const onWsMessage = useChatWsMessageHandler({
    activeConversationIdRef,
    displayNameRef,
    myUserId,
    myPublicKeyRef,
    blockedSubsSet,
    hiddenMessageIds,
    encryptedPlaceholder: ENCRYPTED_PLACEHOLDER,
    avatarRefetchCooldownMs: AVATAR_REFETCH_ON_MESSAGE_COOLDOWN_MS,
    lastAvatarRefetchAtBySubRef,
    invalidateAvatarProfile,
    onNewDmNotification: onNewDmNotificationRef.current,
    onKickedFromConversation: onKickedFromConversationRef.current,
    openInfo,
    showAlert,
    showToast,
    refreshChannelRoster: refreshChannelRosterRef.current || undefined,
    lastGroupRosterRefreshAtRef,
    lastChannelRosterRefreshAtRef,
    bumpGroupRefreshNonce: () => setGroupRefreshNonce((n) => n + 1),
    setGroupMeStatus: (meStatus) => setGroupMeta((prev) => (prev ? { ...prev, meStatus } : prev)),
    setMessages,
    setPeerSeenAtByCreatedAt,
    setTypingByUserExpiresAt,
    sendTimeoutRef,
    parseEncrypted,
    parseGroupEncrypted,
    normalizeUser,
    normalizeReactions,
  });

  const { isConnecting, isConnected } = useChatWsConnection({
    user,
    wsUrl: WS_URL,
    wsRef,
    appStateRef,
    activeConversationIdRef,
    pendingJoinConversationIdRef,
    flushPendingRead,
    setError,
    onMessage: onWsMessage,
  });

  const { isTypingRef, sendTyping, typingIndicatorText } = useChatTyping({
    wsRef,
    activeConversationId,
    displayName,
    typingByUserExpiresAt,
    setTypingByUserExpiresAt,
  });

  // Client-side hiding of expired DM messages (server-side TTL still required for real deletion).
  usePruneExpiredMessages({ enabled: isDm, setMessages, intervalMs: 10_000 });

  const { sendMessage, retryFailedMessage } = useChatSendActions({
    wsRef,
    activeConversationId,
    displayName,
    myUserId,
    isDm,
    isGroup,
    isChannel,
    inputRef,
    pendingMediaRef,
    textInputRef,
    setError,
    setMessages,
    setInput,
    setInputEpoch,
    setPendingMediaItems,
    clearPendingMedia,
    replyTarget,
    setReplyTarget,
    inlineEditTargetId,
    isUploading,
    setIsUploading,
    onBlockedByInlineEdit: () => {
      // NOTE: openInfo is declared later in this file, so avoid referencing it here.
      setInfoTitle('Finish editing');
      setInfoBody('Save or cancel the edit before sending a new message.');
      setInfoOpen(true);
    },
    isTypingRef,
    groupMeta,
    groupMembers,
    groupPublicKeyBySub,
    maxAttachmentsPerMessage: MAX_ATTACHMENTS_PER_MESSAGE,
    myPrivateKey,
    peerPublicKey,
    getRandomBytes,
    encryptChatMessageV1,
    prepareDmOutgoingEncryptedText,
    prepareGroupMediaPlaintext,
    encryptGroupOutgoingEncryptedText,
    uploadPendingMedia,
    uploadPendingMediaDmEncrypted,
    uploadPendingMediaGroupEncrypted,
    timestampId,
    applyOptimisticSendForTextOnly,
    sendTimeoutRef,
    autoDecrypt,
    encryptedPlaceholder: ENCRYPTED_PLACEHOLDER,
    ttlSeconds: isDm && TTL_OPTIONS[ttlIdx]?.seconds ? TTL_OPTIONS[ttlIdx].seconds : undefined,
    parseEncrypted,
    parseGroupEncrypted,
    normalizeUser,
    showAlert,
  });

  useChatConversationJoin({ activeConversationId, wsRef, pendingJoinConversationIdRef });

  const { onChangeInput } = useChatComposerInput({ setInput, inputRef, isTypingRef, sendTyping });
  const { copyToClipboard } = useChatCopyToClipboard({ openInfo });

  const onPressMessage = useChatPressToDecrypt({
    isDm,
    isGroup,
    encryptedPlaceholder: ENCRYPTED_PLACEHOLDER,
    myUserId,
    myPublicKey,
    decryptForDisplay,
    decryptGroupForDisplay,
    parseDmMediaEnvelope,
    parseGroupMediaEnvelope,
    normalizeDmMediaItems,
    normalizeGroupMediaItems,
    setMessages,
    sendReadReceipt,
    markMySeen,
    openInfo,
  });

  // reaction emoji lists live in features/chat/reactionEmojis

  const { beginReply } = useChatReplyActions({
    isDm,
    encryptedPlaceholder: ENCRYPTED_PLACEHOLDER,
    dmThumbUriByPath,
    mediaUrlByPath,
    closeMessageActions,
    focusComposer: () => {
      textInputRef.current?.focus?.();
    },
    setReplyTarget,
    getPreviewKind,
  });

  const { beginInlineEdit, cancelInlineEdit, commitInlineEdit } = useChatInlineEditActions({
    wsRef,
    activeConversationId,
    isDm,
    messages,
    setMessages,
    setError,
    inlineEditTargetId,
    setInlineEditTargetId,
    inlineEditDraft,
    setInlineEditDraft,
    inlineEditAttachmentMode,
    setInlineEditAttachmentMode,
    inlineEditUploading,
    setInlineEditUploading,
    pendingMediaRef,
    clearPendingMedia,
    myPrivateKey,
    peerPublicKey,
    encryptChatMessageV1,
    parseEncrypted,
    parseChatEnvelope,
    parseDmMediaEnvelope,
    parseGroupMediaEnvelope,
    normalizeDmMediaItems,
    normalizeGroupMediaItems,
    uploadPendingMedia,
    uploadPendingMediaDmEncrypted,
    openInfo,
    showAlert,
    closeMessageActions,
  });

  const messageOps = useChatMessageOps({
    wsRef,
    activeConversationId,
    myUserId,
    messageActionTarget,
    closeMessageActions,
    setError,
    setMessages,
    hideMessageId,
    setReactionPickerOpen,
    setReactionPickerTarget,
    openReactionInfo: reactionInfo.openReactionInfo,
    showAlert,
  });
  const deleteForMe = messageOps.deleteForMe;
  const sendDelete = messageOps.sendDeleteForEveryone;
  const sendReaction = messageOps.sendReaction;
  const openReactionPicker = messageOps.openReactionPicker;
  const closeReactionPicker = messageOps.closeReactionPicker;
  const openReactionInfo = messageOps.openReactionInfoFor;

  const getSeenLabelFor = React.useCallback(getSeenLabelForCreatedAt, []);

  const onPressSummarize = React.useCallback(() => aiConsentGate.request('summary', runAiAction), [aiConsentGate, runAiAction]);
  const onPressAiHelper = React.useCallback(() => aiConsentGate.request('helper', runAiAction), [aiConsentGate, runAiAction]);
  const onOpenTtlPicker = React.useCallback(() => {
    setTtlIdxDraft(ttlIdx);
    setTtlPickerOpen(true);
  }, [setTtlIdxDraft, setTtlPickerOpen, ttlIdx]);

  const listRenderItem = React.useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) =>
      renderChatListItem({
        styles,
        item,
        index,
        messageListData,
        visibleMessages,
        isDark,
        isDm,
        isGroup,
        isEncryptedChat,
        myUserId,
        myPublicKey,
        displayName,
        nameBySub,
        avatarProfileBySub,
        avatarUrlByPath,
        peerSeenAtByCreatedAt,
        getSeenLabelFor,
        normalizeUser,
        nowSec,
        formatRemaining,
        mediaUrlByPath,
        dmThumbUriByPath,
        imageAspectByPath,
        EMPTY_URI_BY_PATH,
        AVATAR_GUTTER,
        chatViewportWidth,
        getCappedMediaSize,
        inlineEditTargetId,
        inlineEditDraft,
        setInlineEditDraft,
        inlineEditUploading,
        inlineEditAttachmentMode,
        pendingMedia,
        commitInlineEdit,
        cancelInlineEdit,
        openReactionInfo,
        sendReaction,
        openViewer,
        openDmMediaViewer,
        openGroupMediaViewer,
        requestOpenLink,
        onPressMessage,
        openMessageActions,
        latestOutgoingMessageId,
        retryFailedMessage,
      }),
    [
      AVATAR_GUTTER,
      cancelInlineEdit,
      chatViewportWidth,
      commitInlineEdit,
      displayName,
      dmThumbUriByPath,
      getCappedMediaSize,
      getSeenLabelFor,
      imageAspectByPath,
      inlineEditAttachmentMode,
      inlineEditDraft,
      inlineEditTargetId,
      inlineEditUploading,
      isDark,
      isDm,
      isEncryptedChat,
      isGroup,
      latestOutgoingMessageId,
      mediaUrlByPath,
      messageListData,
      myPublicKey,
      myUserId,
      nameBySub,
      nowSec,
      onPressMessage,
      openDmMediaViewer,
      openGroupMediaViewer,
      openMessageActions,
      openReactionInfo,
      openViewer,
      peerSeenAtByCreatedAt,
      pendingMedia,
      requestOpenLink,
      retryFailedMessage,
      sendReaction,
      setInlineEditDraft,
      avatarProfileBySub,
      avatarUrlByPath,
      visibleMessages,
    ],
  );

  const mainProps = buildChatScreenMainProps({
    styles,
    isDark,
    isWideChatLayout,
    headerTop,
    headerTitle,
    onPressSummarize,
    onPressAiHelper,
    displayName,
    myUserId,
    avatarProfileBySub,
    avatarUrlByPath,
    isConnecting,
    isConnected,
    isEncryptedChat,
    isChannel,
    dmSettingsOpen,
    setDmSettingsOpen,
    channelSettingsOpen,
    setChannelSettingsOpen,
    dmSettingsCompact: !!dmSettingsCompact,
    isDm,
    isGroup,
    myPrivateKeyReady: !!myPrivateKey,
    autoDecrypt,
    setAutoDecrypt,
    ttlLabel: TTL_OPTIONS[ttlIdx]?.label ?? 'Off',
    onOpenTtlPicker,
    sendReadReceipts,
    onToggleReadReceipts: (v) => onToggleReadReceipts(!!v),
    groupMembersCountLabel: `${groupMembersActiveCount || 0}`,
    groupActionBusy: !!groupActionBusy,
    groupMeIsAdmin: !!groupMeta?.meIsAdmin,
    onOpenGroupMembers: () => setGroupMembersOpen(true),
    onOpenGroupName: () => {
      setGroupNameDraft(groupMeta?.groupName || '');
      setGroupNameEditOpen(true);
    },
    onLeaveGroup: () => void groupLeave(),
    channelBusy: !!channelActionBusy,
    channelMeIsAdmin: !!channelMeta?.meIsAdmin,
    channelIsPublic: !!channelMeta?.isPublic,
    channelHasPassword: !!channelMeta?.hasPassword,
    channelMembersCountLabel,
    onOpenChannelMembers: () => setChannelMembersOpen(true),
    onOpenChannelAbout: () => {
      setChannelAboutDraft(String(channelMeta?.aboutText || ''));
      setChannelAboutEdit(true);
      setChannelAboutOpen(true);
    },
    onOpenChannelName: () => {
      setChannelNameDraft(channelMeta?.name || '');
      setChannelNameEditOpen(true);
    },
    onLeaveChannel: () => void channelLeave(),
    channelOnTogglePublic: channelSettingsPanelActions.onTogglePublic,
    channelOnPressPassword: channelSettingsPanelActions.onPressPassword,
    error,
    resolvedChatBg,
    apiUrl: API_URL,
    listIsGroup: isGroup,
    groupStatus: groupMeta?.meStatus,
    visibleMessagesCount: visibleMessages.length,
    messageListData,
    webPinned,
    listRef: webPinned.listRef,
    historyHasMore,
    historyLoading,
    loadOlderHistory,
    renderItem: listRenderItem,
    composerIsDm: isDm,
    composerIsGroup: isGroup,
    composerIsEncryptedChat: isEncryptedChat,
    composerGroupMeta: groupMeta,
    inlineEditTargetId,
    inlineEditUploading,
    cancelInlineEdit,
    pendingMedia,
    setPendingMedia: setPendingMediaItems,
    isUploading,
    replyTarget,
    setReplyTarget,
    messages,
    openViewer,
    typingIndicatorText,
    TypingIndicator,
    typingColor: isDark ? styles.typingTextDark.color : styles.typingText.color,
    mentionSuggestions,
    insertMention,
    composerSafeAreaStyle,
    composerHorizontalInsetsStyle,
    textInputRef,
    inputEpoch,
    input,
    onChangeInput,
    isTypingRef,
    sendTyping,
    sendMessage,
    handlePickMedia,
  });

  const overlaysProps = buildChatScreenOverlaysProps({
    isDark,
    styles,
    insets: { top: insets.top, bottom: insets.bottom },
    aiSummary,
    aiConsentGate,
    runAiAction,
    attach: {
      open: attachOpen,
      setOpen: setAttachOpen,
      pickFromLibrary,
      openCamera,
      pickDocument,
    },
    camera: {
      open: cameraOpen,
      setOpen: setCameraOpen,
      showAlert,
      onCaptured: handleInAppCameraCaptured,
    },
    aiHelper,
    copyToClipboard,
    setInput,
    report: chatReport,
    cdnMedia,
    messageActionMenu,
    myUserId,
    myPublicKey,
    displayName,
    isDm,
    encryptedPlaceholder: ENCRYPTED_PLACEHOLDER,
    normalizeUser,
    mediaUrlByPath,
    dmThumbUriByPath,
    quickReactions: [...QUICK_REACTIONS],
    blockedSubsSet,
    onBlockUserSub,
    uiConfirm,
    messageOps: {
      deleteForMe,
      sendDeleteForEveryone: sendDelete,
      sendReaction,
      openReactionPicker,
      setCipherText,
      setCipherOpen,
      beginReply,
      beginInlineEdit,
      setInlineEditAttachmentMode,
      handlePickMedia,
      clearPendingMedia,
      openReportModalForMessage: chatReport.openReportModalForMessage,
    },
    reactionPickerOpen,
    reactionPickerTarget,
    emojis: [...MORE_REACTIONS],
    closeReactionPicker,
    cipher: { open: cipherOpen, text: cipherText, setOpen: setCipherOpen, setText: setCipherText },
    reactionInfo,
    nameBySub,
    info: { infoOpen, infoTitle, infoBody, setInfoOpen },
    ttl: {
      ttlPickerOpen,
      TTL_OPTIONS,
      ttlIdx,
      ttlIdxDraft,
      setTtlIdxDraft,
      setTtlPickerOpen,
      setTtlIdx,
    },
    groupNameEditOpen,
    groupActionBusy,
    groupNameDraft,
    setGroupNameDraft,
    groupNameModalActions,
    groupMembersOpen,
    groupMeta,
    groupAddMembersDraft,
    setGroupAddMembersDraft,
    groupMembersModalActions,
    groupAddMembersInputRef,
    groupMembersVisible,
    kickCooldownUntilBySub,
    avatarUrlByPath,
    groupKick,
    groupUpdate,
    channelMembersOpen,
    channelMembersVisible,
    channelMeta,
    channelActionBusy,
    channelMembersModalActions,
    channelUpdate,
    channelKick,
    channelAboutOpen,
    channelAboutEdit,
    channelAboutDraft,
    setChannelAboutDraft,
    setChannelAboutEdit,
    channelAboutModalActions,
    requestOpenLink,
    channelNameEditOpen,
    channelNameDraft,
    setChannelNameDraft,
    channelNameModalActions,
    channelPasswordEditOpen,
    channelPasswordDraft,
    setChannelPasswordDraft,
    channelPasswordModalActions,
    viewer,
    dmFileUriByPath,
    confirmLinkModal,
    toast,
    toastAnim,
  });

  return (
    <SafeAreaView
      style={[styles.safe, isDark ? styles.safeDark : null]}
      // Web: ignore safe-area left/right insets (they can be misreported as ~42px and flip with rotation).
      edges={Platform.OS === 'web' ? [] : ['left', 'right']}
    >
      <ChatScreenMain {...mainProps} />
      <ChatScreenOverlays {...overlaysProps} />
    </SafeAreaView>
  );
}
