export type ConversationRow = {
  conversationId: string;
  peerDisplayName?: string;
};

export type UnreadRow = {
  user: string;
  count: number;
  senderSub?: string;
};

export type TitleOverrides = Record<string, string>;
