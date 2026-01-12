import type { ChatMessage, DmMediaEnvelopeV1, GroupMediaEnvelopeV1 } from './types';

export type ChatGlobalViewerItem = {
  url: string;
  kind: 'image' | 'video' | 'file';
  fileName?: string;
};

export type ChatDmViewerItem = {
  media: DmMediaEnvelopeV1['media'];
  wrap: DmMediaEnvelopeV1['wrap'];
};

export type ChatGdmViewerItem = {
  media: GroupMediaEnvelopeV1['media'];
  wrap: GroupMediaEnvelopeV1['wrap'];
};

export type ChatMediaViewerState = null | {
  mode: 'global' | 'dm' | 'gdm';
  title?: string;
  index: number;
  globalItems?: ChatGlobalViewerItem[];
  dmMsg?: ChatMessage;
  dmItems?: ChatDmViewerItem[];
  gdmMsg?: ChatMessage;
  gdmItems?: ChatGdmViewerItem[];
};

