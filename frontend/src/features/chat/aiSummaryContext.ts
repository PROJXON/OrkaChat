export type AiSummaryTranscriptItem = {
  user: string;
  text: string;
  createdAt?: number;
};

import type { ChatMessage } from './types';

export function buildAiSummaryTranscript(opts: {
  messages: ChatMessage[];
  maxMessages?: number;
}): AiSummaryTranscriptItem[] {
  const { messages, maxMessages = 50 } = opts;
  // messages[] is newest-first (FlatList inverted), so take the most recent N and send oldest-first.
  const recent = Array.isArray(messages) ? messages.slice(0, maxMessages).slice().reverse() : [];
  return recent
    .map((m) => {
      // Only send plaintext. If message is still encrypted, skip it.
      const raw = m?.decryptedText ?? (m?.encrypted ? '' : (m?.rawText ?? m?.text));
      const s = String(raw || '');
      const text = s.length > 500 ? `${s.slice(0, 500)}…` : s;
      return text
        ? {
            user: m?.user ?? 'anon',
            text,
            createdAt: m?.createdAt,
          }
        : null;
    })
    .filter(Boolean) as AiSummaryTranscriptItem[];
}
