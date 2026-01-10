export interface KeyPair {
  privateKey: string;
  publicKey: string;
}

export interface BackupBlob {
  ciphertext: string;
  iv: string;
  salt: string;
}

export type EncryptedChatPayloadV1 = {
  v: 1;
  alg: 'secp256k1-ecdh+aes-256-gcm';
  iv: string; // hex (12 bytes)
  ciphertext: string; // hex (ciphertext + authTag)
  senderPublicKey: string; // hex (uncompressed or compressed)
  // New (optional): store the recipient public key used during encryption.
  // This makes old *sent* messages decryptable even if the peer rotates keys later.
  recipientPublicKey?: string; // hex
};
