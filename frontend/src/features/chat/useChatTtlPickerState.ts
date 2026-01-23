import * as React from 'react';

export function useChatTtlPickerState() {
  const TTL_OPTIONS = React.useMemo(
    () => [
      { label: 'Off', seconds: 0 },
      { label: '15 seconds', seconds: 15 },
      { label: '5 min', seconds: 5 * 60 },
      { label: '1 hour', seconds: 60 * 60 },
      { label: '6 hours', seconds: 6 * 60 * 60 },
      { label: '1 day', seconds: 24 * 60 * 60 },
      { label: '1 week', seconds: 7 * 24 * 60 * 60 },
      { label: '30 days', seconds: 30 * 24 * 60 * 60 },
    ],
    [],
  );

  const [ttlIdx, setTtlIdx] = React.useState<number>(0);
  const [ttlIdxDraft, setTtlIdxDraft] = React.useState<number>(0);
  const [ttlPickerOpen, setTtlPickerOpen] = React.useState<boolean>(false);

  return {
    TTL_OPTIONS,
    ttlIdx,
    setTtlIdx,
    ttlIdxDraft,
    setTtlIdxDraft,
    ttlPickerOpen,
    setTtlPickerOpen,
  };
}
