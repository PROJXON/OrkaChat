import type { MediaItem } from '../../types/media';
import type { ReactionMap, ReactionUsersMap } from '../../types/reactions';

export type GuestMessage = {
  id: string;
  user: string;
  userSub?: string;
  avatarBgColor?: string;
  avatarTextColor?: string;
  avatarImagePath?: string;
  text: string;
  createdAt: number;
  editedAt?: number;
  reactions?: ReactionMap;
  reactionUsers?: ReactionUsersMap;
  // Backward-compat: historically we supported only a single attachment per message.
  // New messages can include multiple attachments; use `mediaList` when present.
  media?: MediaItem;
  mediaList?: MediaItem[];
};

export type GuestChannelMeta = {
  channelId: string;
  conversationId: string;
  name?: string;
  aboutText?: string;
  aboutVersion?: number;
};

export type GuestChatEnvelope = {
  type: 'chat';
  text?: string;
  // Backward-compat: `media` may be a single object (v1) or an array (v2+).
  media?: MediaItem | MediaItem[];
};

export type GuestHistoryPage = {
  items: GuestMessage[];
  hasMore: boolean;
  nextCursor: number | null;
  channelMeta?: GuestChannelMeta;
};
