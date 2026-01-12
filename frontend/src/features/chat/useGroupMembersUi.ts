import * as React from 'react';

import type { MemberRow } from '../../types/members';
import { isVisibleMemberRow, toMemberRow } from './memberRows';

export function useGroupMembersUi(opts: {
  groupMembers: unknown[];
  myUserId: string | null | undefined;
}): {
  groupMembersVisible: MemberRow[];
  groupMembersActiveCount: number;
  computeDefaultGroupTitleForMe: () => string;
} {
  const { groupMembers, myUserId } = opts;

  // For UI counts + roster list. We intentionally hide "left" members.
  const groupMembersVisible = React.useMemo(() => {
    const rows: MemberRow[] = [];
    for (const m of groupMembers) {
      if (!isVisibleMemberRow(m)) continue;
      const row = toMemberRow(m);
      if (!row) continue;
      // isVisibleMemberRow guarantees active|banned, but keep a safe fallback.
      if (row.status !== 'active' && row.status !== 'banned') continue;
      rows.push(row);
    }
    return rows;
  }, [groupMembers]);

  // For the "Members" button count: show *active* participants only.
  const groupMembersActiveCount = React.useMemo<number>(
    () =>
      groupMembers.reduce<number>(
        (acc, m) =>
          m && typeof m === 'object' && (m as { status?: unknown }).status === 'active'
            ? acc + 1
            : acc,
        0,
      ),
    [groupMembers],
  );

  const computeDefaultGroupTitleForMe = React.useCallback((): string => {
    const mySub = typeof myUserId === 'string' && myUserId.trim() ? myUserId.trim() : '';
    const active = groupMembers.filter(
      (m): m is { memberSub?: unknown; displayName?: unknown; status?: unknown } =>
        !!m && typeof m === 'object' && (m as { status?: unknown }).status === 'active',
    );
    const others = active.filter((m) => !mySub || String(m.memberSub) !== mySub);
    const labels = others
      .map((m) => String(m.displayName || m.memberSub || '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    if (!labels.length) return 'Group DM';
    const head = labels.slice(0, 3);
    const rest = labels.length - head.length;
    return rest > 0 ? `${head.join(', ')} +${rest}` : head.join(', ');
  }, [groupMembers, myUserId]);

  return { groupMembersVisible, groupMembersActiveCount, computeDefaultGroupTitleForMe };
}
