// frontend/src/features/chat/__tests__/uploads.test.ts

import {
  formatBytes,
  getAttachmentHardLimitBytes,
  getAttachmentHardLimitBytesForContentType,
  guessContentTypeFromName,
  MAX_AUDIO_BYTES,
  MAX_FILE_BYTES,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
} from '../uploads';

describe('uploads utils', () => {
  describe('guessContentTypeFromName', () => {
    it('returns undefined for empty/unknown names', () => {
      expect(guessContentTypeFromName()).toBeUndefined();
      expect(guessContentTypeFromName('')).toBeUndefined();
      expect(guessContentTypeFromName('file.unknownext')).toBeUndefined();
    });

    it('is case-insensitive and matches common image extensions', () => {
      expect(guessContentTypeFromName('a.JPG')).toBe('image/jpeg');
      expect(guessContentTypeFromName('a.jpeg')).toBe('image/jpeg');
      expect(guessContentTypeFromName('a.png')).toBe('image/png');
      expect(guessContentTypeFromName('a.GIF')).toBe('image/gif');
      expect(guessContentTypeFromName('a.webp')).toBe('image/webp');
    });

    it('matches common video extensions', () => {
      expect(guessContentTypeFromName('a.mp4')).toBe('video/mp4');
      expect(guessContentTypeFromName('a.MOV')).toBe('video/quicktime');
      expect(guessContentTypeFromName('a.m4v')).toBe('video/x-m4v');
    });
  });

  describe('formatBytes', () => {
    it('handles invalid/negative', () => {
      expect(formatBytes(NaN)).toBe('0 B');
      expect(formatBytes(-1)).toBe('0 B');
    });

    it('formats bytes with expected units and rounding rules', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(1)).toBe('1 B');
      expect(formatBytes(1023)).toBe('1023 B');
      expect(formatBytes(1024)).toBe('1.0 KB');
      expect(formatBytes(1536)).toBe('1.5 KB'); // 1.5 KB
      expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    });
  });

  describe('attachment hard limits', () => {
    it('getAttachmentHardLimitBytes matches constants by kind', () => {
      expect(getAttachmentHardLimitBytes('image')).toBe(MAX_IMAGE_BYTES);
      expect(getAttachmentHardLimitBytes('video')).toBe(MAX_VIDEO_BYTES);
      expect(getAttachmentHardLimitBytes('file')).toBe(MAX_FILE_BYTES);
    });

    it('audio/* content types get MAX_AUDIO_BYTES when kind is not image/video', () => {
      expect(getAttachmentHardLimitBytesForContentType('file', 'audio/mpeg')).toBe(MAX_AUDIO_BYTES);
      expect(getAttachmentHardLimitBytesForContentType('file', ' audio/ogg; charset=utf-8 ')).toBe(
        MAX_AUDIO_BYTES,
      );
    });

    it('non-audio content types fall back to kind limits', () => {
      expect(getAttachmentHardLimitBytesForContentType('file', 'application/pdf')).toBe(
        MAX_FILE_BYTES,
      );
      expect(getAttachmentHardLimitBytesForContentType('image', 'audio/mpeg')).toBe(
        MAX_IMAGE_BYTES,
      );
      expect(getAttachmentHardLimitBytesForContentType('video', 'audio/mpeg')).toBe(
        MAX_VIDEO_BYTES,
      );
    });
  });
});
