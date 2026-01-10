import * as React from 'react';
import { fetchAuthSession } from '@aws-amplify/auth';
import { useAutoPopupChannelAbout } from '../../hooks/useAutoPopupChannelAbout';

export type ChannelMeta = {
  channelId: string;
  name: string;
  isPublic?: boolean;
  hasPassword?: boolean;
  aboutText?: string;
  aboutVersion?: number;
  meIsAdmin: boolean;
  meStatus: string;
};

export type ChannelMember = {
  memberSub: string;
  displayName?: string;
  status: string;
  isAdmin: boolean;
  avatarBgColor?: string;
  avatarTextColor?: string;
  avatarImagePath?: string;
};

export function useChannelRoster(opts: {
  apiUrl: string | null | undefined;
  enabled: boolean;
  activeConversationId: string;
  activeChannelId: string;
  channelHeaderCache: { cached: any; save: (v: any) => void };
  channelMembersOpen: boolean;
  channelAboutRequestEpoch: number | undefined;
  uiAlert: (title: string, body: string) => Promise<void> | void;
  onConversationTitleChanged?: (conversationId: string, title: string) => void;
  channelMeta: ChannelMeta | null;
  setChannelMeta: React.Dispatch<React.SetStateAction<ChannelMeta | null>>;
  setChannelRosterChannelId: React.Dispatch<React.SetStateAction<string>>;
  setChannelMembers: React.Dispatch<React.SetStateAction<ChannelMember[]>>;
  setChannelMembersActiveCountHint: React.Dispatch<React.SetStateAction<number | null>>;
  setChannelAboutDraft: (v: string) => void;
  setChannelAboutEdit: (v: boolean) => void;
  setChannelAboutOpen: (v: boolean) => void;
}) {
  const {
    apiUrl,
    enabled,
    activeConversationId,
    activeChannelId,
    channelHeaderCache,
    channelMembersOpen,
    channelAboutRequestEpoch,
    uiAlert,
    onConversationTitleChanged,
    channelMeta,
    setChannelMeta,
    setChannelRosterChannelId,
    setChannelMembers,
    setChannelMembersActiveCountHint,
    setChannelAboutDraft,
    setChannelAboutEdit,
    setChannelAboutOpen,
  } = opts;

  // Prevent stale header/settings from briefly showing the previous channel when switching between channels.
  const lastChannelIdRef = React.useRef<string>('');

  const refreshChannelRoster = React.useCallback(async () => {
    if (!apiUrl || !enabled) return;
    const channelId = String(activeConversationId).slice('ch#'.length).trim();
    if (!channelId) return;
    const { tokens } = await fetchAuthSession();
    const idToken = tokens?.idToken?.toString();
    if (!idToken) return;
    const base = apiUrl.replace(/\/$/, '');
    // Ask for banned users too; backend will only include them for admins.
    const resp = await fetch(`${base}/channels/members?channelId=${encodeURIComponent(channelId)}&includeBanned=1`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!resp.ok) return;
    const data = await resp.json().catch(() => ({}));
    const ch = data?.channel || {};
    const name = typeof ch.name === 'string' ? ch.name.trim() : '';
    const me = data?.me && typeof data.me === 'object' ? data.me : undefined;
    const meIsAdmin = !!me?.isAdmin;
    const meStatus = typeof me?.status === 'string' ? String(me.status) : 'active';
    const isPublic = typeof ch.isPublic === 'boolean' ? ch.isPublic : undefined;
    const hasPassword = typeof ch.hasPassword === 'boolean' ? ch.hasPassword : undefined;
    const aboutText = typeof ch.aboutText === 'string' ? String(ch.aboutText) : '';
    const aboutVersion = typeof ch.aboutVersion === 'number' && Number.isFinite(ch.aboutVersion) ? ch.aboutVersion : 0;
    const membersRaw = Array.isArray(data?.members) ? data.members : [];
    const members: ChannelMember[] = membersRaw
      .map((m: any) => ({
        memberSub: String(m?.memberSub || '').trim(),
        displayName: typeof m?.displayName === 'string' ? String(m.displayName) : undefined,
        status: typeof m?.status === 'string' ? String(m.status) : 'active',
        isAdmin: !!m?.isAdmin,
        avatarBgColor: typeof m?.avatarBgColor === 'string' ? String(m.avatarBgColor) : undefined,
        avatarTextColor: typeof m?.avatarTextColor === 'string' ? String(m.avatarTextColor) : undefined,
        avatarImagePath: typeof m?.avatarImagePath === 'string' ? String(m.avatarImagePath) : undefined,
      }))
      .filter((m: ChannelMember) => m.memberSub);

    setChannelRosterChannelId(channelId);
    setChannelMembers(members);
    const activeCount = members.reduce((acc: number, m: ChannelMember) => (m && m.status === 'active' ? acc + 1 : acc), 0);
    setChannelMembersActiveCountHint(activeCount);
    if (name) setChannelMeta({ channelId, name, isPublic, hasPassword, aboutText, aboutVersion, meIsAdmin, meStatus });

    // Persist a tiny channel header cache so cold starts don't flash placeholders.
    // (We avoid caching signed avatar URLs; just stable metadata.)
    channelHeaderCache.save({
      name,
      isPublic: typeof isPublic === 'boolean' ? isPublic : undefined,
      hasPassword: typeof hasPassword === 'boolean' ? hasPassword : undefined,
      aboutText,
      aboutVersion,
      meIsAdmin: !!meIsAdmin,
      meStatus: meStatus || 'active',
      activeCount,
    });
  }, [apiUrl, enabled, activeConversationId, channelHeaderCache, setChannelMembers, setChannelMembersActiveCountHint, setChannelMeta, setChannelRosterChannelId]);

  // Load cached channel header snapshot ASAP on entering a channel (reduces "flash" on cold start).
  React.useEffect(() => {
    if (!enabled) {
      setChannelMembersActiveCountHint(null);
      return;
    }
    const obj = channelHeaderCache.cached;
    if (!obj || String(obj.channelId || '') !== activeChannelId) return;

    const name = typeof obj.name === 'string' ? obj.name.trim() : '';
    const isPublic = typeof obj.isPublic === 'boolean' ? obj.isPublic : undefined;
    const hasPassword = typeof obj.hasPassword === 'boolean' ? obj.hasPassword : undefined;
    const aboutText = typeof obj.aboutText === 'string' ? String(obj.aboutText) : '';
    const aboutVersion = typeof obj.aboutVersion === 'number' && Number.isFinite(obj.aboutVersion) ? obj.aboutVersion : 0;
    const meIsAdmin = !!obj.meIsAdmin;
    const meStatus = typeof obj.meStatus === 'string' ? String(obj.meStatus) : 'active';
    const activeCount =
      typeof obj.activeCount === 'number' && Number.isFinite(obj.activeCount) ? Math.max(0, Math.floor(obj.activeCount)) : null;

    if (activeCount != null) setChannelMembersActiveCountHint(activeCount);

    // Only apply cached meta if we don't already have fresh meta for this channel.
    setChannelMeta((prev) => {
      if (prev && prev.channelId === activeChannelId && prev.name && String(prev.name).trim()) return prev;
      if (!name) return prev;
      return { channelId: activeChannelId, name, isPublic, hasPassword, aboutText, aboutVersion, meIsAdmin, meStatus };
    });
  }, [enabled, activeChannelId, channelHeaderCache.cached, setChannelMembersActiveCountHint, setChannelMeta]);

  // Auto-popup Channel About on first join or whenever aboutVersion changes.
  useAutoPopupChannelAbout({
    enabled,
    scope: 'member',
    channelId: String(activeConversationId).slice('ch#'.length).trim(),
    aboutText: typeof channelMeta?.aboutText === 'string' ? channelMeta.aboutText : '',
    aboutVersion: typeof channelMeta?.aboutVersion === 'number' ? channelMeta.aboutVersion : 0,
    onOpen: () => {
      const aboutText = typeof channelMeta?.aboutText === 'string' ? channelMeta.aboutText : '';
      setChannelAboutDraft(aboutText);
      setChannelAboutEdit(false);
      setChannelAboutOpen(true);
    },
  });

  // App Settings dropdown: open About (view-only) for the current channel.
  const lastAboutReqRef = React.useRef<number>(0);
  React.useEffect(() => {
    const epoch =
      typeof channelAboutRequestEpoch === 'number' && Number.isFinite(channelAboutRequestEpoch)
        ? channelAboutRequestEpoch
        : 0;
    if (!epoch) return;
    if (epoch === lastAboutReqRef.current) return;
    lastAboutReqRef.current = epoch;

    if (!enabled) {
      // Best-effort hint (e.g. user is currently in a DM).
      try {
        void uiAlert('About', 'Open a channel to view its About.');
      } catch {
        // ignore
      }
      return;
    }

    setChannelAboutDraft(String(channelMeta?.aboutText || ''));
    setChannelAboutEdit(false);
    setChannelAboutOpen(true);
  }, [channelAboutRequestEpoch, enabled, uiAlert, setChannelAboutDraft, setChannelAboutEdit, setChannelAboutOpen, channelMeta?.aboutText]);

  // Fetch channel metadata (title, admin flag) when entering a channel.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!apiUrl || !enabled) {
        setChannelMeta(null);
        setChannelMembers([]);
        lastChannelIdRef.current = '';
        setChannelRosterChannelId('');
        setChannelMembersActiveCountHint(null);
        return;
      }
      const channelId = String(activeConversationId).slice('ch#'.length).trim();
      if (!channelId) {
        setChannelMeta(null);
        setChannelMembers([]);
        lastChannelIdRef.current = '';
        setChannelRosterChannelId('');
        setChannelMembersActiveCountHint(null);
        return;
      }
      // If we switched to a different channel, clear the previous channel's meta immediately
      // so the title + settings row don't show stale values while the new roster loads.
      if (lastChannelIdRef.current && lastChannelIdRef.current !== channelId) {
        setChannelMeta(null);
        setChannelMembers([]);
        setChannelMembersActiveCountHint(null);
      }
      lastChannelIdRef.current = channelId;
      try {
        await refreshChannelRoster();
        if (cancelled) return;
      } catch {
        setChannelMeta(null);
        setChannelMembers([]);
        setChannelMembersActiveCountHint(null);
      }
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [apiUrl, enabled, activeConversationId, refreshChannelRoster, setChannelMembers, setChannelMembersActiveCountHint, setChannelMeta, setChannelRosterChannelId]);

  // When opening the Members modal, refresh immediately so it reflects latest state.
  React.useEffect(() => {
    if (!channelMembersOpen) return;
    if (!enabled) return;
    void refreshChannelRoster();
  }, [channelMembersOpen, enabled, refreshChannelRoster]);

  // Keep the parent header/channel pill title in sync once we learn the channel name.
  const lastPushedChannelTitleRef = React.useRef<string>('');
  React.useEffect(() => {
    if (!enabled) return;
    const name = String(channelMeta?.name || '').trim();
    if (!name) return;
    if (name === lastPushedChannelTitleRef.current) return;
    lastPushedChannelTitleRef.current = name;
    try {
      onConversationTitleChanged?.(activeConversationId, name);
    } catch {
      // ignore
    }
  }, [enabled, activeConversationId, onConversationTitleChanged, channelMeta?.name]);

  return { refreshChannelRoster };
}

