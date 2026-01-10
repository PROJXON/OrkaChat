import * as React from 'react';
import { buildAiSummaryTranscript } from './aiSummaryContext';

export function useAiSummary(opts: {
  apiUrl: string | null | undefined;
  activeConversationId: string;
  peer: any;
  messages: any[];
  fetchAuthSession: () => Promise<any>;
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

      const data = await resp.json().catch(() => ({}));
      setText(String((data as any).summary ?? ''));
    } catch (e: any) {
      showAlert('Summary failed', e?.message ?? 'Unknown error');
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

