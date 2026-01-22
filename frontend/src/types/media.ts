export type MediaKind = 'image' | 'video' | 'file';

export type MediaItem = {
  path: string;
  thumbPath?: string;
  kind: MediaKind;
  contentType?: string;
  thumbContentType?: string;
  fileName?: string;
  size?: number;
  /**
   * Duration of the media in milliseconds (primarily used for audio playback UI).
   * Optional for backward compatibility.
   */
  durationMs?: number;
};
