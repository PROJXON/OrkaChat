import * as React from 'react';

import type { MediaItem } from '../../types/media';
import type { PendingMediaItem } from './attachments';
import type { DmMediaEnvelopeV1, GroupMediaEnvelopeV1 } from './types';
import {
  uploadChannelMediaPlain,
  uploadDmMediaEncrypted,
  uploadGroupMediaEncrypted,
} from './uploadMedia';

export function useChatUploadHandlers(opts: { activeConversationId: string; input: string }): {
  uploadPendingMedia: (media: PendingMediaItem) => Promise<MediaItem>;
  uploadPendingMediaDmEncrypted: (
    media: PendingMediaItem,
    conversationKey: string,
    senderPrivateKeyHex: string,
    recipientPublicKeyHex: string,
    captionOverride?: string,
  ) => Promise<DmMediaEnvelopeV1>;
  uploadPendingMediaGroupEncrypted: (
    media: PendingMediaItem,
    conversationKey: string,
    messageKeyBytes: Uint8Array,
    captionOverride?: string,
  ) => Promise<GroupMediaEnvelopeV1>;
} {
  const { activeConversationId, input } = opts;

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

  return { uploadPendingMedia, uploadPendingMediaDmEncrypted, uploadPendingMediaGroupEncrypted };
}
