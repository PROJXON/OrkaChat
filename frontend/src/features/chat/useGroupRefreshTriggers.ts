import * as React from 'react';

export function useGroupReadOnlyRefreshTicker(opts: {
  enabled: boolean;
  meStatus: string | null | undefined;
  tickMs?: number;
  setGroupRefreshNonce: React.Dispatch<React.SetStateAction<number>>;
}): void {
  const enabled = !!opts.enabled;
  const meStatus = typeof opts.meStatus === 'string' ? opts.meStatus : null;
  const tickMs =
    typeof opts.tickMs === 'number' && Number.isFinite(opts.tickMs)
      ? Math.max(250, Math.floor(opts.tickMs))
      : 4000;
  const setGroupRefreshNonce = opts.setGroupRefreshNonce;

  // If I'm currently read-only in a group, periodically refresh group meta so that
  // getting re-added/unbanned "wakes up" the chat without leaving/re-entering.
  React.useEffect(() => {
    if (!enabled) return;
    if (!meStatus || meStatus === 'active') return;
    const t = setInterval(() => {
      setGroupRefreshNonce((n) => n + 1);
    }, tickMs);
    return () => clearInterval(t);
  }, [enabled, meStatus, setGroupRefreshNonce, tickMs]);
}

export function useRefreshGroupRosterOnMembersModalOpen(opts: {
  enabled: boolean;
  groupMembersOpen: boolean;
  lastGroupRosterRefreshAtRef: React.MutableRefObject<number>;
  setGroupRefreshNonce: React.Dispatch<React.SetStateAction<number>>;
}): void {
  const enabled = !!opts.enabled;
  const groupMembersOpen = !!opts.groupMembersOpen;
  const lastGroupRosterRefreshAtRef = opts.lastGroupRosterRefreshAtRef;
  const setGroupRefreshNonce = opts.setGroupRefreshNonce;

  // When the Members modal opens, refresh roster once (helps keep the count in sync,
  // especially after "left"/ban/unban events and while read-only).
  React.useEffect(() => {
    if (!groupMembersOpen) return;
    if (!enabled) return;
    const now = Date.now();
    lastGroupRosterRefreshAtRef.current = now;
    setGroupRefreshNonce((n) => n + 1);
  }, [groupMembersOpen, enabled, lastGroupRosterRefreshAtRef, setGroupRefreshNonce]);
}
