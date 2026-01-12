export type MediaKind = 'image' | 'video' | 'file';

export type MediaItem = {
  path: string;
  thumbPath?: string;
  kind: MediaKind;
  contentType?: string;
  thumbContentType?: string;
  fileName?: string;
  size?: number;
};
