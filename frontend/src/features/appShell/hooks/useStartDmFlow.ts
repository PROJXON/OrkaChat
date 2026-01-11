import * as React from 'react';

export function useStartDmFlow({
  apiUrl,
  peerInput,
  currentUsername,
  blockedSubs,
  fetchAuthSession,
  fetchUserAttributes,
  setPeer,
  setConversationId,
  upsertDmThread,
  setSearchOpen,
  setPeerInput,
  setSearchError,
}: {
  apiUrl: string;
  peerInput: string;
  currentUsername: string;
  blockedSubs: string[];
  fetchAuthSession: () => Promise<any>;
  fetchUserAttributes: () => Promise<any>;
  setPeer: (v: string | null) => void;
  setConversationId: (v: string) => void;
  upsertDmThread: (convId: string, peerName: string, lastActivityAt?: number) => void;
  setSearchOpen: (v: boolean) => void;
  setPeerInput: (v: string) => void;
  setSearchError: (v: string | null) => void;
}): { startDM: () => Promise<void> } {
  const startDM = React.useCallback(async () => {
    const raw = peerInput.trim();
    const normalizedCurrent = currentUsername.trim().toLowerCase();
    if (!raw) {
      setSearchError('Enter a username');
      return;
    }

    // Support group DMs: comma/space separated usernames.
    const tokens = raw
      .split(/[,\s]+/g)
      .map((t) => t.trim())
      .filter(Boolean);
    const normalizedTokens = Array.from(new Set(tokens.map((t) => t.toLowerCase())));

    // 1:1 DM (existing behavior)
    if (normalizedTokens.length === 1) {
      const trimmed = tokens[0];
      const normalizedInput = trimmed.toLowerCase();
      if (!trimmed || normalizedInput === normalizedCurrent) {
        setSearchError(normalizedInput === normalizedCurrent ? 'Not you silly!' : 'Enter a username');
        return;
      }

      const { tokens: authTokens } = await fetchAuthSession();
      const idToken = authTokens?.idToken?.toString();
      if (!idToken) {
        setSearchError('Unable to authenticate');
        return;
      }

      const res = await fetch(`${apiUrl.replace(/\/$/, '')}/users?username=${encodeURIComponent(trimmed)}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.status === 404) {
        setSearchError('No such user!');
        return;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.warn('getUser failed', res.status, text);
        let msg = text;
        try {
          const parsed = text ? JSON.parse(text) : null;
          if (parsed && typeof parsed.message === 'string') msg = parsed.message;
        } catch {
          // ignore
        }
        setSearchError(msg ? `User lookup failed (${res.status}): ${msg}` : `User lookup failed (${res.status})`);
        return;
      }

      const data = await res.json();
      const peerSub = String(data.sub || data.userSub || '').trim();
      const canonical = String(data.displayName || data.preferred_username || data.username || trimmed).trim();
      if (!peerSub) {
        console.warn('getUser ok but missing sub', data);
        setSearchError('User lookup missing sub (check getUser response JSON)');
        return;
      }
      if (blockedSubs.includes(peerSub)) {
        setSearchError('That user is in your Blocklist. Unblock them to start a DM.');
        return;
      }
      const normalizedCanonical = canonical.toLowerCase();
      if (normalizedCanonical === normalizedCurrent) {
        setSearchError('Not you silly!');
        return;
      }
      const mySub = (await fetchUserAttributes()).sub as string | undefined;
      if (!mySub) {
        setSearchError('Unable to authenticate');
        return;
      }
      if (peerSub === mySub) {
        setSearchError('Not you silly!');
        return;
      }
      const [a, b] = [mySub, peerSub].sort();
      const id = `dm#${a}#${b}`;
      setPeer(canonical);
      setConversationId(id);
      upsertDmThread(id, canonical, Date.now());
      setSearchOpen(false);
      setPeerInput('');
      setSearchError(null);
      return;
    }

    // Group DM start
    if (normalizedTokens.length > 7) {
      setSearchError('Too many members (max 8 including you).');
      return;
    }
    if (normalizedTokens.includes(normalizedCurrent)) {
      setSearchError("Don't include yourself.");
      return;
    }

    const { tokens: authTokens } = await fetchAuthSession();
    const idToken = authTokens?.idToken?.toString();
    if (!idToken) {
      setSearchError('Unable to authenticate');
      return;
    }

    const res = await fetch(`${apiUrl.replace(/\/$/, '')}/groups/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: normalizedTokens }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let msg = text;
      try {
        const parsed = text ? JSON.parse(text) : null;
        if (parsed && typeof parsed.message === 'string') msg = parsed.message;
      } catch {
        // ignore
      }
      setSearchError(msg ? `Group start failed (${res.status}): ${msg}` : `Group start failed (${res.status})`);
      return;
    }
    const data = await res.json().catch(() => ({}));
    const convId = String((data as any).conversationId || '').trim();
    const title = String((data as any).title || 'Group DM').trim();
    if (!convId) {
      setSearchError('Group start missing conversationId');
      return;
    }
    setPeer(title);
    setConversationId(convId);
    upsertDmThread(convId, title, Date.now());
    setSearchOpen(false);
    setPeerInput('');
    setSearchError(null);
  }, [
    apiUrl,
    blockedSubs,
    currentUsername,
    fetchAuthSession,
    fetchUserAttributes,
    peerInput,
    setConversationId,
    setPeer,
    setPeerInput,
    setSearchError,
    setSearchOpen,
    upsertDmThread,
  ]);

  return { startDM };
}

