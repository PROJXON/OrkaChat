import { fetchUserAttributes } from 'aws-amplify/auth';
import * as React from 'react';

import type { AmplifyUiUser } from '../../types/amplifyUi';
import { derivePublicKey, loadKeyPair } from '../../utils/crypto';

export function useChatMyKeys(opts: { user: AmplifyUiUser; keyEpoch?: number }): {
  myUserId: string | null;
  myPrivateKey: string | null;
  myPublicKey: string | null;
} {
  const { user, keyEpoch } = opts;
  const [myUserId, setMyUserId] = React.useState<string | null>(null);
  const [myPrivateKey, setMyPrivateKey] = React.useState<string | null>(null);
  const [myPublicKey, setMyPublicKey] = React.useState<string | null>(null);

  const refreshMyKeys = React.useCallback(async (sub: string) => {
    const kp = await loadKeyPair(sub);
    setMyPrivateKey(kp?.privateKey ?? null);
    setMyPublicKey(kp?.privateKey ? derivePublicKey(kp.privateKey) : null);
  }, []);

  React.useEffect(() => {
    (async () => {
      try {
        const attrs = await fetchUserAttributes();
        const sub = typeof attrs.sub === 'string' ? attrs.sub : undefined;
        if (sub) {
          setMyUserId(sub);
          await refreshMyKeys(sub);
        }
      } catch {
        // ignore
      }
    })();
  }, [user, keyEpoch, refreshMyKeys]);

  // If ChatScreen mounts before App.tsx finishes generating/storing keys, retry a few times.
  React.useEffect(() => {
    if (!myUserId || myPrivateKey) return;
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 20; // ~10s
    const tick = async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        const kp = await loadKeyPair(myUserId);
        if (kp?.privateKey) {
          setMyPrivateKey(kp.privateKey);
          setMyPublicKey(derivePublicKey(kp.privateKey));
          return;
        }
      } catch {
        // ignore
      }
      if (!cancelled && !myPrivateKey && attempts < maxAttempts) {
        setTimeout(tick, 500);
      }
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [myUserId, myPrivateKey, keyEpoch]);

  return React.useMemo(
    () => ({ myUserId, myPrivateKey, myPublicKey }),
    [myUserId, myPrivateKey, myPublicKey],
  );
}
