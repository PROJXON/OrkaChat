// frontend/src/features/chat/__tests__/attachments.test.ts

import {
  pendingMediaFromDocumentPickerAssets,
  pendingMediaFromImagePickerAssets,
  pendingMediaFromInAppCameraCapture,
} from '../attachments';

describe('attachments (pending media builders)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('pendingMediaFromImagePickerAssets', () => {
    it('filters out items with missing/empty uri', () => {
      const out = pendingMediaFromImagePickerAssets([
        { uri: '' },
        { uri: 'file://ok.png', type: 'image', fileName: 'ok.png' },
        {} as any,
      ]);

      expect(out).toHaveLength(1);
      expect(out[0].uri).toBe('file://ok.png');
    });

    it('maps type -> kind (video/image/other -> file) and prefers mimeType for contentType', () => {
      const out = pendingMediaFromImagePickerAssets([
        {
          uri: 'file://v1',
          type: 'video',
          fileName: 'clip.mp4',
          mimeType: 'video/mp4',
          fileSize: 123,
        },
        {
          uri: 'file://i1',
          type: 'image',
          fileName: 'pic.png',
          mimeType: 'image/png',
          fileSize: 456,
        },
        {
          uri: 'file://f1',
          type: 'something-else',
          fileName: 'doc.bin',
          mimeType: 'application/octet-stream',
        },
      ]);

      expect(out).toEqual([
        expect.objectContaining({
          uri: 'file://v1',
          kind: 'video',
          contentType: 'video/mp4',
          fileName: 'clip.mp4',
          displayName: 'clip.mp4',
          source: 'library',
          size: 123,
        }),
        expect.objectContaining({
          uri: 'file://i1',
          kind: 'image',
          contentType: 'image/png',
          fileName: 'pic.png',
          displayName: 'pic.png',
          source: 'library',
          size: 456,
        }),
        expect.objectContaining({
          uri: 'file://f1',
          kind: 'file',
          contentType: 'application/octet-stream',
          fileName: 'doc.bin',
          displayName: 'doc.bin',
          source: 'library',
        }),
      ]);
    });

    it('falls back to guessing contentType from fileName when mimeType is missing', () => {
      const out = pendingMediaFromImagePickerAssets([
        { uri: 'file://a', type: 'image', fileName: 'a.JPG' }, // case-insensitive guess
        { uri: 'file://b', type: 'video', fileName: 'b.mov' },
      ]);

      expect(out[0]).toEqual(
        expect.objectContaining({
          kind: 'image',
          contentType: 'image/jpeg',
        }),
      );
      expect(out[1]).toEqual(
        expect.objectContaining({
          kind: 'video',
          contentType: 'video/quicktime',
        }),
      );
    });
  });

  describe('pendingMediaFromDocumentPickerAssets', () => {
    it('filters out items with missing/empty uri', () => {
      const out = pendingMediaFromDocumentPickerAssets([
        { uri: '' },
        { uri: 'file://ok.pdf', name: 'ok.pdf', mimeType: 'application/pdf' },
        {} as any,
      ]);

      expect(out).toHaveLength(1);
      expect(out[0].uri).toBe('file://ok.pdf');
    });

    it('uses mimeType when present and infers kind from contentType', () => {
      const out = pendingMediaFromDocumentPickerAssets([
        { uri: 'file://p', name: 'p', mimeType: 'image/png' },
        { uri: 'file://v', name: 'v', mimeType: 'video/mp4' },
        { uri: 'file://f', name: 'f', mimeType: 'application/pdf' },
      ]);

      expect(out[0]).toEqual(
        expect.objectContaining({ kind: 'image', contentType: 'image/png', source: 'file' }),
      );
      expect(out[1]).toEqual(
        expect.objectContaining({ kind: 'video', contentType: 'video/mp4', source: 'file' }),
      );
      expect(out[2]).toEqual(
        expect.objectContaining({ kind: 'file', contentType: 'application/pdf', source: 'file' }),
      );
    });

    it('falls back to guessing contentType from name when mimeType is missing', () => {
      const out = pendingMediaFromDocumentPickerAssets([
        { uri: 'file://a', name: 'a.png' },
        { uri: 'file://b', name: 'b.mp4' },
        { uri: 'file://c', name: 'c.unknown' },
      ]);

      expect(out[0]).toEqual(expect.objectContaining({ contentType: 'image/png', kind: 'image' }));
      expect(out[1]).toEqual(expect.objectContaining({ contentType: 'video/mp4', kind: 'video' }));
      expect(out[2]).toEqual(expect.objectContaining({ contentType: undefined, kind: 'file' }));
    });
  });

  describe('pendingMediaFromInAppCameraCapture', () => {
    it('creates a stable camera fileName using Date.now and sets source/displayName', () => {
      jest.spyOn(Date, 'now').mockReturnValue(1700000000000);

      const out = pendingMediaFromInAppCameraCapture({ uri: 'file://cam', mode: 'photo' });

      expect(out).toEqual(
        expect.objectContaining({
          uri: 'file://cam',
          kind: 'image',
          fileName: 'camera-1700000000000.jpg',
          displayName: 'From Camera',
          source: 'camera',
          contentType: 'image/jpeg',
        }),
      );
    });

    it('uses mp4 + video contentType for video mode', () => {
      jest.spyOn(Date, 'now').mockReturnValue(1700000000123);

      const out = pendingMediaFromInAppCameraCapture({ uri: 'file://cam2', mode: 'video' });

      expect(out).toEqual(
        expect.objectContaining({
          kind: 'video',
          fileName: 'camera-1700000000123.mp4',
          contentType: 'video/mp4',
        }),
      );
    });
  });
});
