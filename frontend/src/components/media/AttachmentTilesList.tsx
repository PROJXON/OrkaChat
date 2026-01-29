import React from 'react';
import { View } from 'react-native';

import type { MediaItem } from '../../types/media';
import { isAudioContentType } from '../../features/chat/audioPlaybackQueue';
import { saveMediaUrlToDevice } from '../../utils/saveMediaToDevice';
import { AudioAttachmentTile } from './AudioAttachmentTile';
import { FileAttachmentTile } from './FileAttachmentTile';

type DownloadUrl = string | null | undefined;
type DownloadUrlGetter = (media: MediaItem, idx: number) => DownloadUrl | Promise<DownloadUrl>;

export type AttachmentTilesListAudioController = {
  currentKey: string | null;
  loadingKey: string | null;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number | null;
  getKey: (idx: number, media: MediaItem) => string;
  getTitle: (media: MediaItem) => string;
  onToggle: (args: { key: string; idx: number; media: MediaItem }) => void | Promise<void>;
  onSeek: (key: string, ms: number) => void | Promise<void>;
};

export function AttachmentTilesList(props: {
  messageId: string;
  items: Array<{ media: MediaItem; idx: number }>;
  isDark: boolean;
  isOutgoing: boolean;
  audio?: AttachmentTilesListAudioController;
  onPressFile: (idx: number, media: MediaItem) => void;
  onLongPressFile?: (e: unknown) => void;
  getDownloadUrl?: DownloadUrlGetter;
  onDownloadSuccess?: () => void;
  onDownloadError?: (msg: string) => void;
  gap?: number;
}): React.JSX.Element | null {
  const {
    messageId,
    items,
    isDark,
    isOutgoing,
    audio,
    onPressFile,
    onLongPressFile,
    getDownloadUrl,
    onDownloadSuccess,
    onDownloadError,
    gap = 8,
  } = props;

  if (!items.length) return null;

  return (
    <View style={{ gap }}>
      {items.map(({ media, idx }, renderIdx) => {
        const isAudio = isAudioContentType(media?.contentType);
        const keyBase = `${messageId}:${String(media?.path || '')}:${idx}:${renderIdx}`;

        const onDownload =
          getDownloadUrl && media?.path
            ? async () => {
                const url = await Promise.resolve(getDownloadUrl(media, idx));
                const safeUrl = String(url || '').trim();
                if (!safeUrl) return;
                await saveMediaUrlToDevice({
                  url: safeUrl,
                  kind: 'file',
                  fileName: media.fileName,
                  onSuccess: onDownloadSuccess,
                  onError: onDownloadError,
                });
              }
            : undefined;

        if (isAudio && audio) {
          const k = audio.getKey(idx, media);
          return (
            <AudioAttachmentTile
              key={`audio:${keyBase}`}
              isDark={isDark}
              isOutgoing={isOutgoing}
              onDownload={onDownload}
              state={{
                key: k,
                title: audio.getTitle(media),
                subtitle: undefined,
                isPlaying: audio.currentKey === k && audio.isPlaying,
                isLoading: audio.loadingKey === k,
                positionMs: audio.currentKey === k ? audio.positionMs : 0,
                durationMs:
                  audio.currentKey === k
                    ? (audio.durationMs ?? media.durationMs ?? null)
                    : (media.durationMs ?? null),
                onToggle: () => void audio.onToggle({ key: k, idx, media }),
                onSeek: (nextMs) => void audio.onSeek(k, nextMs),
              }}
            />
          );
        }

        return (
          <FileAttachmentTile
            key={`file:${keyBase}`}
            item={media}
            isDark={isDark}
            isOutgoing={isOutgoing}
            onPress={() => onPressFile(idx, media)}
            onLongPress={onLongPressFile}
            onDownload={onDownload}
          />
        );
      })}
    </View>
  );
}
