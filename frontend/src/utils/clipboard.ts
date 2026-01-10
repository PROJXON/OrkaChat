export async function copyToClipboardSafe(opts: {
  text: string;
  onUnavailable: () => void;
}): Promise<void> {
  const { text, onUnavailable } = opts;
  try {
    const Clipboard = await import('expo-clipboard');
    await Clipboard.setStringAsync(text);
  } catch {
    onUnavailable();
  }
}

