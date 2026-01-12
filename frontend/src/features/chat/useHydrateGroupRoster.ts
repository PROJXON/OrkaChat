import * as React from 'react';
import { fetchAuthSession } from '@aws-amplify/auth';
import type { PublicAvatarProfileLite } from '../../hooks/usePublicAvatarProfiles';

export type GroupMeta = {
  groupId: string;
  groupName?: string;
  meIsAdmin: boolean;
  meStatus: string;
};

export type GroupMember = {
  memberSub: string;
  displayName?: string;
  status: string;
  isAdmin: boolean;
  avatarBgColor?: string;
  avatarTextColor?: string;
  avatarImagePath?: string;
};

export function useHydrateGroupRoster(opts: {
  enabled: boolean;
  apiUrl: string;
  activeConversationId: string;
  groupRefreshNonce: number;
  setGroupMeta: React.Dispatch<React.SetStateAction<GroupMeta | null>>;
  setGroupMembers: React.Dispatch<React.SetStateAction<GroupMember[]>>;
  setGroupPublicKeyBySub: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  upsertAvatarProfiles: (items: Array<{ sub: string; profile: Partial<PublicAvatarProfileLite> }>) => void;
}): void {
  const enabled = !!opts.enabled;
  const apiUrl = String(opts.apiUrl || '');
  const activeConversationId = String(opts.activeConversationId || '');
  const groupRefreshNonce = opts.groupRefreshNonce;
  const setGroupMeta = opts.setGroupMeta;
  const setGroupMembers = opts.setGroupMembers;
  const setGroupPublicKeyBySub = opts.setGroupPublicKeyBySub;
  const upsertAvatarProfiles = opts.upsertAvatarProfiles;

  // Group metadata + member key hydration (for encryption + admin UI).
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!apiUrl || !enabled) {
        setGroupMeta(null);
        setGroupMembers([]);
        setGroupPublicKeyBySub({});
        return;
      }
      try {
        const { tokens } = await fetchAuthSession();
        const idToken = tokens?.idToken?.toString();
        if (!idToken) return;
        const base = apiUrl.replace(/\/$/, '');
        const url = `${base}/groups/get?conversationId=${encodeURIComponent(activeConversationId)}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
        if (!res.ok) {
          if (!cancelled) {
            setGroupMeta(null);
            setGroupMembers([]);
            setGroupPublicKeyBySub({});
          }
          return;
        }
        const raw: unknown = await res.json().catch(() => ({}));
        const data = typeof raw === 'object' && raw != null ? (raw as Record<string, unknown>) : {};
        const groupId = String(data.groupId || '').trim();
        const me = typeof data.me === 'object' && data.me != null ? (data.me as Record<string, unknown>) : {};
        const meIsAdmin = !!me.isAdmin;
        const meStatus = typeof me.status === 'string' ? String(me.status) : 'active';
        const membersRaw: unknown[] = Array.isArray(data.members) ? data.members : [];
        const members: GroupMember[] = membersRaw
          .map((m) => {
            const rec = typeof m === 'object' && m != null ? (m as Record<string, unknown>) : {};
            return {
              memberSub: String(rec.memberSub || '').trim(),
              displayName: typeof rec.displayName === 'string' ? String(rec.displayName) : undefined,
              status: typeof rec.status === 'string' ? String(rec.status) : 'active',
              isAdmin: !!rec.isAdmin,
              avatarBgColor: typeof rec.avatarBgColor === 'string' ? String(rec.avatarBgColor) : undefined,
              avatarTextColor: typeof rec.avatarTextColor === 'string' ? String(rec.avatarTextColor) : undefined,
              avatarImagePath: typeof rec.avatarImagePath === 'string' ? String(rec.avatarImagePath) : undefined,
            };
          })
          .filter((m) => m.memberSub);
        if (!cancelled) {
          setGroupMeta(
            groupId
              ? {
                  groupId,
                  groupName: typeof data.groupName === 'string' ? String(data.groupName) : undefined,
                  meIsAdmin,
                  meStatus,
                }
              : null,
          );
          // If I'm not an active member, treat the roster as a snapshot (privacy/UX):
          // keep the last-known roster stable, while still polling `meStatus` so we can wake up if re-added/unbanned.
          setGroupMembers((prev) => {
            if (meStatus === 'active') return members;
            // If we don't have anything yet (e.g. first load), take one snapshot.
            if (!prev || prev.length === 0) return members;
            return prev;
          });
          // Ensure avatars for roster members are present even if nobody has chatted recently.
          upsertAvatarProfiles(
            members.map((m) => ({
              sub: String(m.memberSub || '').trim(),
              profile: {
                displayName: typeof m.displayName === 'string' ? String(m.displayName) : undefined,
                avatarBgColor: typeof m.avatarBgColor === 'string' ? String(m.avatarBgColor) : undefined,
                avatarTextColor: typeof m.avatarTextColor === 'string' ? String(m.avatarTextColor) : undefined,
                avatarImagePath: typeof m.avatarImagePath === 'string' ? String(m.avatarImagePath) : undefined,
              },
            })),
          );
        }

        // Only fetch other members' public keys if I'm an active member.
        // (Needed for encrypting outgoing messages; not needed for read-only viewing/decrypting.)
        if (meStatus !== 'active') {
          if (!cancelled) setGroupPublicKeyBySub({});
          return;
        }

        // Fetch current public keys for active members (required for wrapping message keys).
        const activeSubs = members.filter((m) => m.status === 'active').map((m) => m.memberSub);
        const nextKeyMap: Record<string, string> = {};
        await Promise.all(
          activeSubs.map(async (sub: string) => {
            try {
              const r = await fetch(`${base}/users?sub=${encodeURIComponent(sub)}`, {
                headers: { Authorization: `Bearer ${idToken}` },
              });
              if (!r.ok) return;
              const u = await r.json().catch(() => ({}));
              const pk = (u.public_key as string | undefined) || (u.publicKey as string | undefined);
              if (typeof pk === 'string' && pk.trim()) nextKeyMap[sub] = pk.trim();
            } catch {
              // ignore
            }
          }),
        );
        if (!cancelled) setGroupPublicKeyBySub(nextKeyMap);
      } catch {
        if (!cancelled) {
          setGroupMeta(null);
          setGroupMembers([]);
          setGroupPublicKeyBySub({});
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    activeConversationId,
    apiUrl,
    enabled,
    groupRefreshNonce,
    setGroupMembers,
    setGroupMeta,
    setGroupPublicKeyBySub,
    upsertAvatarProfiles,
  ]);
}

