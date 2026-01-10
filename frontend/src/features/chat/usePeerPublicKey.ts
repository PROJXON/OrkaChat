import * as React from 'react';
import { fetchAuthSession } from '@aws-amplify/auth';

function parseDmPeerSub(convId: string, mySub: string | null): string | null {
  if (!mySub) return null;
  if (!convId.startsWith('dm#')) return null;
  const parts = convId
    .split('#')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length !== 3) return null;
  const a = parts[1];
  const b = parts[2];
  if (a === mySub) return b;
  if (b === mySub) return a;
  return null;
}

export function usePeerPublicKey(opts: {
  enabled: boolean;
  apiUrl: string;
  activeConversationId: string;
  myUserId: string | null;
  peer: string | null | undefined;
}): string | null {
  const enabled = !!opts.enabled;
  const apiUrl = String(opts.apiUrl || '');
  const activeConversationId = String(opts.activeConversationId || '');
  const myUserId = opts.myUserId;
  const peer = typeof opts.peer === 'string' && opts.peer.trim() ? opts.peer.trim() : null;

  const [peerPublicKey, setPeerPublicKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      if (!peer || !apiUrl || !enabled) {
        setPeerPublicKey(null);
        return;
      }
      // Clear any previously cached key so we don't encrypt to the wrong recipient if peer changes.
      setPeerPublicKey(null);
      try {
        const { tokens } = await fetchAuthSession();
        const idToken = tokens?.idToken?.toString();
        if (!idToken) return;

        const peerSub = parseDmPeerSub(activeConversationId, myUserId);
        const controller = new AbortController();
        const currentPeer = peer;
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const cleanup = () => clearTimeout(timeoutId);
        const base = apiUrl.replace(/\/$/, '');
        const url = peerSub ? `${base}/users?sub=${encodeURIComponent(peerSub)}` : `${base}/users?username=${encodeURIComponent(peer)}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${idToken}` },
          signal: controller.signal,
        });
        cleanup();
        if (!res.ok) {
          setPeerPublicKey(null);
          return;
        }
        const data = await res.json();
        // Source of truth: DynamoDB Users.currentPublicKey (returned as `public_key`).
        // (We intentionally do not fall back to Cognito custom attributes here.)
        const pk = (data.public_key as string | undefined) || (data.publicKey as string | undefined);
        // Only apply if peer hasn't changed mid-request
        if (currentPeer === peer) {
          setPeerPublicKey(typeof pk === 'string' && pk.length > 0 ? pk : null);
        }
      } catch {
        setPeerPublicKey(null);
      }
    })();
  }, [peer, enabled, apiUrl, activeConversationId, myUserId]);

  return peerPublicKey;
}

export function useHydratePeerPublicKey(opts: {
  enabled: boolean;
  apiUrl: string;
  activeConversationId: string;
  myUserId: string | null;
  peer: string | null | undefined;
  setPeerPublicKey: React.Dispatch<React.SetStateAction<string | null>>;
}): void {
  const enabled = !!opts.enabled;
  const apiUrl = String(opts.apiUrl || '');
  const activeConversationId = String(opts.activeConversationId || '');
  const myUserId = opts.myUserId;
  const peer = typeof opts.peer === 'string' && opts.peer.trim() ? opts.peer.trim() : null;
  const setPeerPublicKey = opts.setPeerPublicKey;

  React.useEffect(() => {
    (async () => {
      if (!peer || !apiUrl || !enabled) {
        setPeerPublicKey(null);
        return;
      }
      // Clear any previously cached key so we don't encrypt to the wrong recipient if peer changes.
      setPeerPublicKey(null);
      try {
        const { tokens } = await fetchAuthSession();
        const idToken = tokens?.idToken?.toString();
        if (!idToken) return;

        const peerSub = parseDmPeerSub(activeConversationId, myUserId);
        const controller = new AbortController();
        const currentPeer = peer;
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const cleanup = () => clearTimeout(timeoutId);
        const base = apiUrl.replace(/\/$/, '');
        const url = peerSub ? `${base}/users?sub=${encodeURIComponent(peerSub)}` : `${base}/users?username=${encodeURIComponent(peer)}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${idToken}` },
          signal: controller.signal,
        });
        cleanup();
        if (!res.ok) {
          setPeerPublicKey(null);
          return;
        }
        const data = await res.json();
        const pk = (data.public_key as string | undefined) || (data.publicKey as string | undefined);
        if (currentPeer === peer) {
          setPeerPublicKey(typeof pk === 'string' && pk.length > 0 ? pk : null);
        }
      } catch {
        setPeerPublicKey(null);
      }
    })();
  }, [peer, enabled, apiUrl, activeConversationId, myUserId, setPeerPublicKey]);
}

