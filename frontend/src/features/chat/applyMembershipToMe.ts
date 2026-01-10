export function applyGroupMembershipSystemEventToMe(opts: {
  mySub: string | null | undefined;
  targetSub: string | null | undefined;
  systemKind: string | null | undefined;
  setMeStatus: (status: 'active' | 'banned' | 'left') => void;
  bumpRefresh: () => void;
}): void {
  const mySub = typeof opts.mySub === 'string' && opts.mySub ? opts.mySub : '';
  const targetSub = typeof opts.targetSub === 'string' && opts.targetSub ? opts.targetSub : '';
  if (!mySub || !targetSub || mySub !== targetSub) return;

  const systemKind = typeof opts.systemKind === 'string' ? opts.systemKind : '';
  if (systemKind === 'added' || systemKind === 'unban' || systemKind === 'unbanned') {
    opts.setMeStatus('active');
    opts.bumpRefresh();
    return;
  }
  if (systemKind === 'ban' || systemKind === 'banned') {
    opts.setMeStatus('banned');
    return;
  }
  if (systemKind === 'left') {
    opts.setMeStatus('left');
    return;
  }
  if (systemKind === 'removed' || systemKind === 'kick' || systemKind === 'kicked') {
    // "kicked" usually comes as payload.type === 'kicked', but handle any system variants defensively.
    opts.setMeStatus('left');
  }
}

