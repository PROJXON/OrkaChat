import React from 'react';
import {
  Alert,
  AppState,
  AppStateStatus,
  Easing,
  findNodeHandle,
  LayoutAnimation,
  UIManager,
  useWindowDimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { styles } from './ChatScreen.styles';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WS_URL, API_URL, CDN_URL } from '../config/env';
import { useAuthenticator } from '@aws-amplify/ui-react-native/dist';
import { useCdnUrlCache } from '../hooks/useCdnUrlCache';
import { useMessageActionMenu } from '../features/chat/useMessageActionMenu';
import { ChannelSettingsPanel } from '../features/chat/components/ChannelSettingsPanel';
import { DmSettingsPanel } from '../features/chat/components/DmSettingsPanel';
import { ChatHeaderStatusRow } from '../features/chat/components/ChatHeaderStatusRow';
import { ChatHeaderTitleRow } from '../features/chat/components/ChatHeaderTitleRow';
import { ChatMessageList } from '../features/chat/components/ChatMessageList';
import { ChatBackgroundLayer } from '../features/chat/components/ChatBackgroundLayer';
import Constants from 'expo-constants';
import { fetchAuthSession } from '@aws-amplify/auth';
import {
  aesGcmDecryptBytes,
  aesGcmEncryptBytes,
  decryptChatMessageV1,
  deriveChatKeyBytesV1,
  encryptChatMessageV1,
  derivePublicKey,
  loadKeyPair,
} from '../utils/crypto';
import type { EncryptedChatPayloadV1 } from '../types/crypto';
import { getRandomBytes } from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { InlineVideoThumb } from '../components/InlineVideoThumb';
import * as MediaLibrary from 'expo-media-library';
import Feather from '@expo/vector-icons/Feather';
import { fromByteArray } from 'base64-js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { gcm } from '@noble/ciphers/aes.js';
import { getDmMediaSignedUrl } from '../utils/dmSignedUrl';
import { RichText } from '../components/RichText';
import type { MediaItem, MediaKind } from '../types/media';
import type { ReactionMap } from '../types/reactions';
import type {
  ChatMessage,
  ChatEnvelope,
  DmMediaEnvelope,
  DmMediaEnvelopeV1,
  EncryptedGroupPayloadV1,
  GroupMediaEnvelope,
  GroupMediaEnvelopeV1,
} from '../features/chat/types';
import {
  normalizeChatMediaList,
  normalizeDmMediaItems,
  normalizeGroupMediaItems,
  normalizeReactions,
  parseChatEnvelope,
  parseDmMediaEnvelope,
  parseGroupMediaEnvelope,
} from '../features/chat/parsers';
import { MAX_ATTACHMENTS_PER_MESSAGE } from '../features/chat/uploads';
import { uploadChannelMediaPlain, uploadDmMediaEncrypted, uploadGroupMediaEncrypted } from '../features/chat/uploadMedia';
import type { PendingMediaItem } from '../features/chat/attachments';
import {
  pendingMediaFromDocumentPickerAssets,
  pendingMediaFromImagePickerAssets,
  pendingMediaFromInAppCameraCapture,
} from '../features/chat/attachments';
import { useChatAttachments } from '../features/chat/useChatAttachments';
import { useDisplayNameBySub } from '../features/chat/useDisplayNameBySub';
import { useUiPromptHelpers } from '../hooks/useUiPromptHelpers';
import { ChatComposer } from '../features/chat/components/ChatComposer';
import { getNativeEventNumber } from '../utils/nativeEvent';
import { renderChatListItem } from '../features/chat/renderChatListItem';
import { getChatHeaderTitle } from '../utils/conversationTitles';
import { useConfirmLinkModal } from '../hooks/useConfirmLinkModal';
import { useModalState } from '../hooks/useModalState';
import { useViewportWidth } from '../hooks/useViewportWidth';
import { useWebPinnedList } from '../hooks/useWebPinnedList';
import { usePublicAvatarProfiles } from '../hooks/usePublicAvatarProfiles';
import { getChannelAboutSeenVersion, markChannelAboutSeen } from '../utils/channelAboutSeen';
import { useAutoPopupChannelAbout } from '../hooks/useAutoPopupChannelAbout';
import { defaultFileExtensionForContentType, getPreviewKind, isImageLike } from '../utils/mediaKinds';
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
import { usePersistedNumberMinMap } from '../hooks/usePersistedNumberMinMap';
import { usePersistedBool } from '../hooks/usePersistedBool';
import { usePersistedNumber } from '../hooks/usePersistedNumber';
import { copyToClipboardSafe } from '../utils/clipboard';
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
import { type GroupMember, type GroupMeta, useHydrateGroupRoster } from '../features/chat/useHydrateGroupRoster';
import { useGroupReadOnlyRefreshTicker, useRefreshGroupRosterOnMembersModalOpen } from '../features/chat/useGroupRefreshTriggers';
import { throttleByRef } from '../utils/throttled';
import { timestampId } from '../utils/ids';
import { isMembershipSystemKind } from '../features/chat/membershipKinds';
import { applyGroupMembershipSystemEventToMe } from '../features/chat/applyMembershipToMe';
import { buildSystemChatMessageFromPayload } from '../features/chat/buildSystemMessage';
import { buildIncomingChatMessageFromWsPayload } from '../features/chat/buildIncomingMessage';
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
import { useWebSafeInvertedListData } from '../hooks/useWebSafeInvertedListData';
import { type ChannelMember, type ChannelMeta, useChannelRoster } from '../features/chat/useChannelRoster';
import { useMentions } from '../features/chat/useMentions';
import { useChatReport } from '../features/chat/useChatReport';
import { useReactionInfo } from '../hooks/useReactionInfo';
import { useMediaViewer } from '../hooks/useMediaViewer';
import { useToast } from '../hooks/useToast';
import { openGlobalViewerFromMediaList } from '../utils/openGlobalViewer';
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
  const visibleMessages = React.useMemo(
    () => messages.filter((m) => !(m.userSub && blockedSubsSet.has(String(m.userSub)))),
    [messages, blockedSubsSet],
  );
  const messageListData = useWebSafeInvertedListData(visibleMessages);
  // Web-only: since we render a non-inverted list (and reverse data), explicitly start at the bottom.
  const messageListRef = React.useRef<any>(null);
  const webPinned = useWebPinnedList({
    enabled: Platform.OS === 'web',
    itemCount: visibleMessages.length,
    // ChatScreen does its own "near top" handler below (it needs API_URL/history guards).
  });
  const AVATAR_SIZE = 44;
  const AVATAR_GAP = 8;
  const AVATAR_GUTTER = AVATAR_SIZE + AVATAR_GAP;
  const AVATAR_TOP_OFFSET = 4;
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
  // For UI counts + roster list. We intentionally hide "left" members.
  const groupMembersVisible = React.useMemo(
    () => groupMembers.filter((m) => m && (m.status === 'active' || m.status === 'banned')),
    [groupMembers],
  );
  // For the "Members" button count: show *active* participants only.
  const groupMembersActiveCount = React.useMemo(
    () => groupMembers.reduce((acc, m) => (m && m.status === 'active' ? acc + 1 : acc), 0),
    [groupMembers],
  );
  const computeDefaultGroupTitleForMe = React.useCallback((): string => {
    const mySub = typeof myUserId === 'string' && myUserId.trim() ? myUserId.trim() : '';
    const active = groupMembers.filter((m) => m && m.status === 'active');
    const others = active.filter((m) => !mySub || String(m.memberSub) !== mySub);
    const labels = others
      .map((m) => String(m.displayName || m.memberSub || '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    if (!labels.length) return 'Group DM';
    const head = labels.slice(0, 3);
    const rest = labels.length - head.length;
    return rest > 0 ? `${head.join(', ')} +${rest}` : head.join(', ');
  }, [groupMembers, myUserId]);
  const [autoDecrypt, setAutoDecrypt] = React.useState<boolean>(false);
  const { cipherOpen, setCipherOpen, cipherText, setCipherText } = useChatCipherState();
  const { nameBySub, ensureNames: ensureNameBySub } = useDisplayNameBySub(API_URL);
  const [reactionPickerOpen, setReactionPickerOpen] = React.useState<boolean>(false);
  const [reactionPickerTarget, setReactionPickerTarget] = React.useState<ChatMessage | null>(null);
  const messageActionMenu = useMessageActionMenu<ChatMessage>();
  const messageActionOpen = messageActionMenu.open;
  const messageActionTarget = messageActionMenu.target;
  const messageActionAnchor = messageActionMenu.anchor;
  const actionMenuAnim = messageActionMenu.anim;
  const actionMenuMeasuredHRef = messageActionMenu.measuredHRef;
  const actionMenuMeasuredH = messageActionMenu.measuredH;
  const openMessageActions = messageActionMenu.openMenu;
  const closeMessageActions = messageActionMenu.closeMenu;
  const onActionMenuMeasuredH = messageActionMenu.onMeasuredH;
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
  const storageSessionReady = useStorageSessionReady({ user, fetchAuthSession });
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

  const viewer = useMediaViewer<{
    mode: 'global' | 'dm' | 'gdm';
    title?: string;
    index: number;
    globalItems?: Array<{ url: string; kind: 'image' | 'video' | 'file'; fileName?: string }>;
    dmMsg?: ChatMessage;
    dmItems?: Array<{ media: DmMediaEnvelopeV1['media']; wrap: DmMediaEnvelopeV1['wrap'] }>;
    gdmMsg?: ChatMessage;
    gdmItems?: Array<{ media: DmMediaEnvelopeV1['media']; wrap: DmMediaEnvelopeV1['wrap'] }>;
  }>({
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
  const { map: mySeenAtByCreatedAt, setMap: setMySeenAtByCreatedAt } = usePersistedNumberMinMap(
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
  const channelMembersForUi = channelRosterMatchesActive ? channelMembers : [];
  const channelMembersVisible = React.useMemo(
    () => channelMembersForUi.filter((m) => m && (m.status === 'active' || m.status === 'banned')),
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

  const { mentionSuggestions, insertMention, renderTextWithMentions } = useMentions({
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

  // Keep parent Chats list/unreads in sync whenever the effective group title changes
  // (e.g. another admin renamed the group and we refreshed group meta).
  const lastPushedTitleRef = React.useRef<string>('');
  React.useEffect(() => {
    if (!isGroup) return;
    const effective =
      groupMeta?.groupName && String(groupMeta.groupName).trim()
        ? String(groupMeta.groupName).trim()
        : computeDefaultGroupTitleForMe();
    if (!effective) return;
    if (effective === lastPushedTitleRef.current) return;
    lastPushedTitleRef.current = effective;
    try {
      onConversationTitleChanged?.(activeConversationId, effective);
    } catch {
      // ignore
    }
  }, [isGroup, activeConversationId, groupMeta?.groupName, computeDefaultGroupTitleForMe, onConversationTitleChanged]);
  const resolvedChatBg = React.useMemo(() => {
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

  React.useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  React.useEffect(() => {
    cdnAvatar.reset();
  }, [activeConversationId]);
  React.useEffect(() => {
    displayNameRef.current = displayName;
  }, [displayName]);

  React.useEffect(() => {
    inputRef.current = input;
  }, [input]);

  // Avatar profiles are fetched via shared hook (usePublicAvatarProfiles).

  React.useEffect(() => {
    myPublicKeyRef.current = myPublicKey;
  }, [myPublicKey]);
  React.useEffect(() => {
    onNewDmNotificationRef.current = onNewDmNotification;
  }, [onNewDmNotification]);
  React.useEffect(() => {
    onKickedFromConversationRef.current = onKickedFromConversation;
  }, [onKickedFromConversation]);

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

  const uploadPendingMedia = React.useCallback(
    async (media: PendingMediaItem): Promise<MediaItem> => {
      return await uploadChannelMediaPlain({ media, activeConversationId });
    },
    [activeConversationId],
  );

  const uploadPendingMediaDmEncrypted = React.useCallback(
    async (
      media: PendingMediaItem,
      conversationKey: string,
      senderPrivateKeyHex: string,
      recipientPublicKeyHex: string,
      captionOverride?: string,
    ): Promise<DmMediaEnvelopeV1> => {
      return await uploadDmMediaEncrypted({
        media,
        conversationKey,
        senderPrivateKeyHex,
        recipientPublicKeyHex,
        inputText: input,
        captionOverride,
      });
    },
    [input],
  );

  const uploadPendingMediaGroupEncrypted = React.useCallback(
    async (
      media: PendingMediaItem,
      conversationKey: string,
      messageKeyBytes: Uint8Array,
      captionOverride?: string,
    ): Promise<GroupMediaEnvelopeV1> => {
      return await uploadGroupMediaEncrypted({
        media,
        conversationKey,
        messageKeyBytes,
        inputText: input,
        captionOverride,
      });
    },
    [input],
  );

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

  const openViewer = useOpenGlobalViewer({
    resolveUrlForPath: (path) => (mediaUrlByPath[String(path)] ? mediaUrlByPath[String(path)] : null),
    includeFilesInViewer: true,
    openExternalIfFile: false,
    viewer,
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
    parseDmMediaEnvelope: (raw: any) => parseDmMediaEnvelope(String(raw ?? '')),
    parseGroupMediaEnvelope: (raw: any) => parseGroupMediaEnvelope(String(raw ?? '')),
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
  }, []);

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

  // Focus the "Add usernames" input when Members modal opens (admin-only).
  React.useEffect(() => {
    if (!groupMembersOpen) return;
    if (!groupMeta?.meIsAdmin) return;
    const t = setTimeout(() => {
      try {
        groupAddMembersInputRef.current?.focus?.();
      } catch {
        // ignore
      }
    }, 150);
    return () => clearTimeout(t);
  }, [groupMembersOpen, groupMeta?.meIsAdmin]);

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

  const sendJoin = React.useCallback((conversationIdToJoin: string) => {
    if (!conversationIdToJoin) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      pendingJoinConversationIdRef.current = conversationIdToJoin;
      return;
    }
    try {
      wsRef.current.send(
        JSON.stringify({
          action: 'join',
          conversationId: conversationIdToJoin,
          createdAt: Date.now(),
        }),
      );
      pendingJoinConversationIdRef.current = null;
    } catch {
      pendingJoinConversationIdRef.current = conversationIdToJoin;
    }
  }, []);

  // Notify backend whenever user switches conversations (enables Query-by-conversation routing).
  React.useEffect(() => {
    sendJoin(activeConversationId);
  }, [activeConversationId, sendJoin]);

  const onChangeInput = React.useCallback(
    (next: string) => {
      setInput(next);
      inputRef.current = next;
      const nextHasText = next.trim().length > 0;
      if (nextHasText) sendTyping(true);
      else if (isTypingRef.current) sendTyping(false);
    },
    [sendTyping],
  );

  // Some dev builds may not have expo-clipboard compiled in yet.
  // Lazy-load so the app doesn't crash; show a friendly modal instead.
  const copyToClipboard = React.useCallback(
    async (text: string) => {
      await copyToClipboardSafe({
        text,
        onUnavailable: () => {
          openInfo(
            'Copy unavailable',
            'Your current build does not include clipboard support yet. Rebuild the dev client to enable Copy.',
          );
        },
      });
    },
    [openInfo],
  );

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
    parseDmMediaEnvelope,
    parseGroupMediaEnvelope,
    normalizeDmMediaItems,
    normalizeGroupMediaItems,
    parseChatEnvelope,
    normalizeChatMediaList,
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

  return (
    <SafeAreaView
      style={[styles.safe, isDark ? styles.safeDark : null]}
      // Web: ignore safe-area left/right insets (they can be misreported as ~42px and flip with rotation).
      edges={Platform.OS === 'web' ? [] : ['left', 'right']}
    >
      <KeyboardAvoidingView
        style={styles.container}
        // iOS: use padding to lift input above keyboard.
        // Android: rely on `softwareKeyboardLayoutMode: "resize"` (app.json) so the window resizes like Signal.
        behavior={Platform.select({ ios: 'padding', android: undefined })}
      >
        <View style={[styles.header, isDark ? styles.headerDark : null]}>
          <View style={isWideChatLayout ? styles.chatContentColumn : null}>
            {headerTop ? <View style={styles.headerTopSlot}>{headerTop}</View> : null}
            <ChatHeaderTitleRow
              styles={styles}
              isDark={isDark}
              title={headerTitle}
                onPressSummarize={() => aiConsentGate.request('summary', runAiAction)}
                onPressAiHelper={() => aiConsentGate.request('helper', runAiAction)}
            />
            <ChatHeaderStatusRow
              styles={styles}
              isDark={isDark}
              displayName={displayName}
              myUserId={myUserId}
              avatarProfileBySub={avatarProfileBySub}
              avatarUrlByPath={avatarUrlByPath}
              isConnecting={isConnecting}
              isConnected={isConnected}
              showCaret={!!(isEncryptedChat || isChannel)}
              caretExpanded={!!(isEncryptedChat ? dmSettingsOpen : channelSettingsOpen)}
              caretA11yLabel={
                isEncryptedChat
                  ? dmSettingsOpen
                    ? 'Hide message options'
                    : 'Show message options'
                  : channelSettingsOpen
                    ? 'Hide channel options'
                    : 'Show channel options'
              }
              onPressCaret={() => {
                try {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                } catch {
                  // ignore
                }
                if (isEncryptedChat) setDmSettingsOpen((v) => !v);
                else setChannelSettingsOpen((v) => !v);
              }}
            />

            {isEncryptedChat ? (
              <>
                {dmSettingsOpen ? (
                  <>
                    <DmSettingsPanel
                      isDark={isDark}
                      styles={styles}
                      compact={!!dmSettingsCompact}
                      isDm={isDm}
                      isGroup={isGroup}
                      myPrivateKeyReady={!!myPrivateKey}
                      autoDecrypt={autoDecrypt}
                      onToggleAutoDecrypt={setAutoDecrypt}
                      ttlLabel={TTL_OPTIONS[ttlIdx]?.label ?? 'Off'}
                      onOpenTtlPicker={() => {
                        setTtlIdxDraft(ttlIdx);
                        setTtlPickerOpen(true);
                      }}
                      sendReadReceipts={sendReadReceipts}
                      onToggleReadReceipts={(v) => {
                        onToggleReadReceipts(!!v);
                      }}
                      groupMembersCountLabel={`${groupMembersActiveCount || 0}`}
                      groupActionBusy={!!groupActionBusy}
                      groupMeIsAdmin={!!groupMeta?.meIsAdmin}
                      onOpenGroupMembers={() => setGroupMembersOpen(true)}
                      onOpenGroupName={() => {
                        setGroupNameDraft(groupMeta?.groupName || '');
                        setGroupNameEditOpen(true);
                      }}
                      onLeaveGroup={() => void groupLeave()}
                    />
                  </>
                ) : null}
              </>
            ) : isChannel ? (
              <>
                {channelSettingsOpen ? (
                  <ChannelSettingsPanel
                    isDark={isDark}
                    styles={styles}
                    compact={!!dmSettingsCompact}
                    busy={!!channelActionBusy}
                    meIsAdmin={!!channelMeta?.meIsAdmin}
                    isPublic={!!channelMeta?.isPublic}
                    hasPassword={!!channelMeta?.hasPassword}
                    membersCountLabel={channelMembersCountLabel}
                    onOpenMembers={() => setChannelMembersOpen(true)}
                    onOpenAbout={() => {
                      setChannelAboutDraft(String(channelMeta?.aboutText || ''));
                      setChannelAboutEdit(true);
                      setChannelAboutOpen(true);
                    }}
                    onOpenName={() => {
                      setChannelNameDraft(channelMeta?.name || '');
                      setChannelNameEditOpen(true);
                    }}
                    onLeave={() => void channelLeave()}
                    onTogglePublic={channelSettingsPanelActions.onTogglePublic}
                    onPressPassword={channelSettingsPanelActions.onPressPassword}
                  />
                ) : null}
              </>
            ) : null}
            {error ? <Text style={[styles.error, isDark ? styles.errorDark : null]}>{error}</Text> : null}
          </View>
        </View>
        <View style={styles.chatBody}>
          <ChatBackgroundLayer styles={styles} isDark={isDark} resolvedChatBg={resolvedChatBg as any} />

          {/* Keep the scroll container full-width so the web scrollbar stays at the window edge.
              Center the *content* via FlatList.contentContainerStyle instead. */}
          <View style={styles.chatBodyInner}>
            {/*
            Web note:
            React Native's FlatList `inverted` behavior is implemented differently on web and can render
            list content upside-down in some environments. We render a non-inverted list on web and
            reverse the data, while keeping the same UX semantics (bottom = newest, top = older).
          */}
            <ChatMessageList
              styles={styles}
              isDark={isDark}
              isWideChatLayout={isWideChatLayout}
              API_URL={API_URL}
              isGroup={isGroup}
              groupStatus={groupMeta?.meStatus}
              visibleMessagesCount={visibleMessages.length}
              messageListData={messageListData as any}
              webReady={webPinned.ready}
              webOnLayout={webPinned.onLayout}
              webOnContentSizeChange={webPinned.onContentSizeChange}
              webOnScrollSync={(e: unknown) => {
                if (webPinned.onScroll) webPinned.onScroll(e);
                if (!API_URL) return;
                if (!historyHasMore) return;
                if (historyLoading) return;
                const y = getNativeEventNumber(e, ['nativeEvent', 'contentOffset', 'y']);
                if (y <= 40) loadOlderHistory();
              }}
              setListRef={(r) => {
                messageListRef.current = r;
                webPinned.listRef.current = r;
              }}
              historyHasMore={historyHasMore}
              historyLoading={historyLoading}
              loadOlderHistory={loadOlderHistory}
              renderItem={({ item, index }) =>
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
                })
              }
            />
            <ChatComposer
              styles={styles}
              isDark={isDark}
              isDm={isDm}
              isGroup={isGroup}
              isEncryptedChat={isEncryptedChat}
              groupMeta={groupMeta}
              inlineEditTargetId={inlineEditTargetId}
              inlineEditUploading={inlineEditUploading}
              cancelInlineEdit={cancelInlineEdit}
              pendingMedia={pendingMedia}
              setPendingMedia={setPendingMediaItems}
              isUploading={isUploading}
              replyTarget={replyTarget}
              setReplyTarget={setReplyTarget}
              messages={messages}
              openViewer={openViewer}
              typingIndicatorText={typingIndicatorText}
              TypingIndicator={TypingIndicator}
              typingColor={isDark ? styles.typingTextDark.color : styles.typingText.color}
              mentionSuggestions={mentionSuggestions}
              insertMention={insertMention}
              composerSafeAreaStyle={composerSafeAreaStyle}
              composerHorizontalInsetsStyle={composerHorizontalInsetsStyle}
              isWideChatLayout={isWideChatLayout}
              textInputRef={textInputRef}
              inputEpoch={inputEpoch}
              input={input}
              onChangeInput={onChangeInput}
              isTypingRef={isTypingRef}
              sendTyping={sendTyping}
              sendMessage={sendMessage}
              handlePickMedia={handlePickMedia}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
      <ChatScreenOverlays
        isDark={isDark}
        styles={styles}
        insets={{ top: insets.top, bottom: insets.bottom }}
        aiSummary={aiSummary as any}
        aiConsentGate={aiConsentGate as any}
        runAiAction={runAiAction}
        attach={{
          open: attachOpen,
          setOpen: setAttachOpen,
          pickFromLibrary,
          openCamera,
          pickDocument,
        }}
        camera={{
          open: cameraOpen,
          setOpen: setCameraOpen,
          showAlert,
          onCaptured: handleInAppCameraCaptured,
        }}
        aiHelper={aiHelper as any}
        copyToClipboard={copyToClipboard}
        setInput={setInput}
        report={chatReport as any}
        cdnMedia={cdnMedia}
        messageActionMenu={messageActionMenu as any}
        myUserId={myUserId}
        myPublicKey={myPublicKey}
        displayName={displayName}
        isDm={isDm}
        encryptedPlaceholder={ENCRYPTED_PLACEHOLDER}
        normalizeUser={normalizeUser}
        mediaUrlByPath={mediaUrlByPath}
        dmThumbUriByPath={dmThumbUriByPath}
        quickReactions={[...QUICK_REACTIONS]}
        blockedSubsSet={blockedSubsSet}
        onBlockUserSub={onBlockUserSub}
        uiConfirm={uiConfirm}
        messageOps={
          {
            deleteForMe: deleteForMe,
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
          } as any
        }
        reactionPickerOpen={reactionPickerOpen}
        reactionPickerTarget={reactionPickerTarget}
        emojis={[...MORE_REACTIONS]}
        closeReactionPicker={closeReactionPicker}
        cipher={{ open: cipherOpen, text: cipherText, setOpen: setCipherOpen, setText: setCipherText }}
        reactionInfo={reactionInfo as any}
        nameBySub={nameBySub}
        info={{ infoOpen, infoTitle, infoBody, setInfoOpen }}
        ttl={{
          ttlPickerOpen,
          TTL_OPTIONS,
          ttlIdx,
          ttlIdxDraft,
          setTtlIdxDraft,
          setTtlPickerOpen,
          setTtlIdx,
        }}
        groupNameEditOpen={groupNameEditOpen}
        groupActionBusy={groupActionBusy}
        groupNameDraft={groupNameDraft}
        setGroupNameDraft={setGroupNameDraft}
        groupNameModalActions={groupNameModalActions as any}
        groupMembersOpen={groupMembersOpen}
        groupMeta={groupMeta as any}
        groupAddMembersDraft={groupAddMembersDraft}
        setGroupAddMembersDraft={setGroupAddMembersDraft}
        groupMembersModalActions={groupMembersModalActions as any}
        groupAddMembersInputRef={groupAddMembersInputRef}
        groupMembersVisible={groupMembersVisible as any}
        kickCooldownUntilBySub={kickCooldownUntilBySub}
        avatarUrlByPath={avatarUrlByPath}
        groupKick={groupKick}
        groupUpdate={groupUpdate}
        channelMembersOpen={channelMembersOpen}
        channelMembersVisible={channelMembersVisible as any}
        channelMeta={channelMeta as any}
        channelActionBusy={channelActionBusy}
        channelMembersModalActions={channelMembersModalActions as any}
        channelUpdate={channelUpdate}
        channelKick={channelKick}
        channelAboutOpen={channelAboutOpen}
        channelAboutEdit={channelAboutEdit}
        channelAboutDraft={channelAboutDraft}
        setChannelAboutDraft={setChannelAboutDraft}
        setChannelAboutEdit={setChannelAboutEdit}
        channelAboutModalActions={channelAboutModalActions as any}
        requestOpenLink={requestOpenLink}
        channelNameEditOpen={channelNameEditOpen}
        channelNameDraft={channelNameDraft}
        setChannelNameDraft={setChannelNameDraft}
        channelNameModalActions={channelNameModalActions as any}
        channelPasswordEditOpen={channelPasswordEditOpen}
        channelPasswordDraft={channelPasswordDraft}
        setChannelPasswordDraft={setChannelPasswordDraft}
        channelPasswordModalActions={channelPasswordModalActions as any}
        viewer={viewer as any}
        dmFileUriByPath={dmFileUriByPath}
        confirmLinkModal={confirmLinkModal}
        toast={toast}
        toastAnim={toastAnim as any}
      />
    </SafeAreaView>
  );
}
