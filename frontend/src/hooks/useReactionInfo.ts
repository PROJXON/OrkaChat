import * as React from 'react';

export function useReactionInfo<TTarget = unknown>(opts?: {
  sortSubs?: (subs: string[]) => string[];
  ensureNamesBySub?: (subs: string[]) => Promise<void>;
}) {
  const sortSubs = opts?.sortSubs;
  const ensureNamesBySub = opts?.ensureNamesBySub;

  const [open, setOpen] = React.useState<boolean>(false);
  const [emoji, setEmoji] = React.useState<string>('');
  const [subs, setSubs] = React.useState<string[]>([]);
  const [target, setTarget] = React.useState<TTarget | null>(null);
  const [namesBySub, setNamesBySub] = React.useState<Record<string, string>>({});

  const subsSorted = React.useMemo(() => {
    if (!Array.isArray(subs)) return [];
    if (sortSubs) return sortSubs(subs);
    return subs;
  }, [subs, sortSubs]);

  const openReactionInfo = React.useCallback(
    async (args: { emoji: string; subs: string[]; target?: TTarget | null; namesBySub?: Record<string, string> }) => {
      const e = String(args.emoji || '');
      const s = Array.isArray(args.subs) ? args.subs.map(String).filter(Boolean) : [];
      setEmoji(e);
      setSubs(s);
      setTarget(typeof args.target === 'undefined' ? null : args.target);
      if (args.namesBySub && typeof args.namesBySub === 'object') {
        setNamesBySub(args.namesBySub);
      }
      setOpen(true);
      if (ensureNamesBySub && s.length) {
        try {
          await ensureNamesBySub(s);
        } catch {
          // ignore
        }
      }
    },
    [ensureNamesBySub],
  );

  const closeReactionInfo = React.useCallback(() => {
    setOpen(false);
    setTarget(null);
  }, []);

  return {
    open,
    setOpen,
    emoji,
    subs,
    subsSorted,
    target,
    namesBySub,
    setNamesBySub,
    openReactionInfo,
    closeReactionInfo,
    setTarget,
    setEmoji,
    setSubs,
  };
}

