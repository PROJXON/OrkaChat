import * as React from 'react';

export type ConfirmLinkState = {
  open: boolean;
  url: string;
  domain: string;
};

export function useConfirmLink() {
  const [state, setState] = React.useState<ConfirmLinkState>({ open: false, url: '', domain: '' });

  const requestOpenLink = React.useCallback((url: string) => {
    const s = String(url || '').trim();
    if (!s) return;
    let domain = '';
    try {
      domain = new URL(s).host;
    } catch {
      // ignore
    }
    setState({ open: true, url: s, domain });
  }, []);

  const close = React.useCallback(() => {
    setState((prev) => (prev.open ? { ...prev, open: false } : prev));
  }, []);

  const onOpened = React.useCallback(() => {
    // Close the modal but keep the url/domain around (useful for analytics/debugging if needed).
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  return { state, requestOpenLink, close, onOpened };
}
