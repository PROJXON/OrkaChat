import * as React from 'react';

import type { BackupBlob } from '../../../types/crypto';

export function useAuthApiHelpers({
  apiUrl,
  fetchAuthSession,
  encryptPrivateKey,
}: {
  apiUrl: string;
  fetchAuthSession: () => Promise<{ tokens?: { idToken?: { toString: () => string } } }>;
  encryptPrivateKey: (privateKeyHex: string, passphrase: string) => Promise<BackupBlob>;
}): {
  uploadRecoveryBlob: (token: string, privateKeyHex: string, passphrase: string) => Promise<void>;
  checkRecoveryBlobExists: (token: string) => Promise<boolean | null>;
  getIdTokenWithRetry: (opts?: { maxAttempts?: number; delayMs?: number }) => Promise<string | null>;
  uploadPublicKey: (token: string | undefined, publicKey: string) => Promise<void>;
} {
  const uploadRecoveryBlob = React.useCallback(
    async (token: string, privateKeyHex: string, passphrase: string) => {
      const t0 = Date.now();
      console.log('encrypting backup...');
      const blob = await encryptPrivateKey(privateKeyHex, passphrase);
      console.log('backup encrypted in', Date.now() - t0, 'ms');

      const controller = new AbortController();
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        const fetchPromise = fetch(`${apiUrl.replace(/\/$/, '')}/users/recovery`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(blob),
          signal: controller.signal,
        });

        const timeoutPromise = new Promise<Response>((_, reject) => {
          timeoutId = setTimeout(() => {
            try {
              controller.abort();
            } catch {
              // ignore
            }
            reject(new Error('createRecovery timed out'));
          }, 20000);
        });

        const resp = await Promise.race([fetchPromise, timeoutPromise]);

        if (!resp.ok) {
          const text = await resp.text().catch(() => '');
          console.warn('createRecovery non-2xx', resp.status, text);
          throw new Error(`createRecovery failed (${resp.status})`);
        }
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    },
    [apiUrl, encryptPrivateKey]
  );

  const checkRecoveryBlobExists = React.useCallback(
    async (token: string): Promise<boolean | null> => {
      if (!apiUrl) return null;
      const url = `${apiUrl.replace(/\/$/, '')}/users/recovery`;
      // Web/dev fix: many API Gateway deployments don't enable CORS for HEAD (preflight fails),
      // so use GET which is already supported by our handlers.
      try {
        const resp = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
        if (resp.ok) return true;
        if (resp.status === 404) {
          console.log('recovery blob exists check: 404');
          return false;
        }
        console.log('recovery blob exists check: unexpected status', resp.status);
        return null;
      } catch {
        console.log('recovery blob exists check: network error');
        return null;
      }
    },
    [apiUrl]
  );

  const getIdTokenWithRetry = React.useCallback(
    async (opts?: { maxAttempts?: number; delayMs?: number }): Promise<string | null> => {
      const maxAttempts = Math.max(1, Math.floor(opts?.maxAttempts ?? 8));
      const delayMs = Math.max(0, Math.floor(opts?.delayMs ?? 200));
      for (let i = 0; i < maxAttempts; i++) {
        try {
          const token = (await fetchAuthSession()).tokens?.idToken?.toString();
          if (token) return token;
        } catch {
          // ignore and retry
        }
        if (i < maxAttempts - 1 && delayMs > 0) {
          // Small backoff to allow Amplify to rehydrate the session after a Metro refresh.
          await new Promise<void>((resolve) => setTimeout(resolve, delayMs * (i + 1)));
        }
      }
      return null;
    },
    [fetchAuthSession]
  );

  const uploadPublicKey = React.useCallback(
    async (token: string | undefined, publicKey: string) => {
      if (!token) {
        console.warn('uploadPublicKey: missing idToken');
        return;
      }
      const resp = await fetch(`${apiUrl.replace(/\/$/, '')}/users/public-key`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ publicKey }),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        console.warn('uploadPublicKey non-2xx', resp.status, text);
      }
    },
    [apiUrl]
  );

  return { uploadRecoveryBlob, checkRecoveryBlobExists, getIdTokenWithRetry, uploadPublicKey };
}

