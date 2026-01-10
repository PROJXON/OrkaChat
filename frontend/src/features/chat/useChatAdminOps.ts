import * as React from 'react';
import { fetchAuthSession } from '@aws-amplify/auth';

type AuthedPostResult = { ok: boolean; status: number; json?: any; text?: string };

async function authedPost(apiUrl: string, path: string, body: any): Promise<AuthedPostResult> {
  const { tokens } = await fetchAuthSession();
  const idToken = tokens?.idToken?.toString();
  if (!idToken) return { ok: false, status: 401, text: 'Not authenticated' };
  const base = apiUrl.replace(/\/$/, '');
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const text = await res.text().catch(() => '');
  let json: any = undefined;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    // ignore
  }
  return { ok: res.ok, status: res.status, json, text };
}

export function useChatAdminOps(opts: {
  apiUrl: string | null | undefined;
  activeConversationId: string;
  isChannel: boolean;
  isGroup: boolean;
  myUserId: string | null | undefined;
  wsRef: React.RefObject<WebSocket | null>;
  showAlert: (title: string, message: string) => void;
  uiConfirm: (
    title: string,
    message: string,
    options?: { confirmText?: string; cancelText?: string; destructive?: boolean },
  ) => Promise<boolean>;
  showToast: (message: string, kind?: 'success' | 'error') => void;
  refreshChannelRoster: () => Promise<void>;
  setChannelActionBusy: (next: boolean) => void;
  setGroupActionBusy: (next: boolean) => void;
  channelMetaMeIsAdmin: boolean;
  channelMembers: any[];
  setChannelMembers: React.Dispatch<React.SetStateAction<any[]>>;
  setChannelMeta: React.Dispatch<React.SetStateAction<any>>;
  setChannelMembersOpen: (next: boolean) => void;
  onKickedFromConversation: ((conversationId: string) => void) | undefined;
  groupMetaMeIsAdmin: boolean;
  groupMembers: any[];
  setGroupMeta: React.Dispatch<React.SetStateAction<any>>;
  bumpGroupRefreshNonce: () => void;
}) {
  const {
    apiUrl,
    activeConversationId,
    isChannel,
    isGroup,
    myUserId,
    wsRef,
    showAlert,
    uiConfirm,
    showToast,
    refreshChannelRoster,
    setChannelActionBusy,
    setGroupActionBusy,
    channelMetaMeIsAdmin,
    channelMembers,
    setChannelMembers,
    setChannelMeta,
    setChannelMembersOpen,
    onKickedFromConversation,
    groupMetaMeIsAdmin,
    groupMembers,
    setGroupMeta,
    bumpGroupRefreshNonce,
  } = opts;

  const channelUpdate = React.useCallback(
    async (op: string, extra: any) => {
      if (!isChannel) return;
      if (!apiUrl) return;
      const cid = String(activeConversationId).slice('ch#'.length).trim();
      if (!cid) return;
      setChannelActionBusy(true);
      try {
        const resp = await authedPost(apiUrl, '/channels/update', { channelId: cid, op, ...(extra || {}) });
        if (!resp.ok) {
          const msg =
            (resp.json && typeof resp.json.message === 'string' ? resp.json.message : resp.text) || 'Request failed';
          showAlert('Channel update failed', `${msg}`.trim());
          return;
        }
        // Broadcast to other connected members so their UI refreshes instantly (counts, meta).
        // (Server validates admin for update events.)
        try {
          const ws = wsRef.current;
          if (ws && ws.readyState === WebSocket.OPEN) {
            if (op === 'setPublic') {
              ws.send(
                JSON.stringify({
                  action: 'system',
                  conversationId: activeConversationId,
                  systemKind: 'update',
                  updateField: 'visibility',
                  isPublic: !!extra?.isPublic,
                  createdAt: Date.now(),
                }),
              );
            } else if (op === 'setPassword' || op === 'clearPassword') {
              const nextHasPassword = op === 'setPassword';
              ws.send(
                JSON.stringify({
                  action: 'system',
                  conversationId: activeConversationId,
                  systemKind: 'update',
                  updateField: 'password',
                  hasPassword: nextHasPassword,
                  createdAt: Date.now(),
                }),
              );
            }
          }
        } catch {
          // ignore
        }
        // Refresh channel meta/members (best-effort)
        try {
          await refreshChannelRoster();
        } catch {}
        return resp.json;
      } finally {
        setChannelActionBusy(false);
      }
    },
    [isChannel, apiUrl, activeConversationId, wsRef, showAlert, refreshChannelRoster, setChannelActionBusy],
  );

  const channelLeave = React.useCallback(async () => {
    if (!isChannel) return;
    if (!apiUrl) return;
    // UX guard: prevent orphaning a channel (no active admins).
    // Mirrors the group DM rule.
    try {
      const mySub = typeof myUserId === 'string' && myUserId.trim() ? myUserId.trim() : '';
      if (channelMetaMeIsAdmin && mySub) {
        const active = channelMembers.filter((m) => m && m.status === 'active');
        const otherActive = active.filter((m) => String(m.memberSub) !== mySub);
        const otherActiveAdmins = otherActive.filter((m) => !!m.isAdmin);
        if (otherActive.length > 0 && otherActiveAdmins.length === 0) {
          showAlert('Wait!', 'You are the last admin. Promote someone else before leaving.');
          return;
        }
      }
    } catch {
      // ignore; fall back to server enforcement
    }
    const ok = await uiConfirm('Leave channel?', 'You will stop receiving new messages', {
      confirmText: 'Leave',
      cancelText: 'Cancel',
      destructive: true,
    });
    if (!ok) return;
    const cid = String(activeConversationId).slice('ch#'.length).trim();
    if (!cid) return;
    setChannelActionBusy(true);
    try {
      const resp = await authedPost(apiUrl, '/channels/leave', { channelId: cid });
      if (!resp.ok) {
        const msg =
          (resp.json && typeof resp.json.message === 'string' ? resp.json.message : resp.text) || 'Request failed';
        showAlert('Leave failed', `${msg}`.trim());
        return;
      }
      showToast('Left channel', 'success');
      // Optimistically update local roster/counts so UI reflects leave immediately.
      try {
        const mySub = typeof myUserId === 'string' && myUserId.trim() ? myUserId.trim() : '';
        if (mySub) {
          setChannelMembers((prev) =>
            (Array.isArray(prev) ? prev : []).map((m) =>
              m && String(m.memberSub) === mySub ? { ...m, status: 'left', isAdmin: false } : m,
            ),
          );
          setChannelMeta((prev: any) => (prev ? { ...prev, meStatus: 'left', meIsAdmin: false } : prev));
        }
      } catch {
        // ignore
      }
      // Broadcast a "left" system note (best-effort) so others refresh rosters promptly.
      try {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN && myUserId) {
          ws.send(
            JSON.stringify({
              action: 'system',
              conversationId: activeConversationId,
              systemKind: 'left',
              targetSub: myUserId,
              createdAt: Date.now(),
            }),
          );
        }
      } catch {
        // ignore
      }
      setChannelMembersOpen(false);
      onKickedFromConversation?.(activeConversationId);
    } finally {
      setChannelActionBusy(false);
    }
  }, [
    isChannel,
    apiUrl,
    uiConfirm,
    activeConversationId,
    setChannelActionBusy,
    showAlert,
    showToast,
    myUserId,
    wsRef,
    setChannelMembers,
    setChannelMeta,
    setChannelMembersOpen,
    onKickedFromConversation,
    channelMetaMeIsAdmin,
    channelMembers,
  ]);

  const groupUpdate = React.useCallback(
    async (op: string, extra: any) => {
      if (!isGroup) return;
      if (!apiUrl) return;
      setGroupActionBusy(true);
      try {
        const resp = await authedPost(apiUrl, '/groups/update', { conversationId: activeConversationId, op, ...(extra || {}) });
        if (!resp.ok) {
          const msg =
            (resp.json && typeof resp.json.message === 'string' ? resp.json.message : resp.text) || 'Request failed';
          showAlert('Group update failed', `${msg}`.trim());
          return;
        }
        // For "addMembers", emit system messages so everyone sees "X was added..." (persisted + broadcast by server).
        if (op === 'addMembers') {
          const addedSubs: string[] = Array.isArray(resp.json?.addedSubs) ? resp.json.addedSubs.map(String) : [];
          if (addedSubs.length) {
            const ws = wsRef.current;
            if (ws && ws.readyState === WebSocket.OPEN) {
              for (const sub of addedSubs) {
                // eslint-disable-next-line no-continue
                if (!sub) continue;
                try {
                  ws.send(
                    JSON.stringify({
                      action: 'system',
                      conversationId: activeConversationId,
                      systemKind: 'added',
                      targetSub: sub,
                      createdAt: Date.now(),
                    }),
                  );
                } catch {
                  // ignore
                }
              }
            }
          }
        }
        bumpGroupRefreshNonce();
      } finally {
        setGroupActionBusy(false);
      }
    },
    [isGroup, apiUrl, setGroupActionBusy, activeConversationId, showAlert, wsRef, bumpGroupRefreshNonce],
  );

  const groupLeave = React.useCallback(async () => {
    if (!isGroup) return;
    if (!apiUrl) return;
    const ok = await uiConfirm(
      'Leave group?',
      'You will stop receiving new messages. This chat will remain in your Chats list as read-only until you remove it.',
      { confirmText: 'Leave', cancelText: 'Cancel', destructive: true },
    );
    if (!ok) return;

    // UX guard: prevent orphaning a group (no active admins).
    // This duplicates the server rule so the user gets a clear message even if the backend is stale/misconfigured.
    try {
      const mySub = typeof myUserId === 'string' && myUserId.trim() ? myUserId.trim() : '';
      if (groupMetaMeIsAdmin && mySub) {
        const active = groupMembers.filter((m) => m && m.status === 'active');
        const otherActive = active.filter((m) => String(m.memberSub) !== mySub);
        const otherActiveAdmins = otherActive.filter((m) => !!m.isAdmin);
        // If there are other active members, require at least one admin besides me.
        if (otherActive.length > 0 && otherActiveAdmins.length === 0) {
          showAlert('Wait!', 'You are the last admin. Promote someone else before leaving.');
          return;
        }
      }
    } catch {
      // ignore (fall back to server enforcement)
    }

    setGroupActionBusy(true);
    try {
      const resp = await authedPost(apiUrl, '/groups/leave', { conversationId: activeConversationId });
      if (!resp.ok) {
        const msg =
          (resp.json && typeof resp.json.message === 'string' ? resp.json.message : resp.text) || 'Request failed';
        // Helpful UX: if the backend isn't updated yet, surface the client-side rule.
        if (resp.status === 500) {
          showAlert(
            'Leave failed',
            'Server error while leaving the group. If you are an admin, ensure another admin exists, then try again.',
          );
        } else {
          showAlert('Leave failed', `${msg}`.trim());
        }
        return;
      }

      // Broadcast a "left" system note AFTER leaving.
      // (Backend WS authorizer allows self-left even when status is already "left".)
      try {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN && myUserId) {
          ws.send(
            JSON.stringify({
              action: 'system',
              conversationId: activeConversationId,
              systemKind: 'left',
              targetSub: myUserId,
              createdAt: Date.now(),
            }),
          );
        }
      } catch {
        // ignore
      }
      showToast('Left group', 'success');
      setGroupMeta((prev: any) => (prev ? { ...prev, meStatus: 'left' } : prev));
      bumpGroupRefreshNonce();
    } finally {
      setGroupActionBusy(false);
    }
  }, [
    isGroup,
    apiUrl,
    uiConfirm,
    myUserId,
    groupMetaMeIsAdmin,
    groupMembers,
    setGroupActionBusy,
    activeConversationId,
    showAlert,
    wsRef,
    showToast,
    setGroupMeta,
    bumpGroupRefreshNonce,
  ]);

  return { channelUpdate, channelLeave, groupUpdate, groupLeave };
}

