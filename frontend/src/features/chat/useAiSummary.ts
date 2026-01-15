import * as React from 'react';
import { Platform } from 'react-native';

import { buildAiSummaryTranscript } from './aiSummaryContext';
import type { ChatMessage } from './types';

async function readTextResponseStream(opts: {
  response: Response;
  onText: (delta: string) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const { response, onText, signal } = opts;
  const body: unknown = (response as unknown as { body?: unknown }).body;
  const contentType = (response.headers.get('content-type') || '').toLowerCase();

  // Most React Native runtimes do not expose ReadableStream; keep streaming web-only for now.
  if (Platform.OS !== 'web') throw new Error('Streaming not supported on this platform');
  if (!body || typeof (body as { getReader?: unknown }).getReader !== 'function') {
    throw new Error('Streaming body not available');
  }

  const reader = (body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();

  // SSE parsing: server emits "data: ..." lines separated by blank lines.
  // We accept either:
  // - data: {"delta":"..."} (append delta)
  // - data: {"summary":"..."} (replace)
  // - data: [DONE] / {"done":true} (finish)
  const isSse = contentType.includes('text/event-stream');
  let buf = '';

  const nextEventBreakIdx = (s: string): { idx: number; sepLen: number } | null => {
    // Servers/APIs may use either LF or CRLF.
    const a = s.indexOf('\n\n');
    const b = s.indexOf('\r\n\r\n');
    if (a < 0 && b < 0) return null;
    if (a >= 0 && (b < 0 || a <= b)) return { idx: a, sepLen: 2 };
    return { idx: b, sepLen: 4 };
  };

  while (true) {
    if (signal?.aborted) {
      try {
        await reader.cancel();
      } catch {
        // ignore
      }
      break;
    }

    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });

    if (!isSse) {
      if (chunk) onText(chunk);
      continue;
    }

    buf += chunk;
    // SSE events separated by double-newline.
    // Process all complete events in the buffer.
    while (true) {
      const hit = nextEventBreakIdx(buf);
      if (!hit) break;
      const rawEvent = buf.slice(0, hit.idx);
      buf = buf.slice(hit.idx + hit.sepLen);

      const lines = rawEvent
        .split(/\r?\n/)
        .map((l) => l.trimEnd())
        .filter(Boolean);

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const dataStr = line.slice('data:'.length).trim();
        if (!dataStr) continue;
        if (dataStr === '[DONE]') return;
        try {
          const parsed: unknown = JSON.parse(dataStr);
          const rec = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
          if (rec.done === true) return;
          if (typeof rec.delta === 'string' && rec.delta) onText(rec.delta);
          else if (typeof rec.summary === 'string') {
            // Treat summary as a full replacement.
            onText(String(rec.summary));
          }
        } catch {
          // Not JSON; treat as raw delta.
          onText(dataStr);
        }
      }
    }
  }
}

export function useAiSummary(opts: {
  apiUrl: string | null | undefined;
  activeConversationId: string;
  peer: string | null | undefined;
  messages: ChatMessage[];
  fetchAuthSession: () => Promise<{ tokens?: { idToken?: { toString: () => string } } }>;
  showAlert: (title: string, body: string) => void;
  openInfo: (title: string, body: string) => void;
}) {
  const { apiUrl, activeConversationId, peer, messages, fetchAuthSession, showAlert, openInfo } =
    opts;

  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState<string>('');
  const [loading, setLoading] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  const close = React.useCallback(() => {
    try {
      abortRef.current?.abort();
    } catch {
      // ignore
    }
    abortRef.current = null;
    setOpen(false);
    setText('');
  }, []);

  const summarize = React.useCallback(async () => {
    if (!apiUrl) {
      showAlert('AI not configured', 'API_URL is not configured.');
      return;
    }
    try {
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setLoading(true);
      setOpen(true);
      setText('');

      const { tokens } = await fetchAuthSession();
      const idToken = tokens?.idToken?.toString();
      if (!idToken) throw new Error('Not authenticated');

      const transcript = buildAiSummaryTranscript({ messages, maxMessages: 25 });
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
        signal: abortRef.current.signal,
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

      // If the server supports streaming (SSE or chunked text), show partial output as it arrives.
      const contentType = (resp.headers.get('content-type') || '').toLowerCase();
      if (Platform.OS === 'web' && contentType.includes('text/event-stream')) {
        let acc = '';
        await readTextResponseStream({
          response: resp,
          signal: abortRef.current.signal,
          onText: (deltaOrFull) => {
            // SSE `delta` chunks can contain newlines (including blank lines). Never treat that as a full replacement.
            // The only "full replacement" case is if the server explicitly sends a complete `summary` payload.
            if (deltaOrFull.length >= acc.length && deltaOrFull.startsWith(acc)) acc = deltaOrFull;
            else acc += deltaOrFull;
            setText(acc);
          },
        });
      } else {
        const data: unknown = await resp.json().catch(() => ({}));
        const rec = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
        const summary = typeof rec.summary === 'string' ? rec.summary : String(rec.summary ?? '');
        setText(summary);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : 'Unknown error';
      showAlert('Summary failed', msg);
      setOpen(false);
    } finally {
      abortRef.current = null;
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
