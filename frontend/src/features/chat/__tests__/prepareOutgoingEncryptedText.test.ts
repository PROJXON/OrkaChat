// frontend/src/features/chat/__tests__/prepareOutgoingEncryptedText.test.ts

import { prepareDmOutgoingEncryptedText } from '../prepareOutgoingEncryptedText';

// We mock encryptChatMessageV1 so this test isn't coupled to crypto randomness.
// It just needs to prove we call encryption with the expected plaintext envelope.
jest.mock('../../../utils/crypto', () => ({
  encryptChatMessageV1: jest.fn(() => ({
    v: 1,
    alg: 'secp256k1-ecdh+aes-256-gcm',
    iv: '00'.repeat(12),
    ciphertext: 'aa',
    senderPublicKey: '04' + '11'.repeat(64),
    recipientPublicKey: '04' + '22'.repeat(64),
  })),
  derivePublicKey: jest.fn(() => '04' + '11'.repeat(64)),
  aesGcmEncryptBytes: jest.fn(),
}));

describe('prepareDmOutgoingEncryptedText', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('returns original text when there is no pending media', async () => {
    const out = await prepareDmOutgoingEncryptedText({
      conversationId: 'c1',
      outgoingText: 'hello',
      pendingMedia: [],
      caption: '',
      myPrivateKey: 'priv',
      peerPublicKey: 'peerPub',
      uploadPendingMediaDmEncrypted: jest.fn(),
    });

    expect(out).toEqual({ outgoingText: 'hello', mediaPathsToSend: undefined });
  });

  it('uploads each pending item and returns encrypted envelope text + mediaPathsToSend', async () => {
    const uploadPendingMediaDmEncrypted = jest.fn(
      async (
        item: any,
        _conversationId: string,
        _myPriv: string,
        _peerPub: string,
        _caption?: string,
      ) => ({
        type: 'dm_media_v1' as const,
        v: 1 as const,
        caption: 'cap',
        media: {
          kind: 'image' as const,
          contentType: 'image/png',
          fileName: 'a.png',
          path: `enc/${item.uri}`,
          iv: '11',
          thumbPath: `thumb/${item.uri}`,
          thumbIv: '22',
          thumbContentType: 'image/jpeg',
        },
        wrap: { iv: '33', ciphertext: '44' },
      }),
    );

    const out = await prepareDmOutgoingEncryptedText({
      conversationId: 'c1',
      outgoingText: 'ignored when media exists',
      pendingMedia: [{ uri: 'u1' }, { uri: 'u2' }] as any,
      caption: 'cap',
      myPrivateKey: 'priv',
      peerPublicKey: 'peerPub',
      uploadPendingMediaDmEncrypted,
    });

    // Called once per item (this is the orchestration we care about).
    expect(uploadPendingMediaDmEncrypted).toHaveBeenCalledTimes(2);

    // Outgoing text should be JSON of the encrypted payload object returned by our mock.
    expect(() => JSON.parse(out.outgoingText)).not.toThrow();
    const parsed = JSON.parse(out.outgoingText);
    expect(parsed).toMatchObject({ v: 1, alg: 'secp256k1-ecdh+aes-256-gcm' });

    // mediaPathsToSend should include both path + thumbPath for each upload.
    expect(out.mediaPathsToSend).toEqual(['enc/u1', 'thumb/u1', 'enc/u2', 'thumb/u2']);
  });

  it('uses v2 envelope when there are multiple media items', async () => {
    const uploadPendingMediaDmEncrypted = jest.fn(async (item: any) => ({
      type: 'dm_media_v1' as const,
      v: 1 as const,
      caption: 'cap',
      media: { kind: 'image' as const, path: `enc/${item.uri}`, iv: '11' },
      wrap: { iv: '33', ciphertext: '44' },
    }));

    const out = await prepareDmOutgoingEncryptedText({
      conversationId: 'c1',
      outgoingText: 'x',
      pendingMedia: [{ uri: 'u1' }, { uri: 'u2' }] as any,
      caption: 'cap',
      myPrivateKey: 'priv',
      peerPublicKey: 'peerPub',
      uploadPendingMediaDmEncrypted,
    });

    // We can’t see plaintext envelope directly (it gets encrypted),
    // but we CAN assert the encrypt function was called once.
    const { encryptChatMessageV1 } = require('../../../utils/crypto');
    expect(encryptChatMessageV1).toHaveBeenCalledTimes(1);

    const firstCall = (encryptChatMessageV1 as jest.Mock).mock.calls[0];
    const plaintextEnvelope = firstCall[0]; // arg0 to encryptChatMessageV1(...)
    const dmAny = JSON.parse(plaintextEnvelope);

    expect(dmAny.type).toBe('dm_media_v2');
    expect(dmAny.v).toBe(2);
    expect(Array.isArray(dmAny.items)).toBe(true);
    expect(dmAny.items).toHaveLength(2);

    // And the outgoing text is still a valid encrypted JSON payload.
    expect(() => JSON.parse(out.outgoingText)).not.toThrow();
  });
});
