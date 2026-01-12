import * as React from 'react';

export function useChatCipherState() {
  const [cipherOpen, setCipherOpen] = React.useState<boolean>(false);
  const [cipherText, setCipherText] = React.useState<string>('');
  return { cipherOpen, setCipherOpen, cipherText, setCipherText };
}
