import * as React from 'react';

export function useChatInfoModal() {
  const [infoOpen, setInfoOpen] = React.useState<boolean>(false);
  const [infoTitle, setInfoTitle] = React.useState<string>('');
  const [infoBody, setInfoBody] = React.useState<string>('');

  const openInfo = React.useCallback((title: string, body: string) => {
    setInfoTitle(title);
    setInfoBody(body);
    setInfoOpen(true);
  }, []);

  return {
    infoOpen,
    setInfoOpen,
    infoTitle,
    infoBody,
    openInfo,
    setInfoTitle,
    setInfoBody,
  };
}
