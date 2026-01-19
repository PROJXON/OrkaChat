import {
  attachmentLabelForMedia,
  defaultFileExtensionForContentType,
  fileBadgeForMedia,
  getPreviewKind,
  inferKindFromContentType,
  isImageLike,
  isPreviewableMedia,
  isVideoLike,
  previewLabelForMedia,
} from '../mediaKinds';

describe('mediaKinds', () => {
  describe('inferKindFromContentType', () => {
    it('treats image/* as image', () => {
      expect(inferKindFromContentType('image/png')).toBe('image');
      expect(inferKindFromContentType(' IMAGE/JPEG ')).toBe('image');
      expect(inferKindFromContentType('image/svg+xml')).toBe('image');
    });

    it('treats video/* as video', () => {
      expect(inferKindFromContentType('video/mp4')).toBe('video');
      expect(inferKindFromContentType(' VIDEO/QUICKTIME ')).toBe('video');
    });

    it('falls back to file for unknown/empty content types', () => {
      expect(inferKindFromContentType()).toBe('file');
      expect(inferKindFromContentType('')).toBe('file');
      expect(inferKindFromContentType('application/pdf')).toBe('file');
      expect(inferKindFromContentType('not-a-content-type')).toBe('file');
    });
  });

  describe('getPreviewKind', () => {
    it('returns kind when kind is not file (contentType does not override)', () => {
      expect(getPreviewKind({ kind: 'image', contentType: 'application/pdf' })).toBe('image');
      expect(getPreviewKind({ kind: 'video', contentType: 'image/png' })).toBe('video');
    });

    it("upgrades kind:'file' to image/video when contentType is image/* or video/*", () => {
      expect(getPreviewKind({ kind: 'file', contentType: 'image/png' })).toBe('image');
      expect(getPreviewKind({ kind: 'file', contentType: 'video/mp4' })).toBe('video');
    });

    it("keeps kind:'file' when contentType is not previewable", () => {
      expect(getPreviewKind({ kind: 'file', contentType: 'application/pdf' })).toBe('file');
      expect(getPreviewKind({ kind: 'file', contentType: '' })).toBe('file');
      expect(getPreviewKind({ kind: 'file', contentType: undefined })).toBe('file');
    });
  });

  describe('isImageLike / isVideoLike / isPreviewableMedia', () => {
    it('isImageLike is true only for previewKind=image', () => {
      expect(isImageLike({ kind: 'image', contentType: 'image/png' })).toBe(true);
      expect(isImageLike({ kind: 'file', contentType: 'image/png' })).toBe(true);
      expect(isImageLike({ kind: 'video', contentType: 'video/mp4' })).toBe(false);
      expect(isImageLike({ kind: 'file', contentType: 'application/pdf' })).toBe(false);
    });

    it('isVideoLike is true only for previewKind=video', () => {
      expect(isVideoLike({ kind: 'video', contentType: 'video/mp4' })).toBe(true);
      expect(isVideoLike({ kind: 'file', contentType: 'video/mp4' })).toBe(true);
      expect(isVideoLike({ kind: 'image', contentType: 'image/png' })).toBe(false);
      expect(isVideoLike({ kind: 'file', contentType: 'application/pdf' })).toBe(false);
    });

    it('isPreviewableMedia is true for image/video preview kinds, false otherwise', () => {
      expect(isPreviewableMedia({ kind: 'image', contentType: 'image/png' })).toBe(true);
      expect(isPreviewableMedia({ kind: 'video', contentType: 'video/mp4' })).toBe(true);
      expect(isPreviewableMedia({ kind: 'file', contentType: 'image/png' })).toBe(true);
      expect(isPreviewableMedia({ kind: 'file', contentType: 'video/mp4' })).toBe(true);
      expect(isPreviewableMedia({ kind: 'file', contentType: 'application/pdf' })).toBe(false);
    });
  });

  describe('defaultFileExtensionForContentType', () => {
    it('returns subtype for image/* and video/* (sanitized), with sensible defaults', () => {
      expect(defaultFileExtensionForContentType('image/png')).toBe('png');
      expect(defaultFileExtensionForContentType('image/')).toBe('jpg');
      expect(defaultFileExtensionForContentType('video/mp4')).toBe('mp4');
      expect(defaultFileExtensionForContentType('video/')).toBe('mp4');
    });

    it('strips parameters and unsafe characters from subtype', () => {
      expect(defaultFileExtensionForContentType('image/jpeg; charset=utf-8')).toBe('jpeg');
      expect(defaultFileExtensionForContentType('image/svg+xml; charset=utf-8')).toBe('svg+xml');
      expect(defaultFileExtensionForContentType('image/x-evil<>"; charset=utf-8')).toBe('x-evil');
    });

    it('returns useful extensions for common non-image/video content types', () => {
      expect(defaultFileExtensionForContentType('application/pdf')).toBe('pdf');
      expect(defaultFileExtensionForContentType('text/html; charset=utf-8')).toBe('html');
      expect(defaultFileExtensionForContentType('audio/mpeg')).toBe('mp3');
      // Unknown types fall back to the subtype if it looks usable, else bin.
      expect(defaultFileExtensionForContentType('application/unknown')).toBe('unknown');
      expect(defaultFileExtensionForContentType('')).toBe('bin');
      expect(defaultFileExtensionForContentType(undefined)).toBe('bin');
    });
  });

  describe('previewLabelForMedia', () => {
    it('returns Photo/Video/Attachment based on preview kind', () => {
      expect(previewLabelForMedia({ kind: 'image', contentType: 'image/png' })).toBe('Photo');
      expect(previewLabelForMedia({ kind: 'video', contentType: 'video/mp4' })).toBe('Video');
      expect(previewLabelForMedia({ kind: 'file', contentType: 'application/pdf' })).toBe(
        'Attachment',
      );
      // "file" but image/* should still be Photo (preview upgrade)
      expect(previewLabelForMedia({ kind: 'file', contentType: 'image/png' })).toBe('Photo');
    });
  });

  describe('fileBadgeForMedia / attachmentLabelForMedia', () => {
    it('labels PDFs and Office docs usefully', () => {
      expect(
        fileBadgeForMedia({ kind: 'file', contentType: 'application/pdf', fileName: 'x' }),
      ).toBe('PDF');
      expect(
        fileBadgeForMedia({ kind: 'file', contentType: undefined, fileName: 'Resume.docx' }),
      ).toBe('DOCX');
      expect(
        attachmentLabelForMedia({ kind: 'file', contentType: 'application/pdf', fileName: 'x' }),
      ).toBe('PDF');
    });

    it('labels audio files', () => {
      expect(
        attachmentLabelForMedia({ kind: 'file', contentType: 'audio/mpeg', fileName: 'v.mp3' }),
      ).toBe('MP3');
      expect(fileBadgeForMedia({ kind: 'file', contentType: 'audio/ogg', fileName: 'v.ogg' })).toBe(
        'OGG',
      );
    });
  });
});
