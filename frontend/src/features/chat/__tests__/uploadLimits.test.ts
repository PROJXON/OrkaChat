// frontend/src/features/chat/__tests__/uploadsLimits.test.ts

import {
  assertWithinAttachmentHardLimit,
  getAttachmentHardLimitBytesForContentType,
  MAX_AUDIO_BYTES,
  MAX_FILE_BYTES,
} from '../uploads';

describe('uploads limits', () => {
  it('assertWithinAttachmentHardLimit throws when size is over limit', () => {
    // For non-image/video "file" attachments, the hard limit is MAX_FILE_BYTES.
    // Passing MAX_FILE_BYTES + 1 should trigger the error path.
    expect(() =>
      assertWithinAttachmentHardLimit('file', MAX_FILE_BYTES + 1, 'application/pdf'),
    ).toThrow(/File too large/);
  });

  it('assertWithinAttachmentHardLimit does not throw when size equals limit', () => {
    // Boundary test: exactly at the limit is allowed.
    expect(() =>
      assertWithinAttachmentHardLimit('file', MAX_FILE_BYTES, 'application/pdf'),
    ).not.toThrow();
  });

  it('audio/* content types get MAX_AUDIO_BYTES when kind is file', () => {
    // Special rule: audio attachments use MAX_AUDIO_BYTES even though kind is "file".
    expect(getAttachmentHardLimitBytesForContentType('file', 'audio/mpeg')).toBe(MAX_AUDIO_BYTES);

    // The implementation trims and strips parameters like "; charset=utf-8".
    expect(getAttachmentHardLimitBytesForContentType('file', ' audio/ogg; charset=utf-8 ')).toBe(
      MAX_AUDIO_BYTES,
    );
  });
});
