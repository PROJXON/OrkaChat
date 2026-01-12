import * as React from 'react';
import { buildAiSummaryTranscript } from './aiSummaryContext';
import type { ChatMessage } from './types';

export function useAiSummary(opts: {
  apiUrl: string | null | undefined;
  activeConversationId: string;
  peer: unknown;
  messages: ChatMessage[];
  fetchAuthSession: () => Promise<{ tokens?: { idToken?: { toString: () => string } } }>;
  showAlert: (title: string, body: string) => void;
  openInfo: (title: string, body: string) => void;
}) {
  const { apiUrl, activeConversationId, peer, messages, fetchAuthSession, showAlert, openInfo } = opts;

  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState<string>('');
  const [loading, setLoading] = React.useState(false);

  const close = React.useCallback(() => {
    setOpen(false);
    setText('');
  }, []);

  const summarize = React.useCallback(async () => {
    if (!apiUrl) {
      showAlert('AI not configured', 'API_URL is not configured.');
      return;
    }
    try {
      setLoading(true);
      setOpen(true);
      setText('');

      const { tokens } = await fetchAuthSession();
      const idToken = tokens?.idToken?.toString();
      if (!idToken) throw new Error('Not authenticated');

      const transcript = buildAiSummaryTranscript({ messages, maxMessages: 50 });
      const resp = await fetch(`${apiUrl.replace(/\/$/, '')}/ai/summary`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: activeConversationId,
          peer: peer ?? null,
          messages: transcript,
        }),
      });

      if (!resp.ok) {
        const bodyText = await resp.text().catch(() => '');
        if (resp.status === 429) {
          let msg = 'AI limit reached. Please try again later.';
          try {
            const j = JSON.parse(bodyText || '{}');
            if (j && typeof j.message === 'string' && j.message.trim()) msg = j.message.trim();
          } catch {
            // ignore
          }
          setOpen(false);
          openInfo('AI limit reached', msg);
          return;
        }
        throw new Error(`AI summary failed (${resp.status}): ${bodyText || 'no body'}`);
      }

      const data: unknown = await resp.json().catch(() => ({}));
      const rec = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
      const summary = typeof rec.summary === 'string' ? rec.summary : String(rec.summary ?? '');
      setText(summary);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : 'Unknown error';
      showAlert('Summary failed', msg);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, [activeConversationId, apiUrl, fetchAuthSession, messages, openInfo, peer, showAlert]);

  return {
    open,
    text,
    loading,
    setOpen,
    setText,
    setLoading,
    close,
    summarize,
  };
}

