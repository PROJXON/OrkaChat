import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';
import { Platform } from 'react-native';
import type { ScrollView, View } from 'react-native';
import { findNodeHandle, UIManager } from 'react-native';

import { buildAiHelperContext } from './aiHelperContext';
import type { ChatMessage } from './types';

async function readSseTextDeltas(opts: {
  response: Response;
  onDelta: (delta: string) => void;
  onFinal?: (finalJson: Record<string, unknown>) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const { response, onDelta, onFinal, signal } = opts;
  const body: unknown = (response as unknown as { body?: unknown }).body;
  const contentType = (response.headers.get('content-type') || '').toLowerCase();

  if (Platform.OS !== 'web') throw new Error('Streaming not supported on this platform');
  if (!contentType.includes('text/event-stream')) throw new Error('Not an SSE response');
  if (!body || typeof (body as { getReader?: unknown }).getReader !== 'function') {
    throw new Error('Streaming body not available');
  }

  const reader = (body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let buf = '';

  const nextEventBreakIdx = (s: string): { idx: number; sepLen: number } | null => {
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
    buf += decoder.decode(value, { stream: true });

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
          if (typeof rec.delta === 'string' && rec.delta) onDelta(rec.delta);
          else if (rec.final && typeof rec.final === 'object') {
            onFinal?.(rec.final as Record<string, unknown>);
          } else if (typeof rec.answer === 'string') {
            // Some servers may stream full replacements.
            onDelta(String(rec.answer));
          }
        } catch {
          // Not JSON; treat as text delta.
          onDelta(dataStr);
        }
      }
    }
  }
}

export type AiHelperTurn = {
  role: 'user' | 'assistant';
  text: string;
  thinking?: boolean;
  suggestions?: string[];
};

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message || 'Unknown error';
  if (typeof err === 'string') return err || 'Unknown error';
  if (!err) return 'Unknown error';
  try {
    const rec = err as Record<string, unknown>;
    const msg = rec?.message;
    return typeof msg === 'string' && msg ? msg : 'Unknown error';
  } catch {
    return 'Unknown error';
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

function parseAiHelperTurn(v: unknown): AiHelperTurn | null {
  if (!isRecord(v)) return null;
  const role = v.role;
  const text = v.text;
  if (role !== 'user' && role !== 'assistant') return null;
  if (typeof text !== 'string') return null;
  const thinking = typeof v.thinking === 'boolean' ? v.thinking : undefined;
  const suggestionsRaw = v.suggestions;
  const suggestions = Array.isArray(suggestionsRaw)
    ? suggestionsRaw
        .map((s) => (typeof s === 'string' ? s.trim() : String(s ?? '').trim()))
        .filter(Boolean)
        .slice(0, 3)
    : undefined;
  return {
    role,
    text,
    ...(typeof thinking === 'boolean' ? { thinking } : {}),
    ...(suggestions?.length ? { suggestions } : {}),
  };
}

function threadForApi(thread: AiHelperTurn[]): Array<{ role: 'user' | 'assistant'; text: string }> {
  return thread.map((t) => ({ role: t.role, text: t.text }));
}

function mergeHistoricSuggestions(prev: AiHelperTurn[], next: AiHelperTurn[]): AiHelperTurn[] {
  // Server threads typically don't include per-turn suggestions; preserve any locally-stored
  // suggestions by aligning assistant turns in-order and matching on text.
  const prevAssistant: Array<{ text: string; suggestions?: string[] }> = [];
  for (const t of prev) {
    if (t?.role === 'assistant') prevAssistant.push({ text: t.text, suggestions: t.suggestions });
  }
  if (!prevAssistant.length) return next;

  const out = next.slice();
  let aIdx = -1;
  for (let i = 0; i < out.length; i++) {
    const t = out[i];
    if (t?.role !== 'assistant') continue;
    aIdx += 1;
    if (t.suggestions?.length) continue;
    const p = prevAssistant[aIdx];
    if (!p?.suggestions?.length) continue;
    if (typeof p.text === 'string' && typeof t.text === 'string' && p.text === t.text) {
      out[i] = { ...t, suggestions: p.suggestions };
    }
  }
  return out;
}

function sanitizeThreadForStorage(thread: AiHelperTurn[]): AiHelperTurn[] {
  // Don't persist ephemeral "Thinking" placeholder turns.
  return thread
    .filter((t) => !t?.thinking)
    .map((t) => ({
      role: t.role,
      text: t.text,
      ...(t.suggestions?.length ? { suggestions: t.suggestions } : {}),
    }));
}

export function useAiHelper(opts: {
  apiUrl: string | null | undefined;
  activeConversationId: string;
  peer: string | null | undefined;
  messages: ChatMessage[];
  isDm: boolean;
  mediaUrlByPath: Record<string, string>;
  cdnResolve: (path: string) => string;
  fetchAuthSession: () => Promise<{ tokens?: { idToken?: { toString: () => string } } }>;
  openInfo: (title: string, body: string) => void;
}) {
  const {
    apiUrl,
    activeConversationId,
    peer,
    messages,
    isDm,
    mediaUrlByPath,
    cdnResolve,
    fetchAuthSession,
    openInfo,
  } = opts;

  const [open, setOpen] = React.useState(false);
  const [instruction, setInstruction] = React.useState<string>('');
  const [loading, setLoading] = React.useState<boolean>(false);
  const [thread, setThread] = React.useState<AiHelperTurn[]>([]);
  const [resetThread, setResetThread] = React.useState<boolean>(false);
  const [mode, setMode] = React.useState<'ask' | 'reply'>('ask');

  const storageKey = React.useMemo(
    () => `aiHelperThread:v1:${String(activeConversationId || '').trim() || 'unknown'}`,
    [activeConversationId],
  );
  const hydrateRunRef = React.useRef<number>(0);
  const persistTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const scrollRef = React.useRef<ScrollView | null>(null);
  const scrollViewportHRef = React.useRef<number>(0);
  const scrollContentHRef = React.useRef<number>(0);
  const scrollContentRef = React.useRef<View | null>(null);
  const lastTurnRef = React.useRef<View | null>(null);
  const autoScrollRetryRef = React.useRef<{
    timer: ReturnType<typeof setTimeout> | null;
    attempts: number;
  }>({
    timer: null,
    attempts: 0,
  });
  const autoScrollIntentRef = React.useRef<null | 'thinking' | 'answer'>(null);
  const lastAutoScrollAtRef = React.useRef<number>(0);
  const lastAutoScrollContentHRef = React.useRef<number>(0);

  const openHelper = React.useCallback(() => {
    setOpen(true);
    setLoading(false);
    setInstruction('');
    // Keep `thread` so follow-up questions work across open/close.
  }, []);

  const closeHelper = React.useCallback(() => {
    try {
      abortRef.current?.abort();
    } catch {
      // ignore
    }
    abortRef.current = null;
    setOpen(false);
    setInstruction('');
    // Keep `thread` so history (incl. reply options) persists across open/close.
  }, []);

  const resetHelperThread = React.useCallback(() => {
    setThread([]);
    setResetThread(true);
    setInstruction('');
    // Reset scroll measurement so next answer doesn't use stale nodes.
    lastTurnRef.current = null;
    // Also clear persisted history for this conversation.
    void AsyncStorage.removeItem(storageKey).catch(() => {});
  }, [storageKey]);

  // If the user switches conversations, treat AI helper history as per-conversation.
  React.useEffect(() => {
    setThread([]);
    setResetThread(false);
    setInstruction('');
    setLoading(false);
    lastTurnRef.current = null;
  }, [activeConversationId]);

  // Hydrate persisted helper history when opening (and after refresh).
  React.useEffect(() => {
    if (!open) return;
    if (thread.length) return;
    const runId = Date.now();
    hydrateRunRef.current = runId;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (!raw) return;
        if (hydrateRunRef.current !== runId) return;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;
        const hydrated = parsed.map(parseAiHelperTurn).filter((t): t is AiHelperTurn => !!t);
        if (hydrated.length) setThread(hydrated);
      } catch {
        // ignore
      }
    })();
  }, [open, storageKey, thread.length]);

  // Persist thread updates so refresh/reopen shows history immediately.
  React.useEffect(() => {
    if (!thread.length) return;
    const cleaned = sanitizeThreadForStorage(thread);
    if (!cleaned.length) return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      void AsyncStorage.setItem(storageKey, JSON.stringify(cleaned)).catch(() => {});
    }, 200);
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    };
  }, [storageKey, thread]);

  const autoScroll = React.useCallback(() => {
    if (!open) return;
    if (!thread.length) return;
    const viewportH = Math.max(0, Math.floor(scrollViewportHRef.current || 0));
    const contentH = Math.max(0, Math.floor(scrollContentHRef.current || 0));
    const intent = autoScrollIntentRef.current;
    if (!intent) return;

    const scheduleRetry = () => {
      if (autoScrollRetryRef.current.attempts < 20) {
        autoScrollRetryRef.current.attempts += 1;
        if (autoScrollRetryRef.current.timer) clearTimeout(autoScrollRetryRef.current.timer);
        autoScrollRetryRef.current.timer = setTimeout(() => autoScroll(), 50);
      }
    };

    const endY = viewportH > 0 ? Math.max(0, contentH - viewportH) : 0;

    if (intent === 'thinking') {
      if (scrollRef.current?.scrollToEnd) {
        scrollRef.current.scrollToEnd({ animated: true });
        lastAutoScrollAtRef.current = Date.now();
        lastAutoScrollContentHRef.current = Math.max(0, Math.floor(scrollContentHRef.current || 0));
        autoScrollIntentRef.current = null;
        if (autoScrollRetryRef.current.timer) clearTimeout(autoScrollRetryRef.current.timer);
        autoScrollRetryRef.current.timer = null;
        autoScrollRetryRef.current.attempts = 0;
        return;
      }
      if (viewportH <= 0 || contentH <= 0) {
        scheduleRetry();
        return;
      }
      scrollRef.current?.scrollTo({ y: endY, animated: true });
      lastAutoScrollAtRef.current = Date.now();
      lastAutoScrollContentHRef.current = Math.max(0, Math.floor(scrollContentHRef.current || 0));
      autoScrollIntentRef.current = null;
      if (autoScrollRetryRef.current.timer) clearTimeout(autoScrollRetryRef.current.timer);
      autoScrollRetryRef.current.timer = null;
      autoScrollRetryRef.current.attempts = 0;
      return;
    }

    if (viewportH <= 0 || contentH <= 0) {
      scheduleRetry();
      return;
    }

    const measureLastTurnAndScroll = () => {
      const contentNode = scrollContentRef.current;
      const lastNode = lastTurnRef.current;
      if (!contentNode || !lastNode) return false;
      try {
        const contentHandle = findNodeHandle(contentNode);
        const lastHandle = findNodeHandle(lastNode);
        if (!contentHandle || !lastHandle) return false;
        UIManager.measureLayout(
          lastHandle,
          contentHandle,
          () => {
            // measure failed; keep intent so we retry on next layout tick
          },
          (_x: number, y: number) => {
            const bubbleTopY = Math.max(0, Math.floor(y));
            const latestViewportH = Math.max(0, Math.floor(scrollViewportHRef.current || 0));
            const latestContentH = Math.max(0, Math.floor(scrollContentHRef.current || 0));
            const latestEndY =
              latestViewportH > 0 ? Math.max(0, latestContentH - latestViewportH) : 0;
            const responseH = Math.max(0, Math.floor(latestContentH - bubbleTopY));
            const targetY = responseH > latestViewportH ? bubbleTopY : latestEndY;
            const animated = targetY === bubbleTopY ? false : true;
            scrollRef.current?.scrollTo({ y: targetY, animated });
            lastAutoScrollAtRef.current = Date.now();
            lastAutoScrollContentHRef.current = latestContentH;

            autoScrollIntentRef.current = null;
            if (autoScrollRetryRef.current.timer) clearTimeout(autoScrollRetryRef.current.timer);
            autoScrollRetryRef.current.timer = null;
            autoScrollRetryRef.current.attempts = 0;
          },
        );
        return true;
      } catch {
        return false;
      }
    };

    if (intent === 'answer') {
      const ok = measureLastTurnAndScroll();
      if (!ok) scheduleRetry();
      return;
    }
  }, [open, thread.length]);

  React.useEffect(() => {
    const id = setTimeout(() => autoScroll(), loading ? 0 : 60);
    return () => clearTimeout(id);
  }, [autoScroll, thread.length, loading]);

  const submit = React.useCallback(async () => {
    if (!apiUrl) {
      openInfo('AI not configured', 'API_URL is not configured.');
      return;
    }
    if (loading) return;
    const instructionTrimmed = instruction.trim();
    if (!instructionTrimmed) {
      openInfo('Ask a question', 'Type what you want help with first');
      return;
    }

    try {
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setInstruction('');
      setLoading(true);

      const { tokens } = await fetchAuthSession();
      const idToken = tokens?.idToken?.toString();
      if (!idToken) throw new Error('Not authenticated');

      const threadBefore = thread;
      const shouldResetThread = resetThread;
      setResetThread(false);

      if (autoScrollRetryRef.current.timer) clearTimeout(autoScrollRetryRef.current.timer);
      autoScrollRetryRef.current.timer = null;
      autoScrollRetryRef.current.attempts = 0;
      autoScrollIntentRef.current = 'thinking';
      // We're about to render a new "last assistant" turn; discard any previous measurement.
      lastTurnRef.current = null;

      setThread((prev) => [
        ...prev,
        { role: 'user', text: instructionTrimmed },
        { role: 'assistant', text: '', thinking: true },
      ]);

      const { transcript, attachments: attachmentsForAi } = buildAiHelperContext({
        messages,
        isDm,
        mediaUrlByPath,
        cdnResolve,
        maxMessages: 25,
        maxThumbs: 3,
      });

      const resp = await fetch(`${apiUrl.replace(/\/$/, '')}/ai/helper`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: activeConversationId,
          peer: peer ?? null,
          instruction: instructionTrimmed,
          wantReplies: mode === 'reply',
          messages: transcript,
          thread: threadForApi(threadBefore),
          resetThread: shouldResetThread,
          attachments: attachmentsForAi,
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
          setThread(threadBefore);
          openInfo('AI limit reached', msg);
          return;
        }
        throw new Error(`AI helper failed (${resp.status}): ${bodyText || 'no body'}`);
      }

      const contentType = (resp.headers.get('content-type') || '').toLowerCase();

      // Optional streaming: if the server returns SSE, progressively fill the last assistant bubble.
      if (Platform.OS === 'web' && contentType.includes('text/event-stream')) {
        let acc = '';
        // Replace the "thinking" placeholder with an empty assistant bubble we can append to.
        setThread((prev) => {
          const next = prev.slice();
          if (
            next.length &&
            next[next.length - 1]?.role === 'assistant' &&
            next[next.length - 1]?.thinking
          ) {
            next.pop();
          }
          next.push({ role: 'assistant', text: '' });
          return next;
        });

        const applyFinal = (rec: Record<string, unknown>) => {
          const nextAnswer =
            typeof rec.answer === 'string' ? rec.answer.trim() : String(rec.answer ?? '').trim();
          const nextSuggestions = Array.isArray(rec.suggestions)
            ? rec.suggestions
                .map((s) => (typeof s === 'string' ? s.trim() : String(s ?? '').trim()))
                .filter(Boolean)
                .slice(0, 3)
            : [];
          if (Array.isArray(rec.thread)) {
            const parsedThread = rec.thread
              .map(parseAiHelperTurn)
              .filter((t): t is AiHelperTurn => !!t);
            let nextThread = parsedThread;
            if (!shouldResetThread) {
              nextThread = mergeHistoricSuggestions(threadBefore, nextThread);
            }
            if (nextSuggestions.length) {
              let lastAssistantIdx = -1;
              for (let i = nextThread.length - 1; i >= 0; i--) {
                if (nextThread[i]?.role === 'assistant') {
                  lastAssistantIdx = i;
                  break;
                }
              }
              if (lastAssistantIdx >= 0) {
                const t = nextThread[lastAssistantIdx];
                nextThread = nextThread.slice();
                nextThread[lastAssistantIdx] = { ...t, suggestions: nextSuggestions };
              }
            }
            lastTurnRef.current = null;
            if (autoScrollRetryRef.current.timer) clearTimeout(autoScrollRetryRef.current.timer);
            autoScrollRetryRef.current.timer = null;
            autoScrollRetryRef.current.attempts = 0;
            autoScrollIntentRef.current = 'answer';
            if (nextThread.length) setThread(nextThread);
            return;
          }
          // No thread provided; update last assistant bubble with streamed answer + suggestions.
          setThread((prev) => {
            const next = prev.slice();
            for (let i = next.length - 1; i >= 0; i--) {
              if (next[i]?.role !== 'assistant') continue;
              next[i] = {
                role: 'assistant',
                text: nextAnswer || acc,
                ...(nextSuggestions.length ? { suggestions: nextSuggestions } : {}),
              };
              break;
            }
            return next;
          });
        };

        await readSseTextDeltas({
          response: resp,
          signal: abortRef.current.signal,
          onDelta: (deltaOrFull) => {
            // Heuristic: if server sends full replacements, prefer them.
            if (deltaOrFull.length >= acc.length && (deltaOrFull.startsWith(acc) || acc === '')) {
              acc = deltaOrFull;
            } else {
              acc += deltaOrFull;
            }
            setThread((prev) => {
              const next = prev.slice();
              for (let i = next.length - 1; i >= 0; i--) {
                if (next[i]?.role !== 'assistant') continue;
                if (next[i]?.thinking) continue;
                next[i] = { ...next[i], text: acc };
                break;
              }
              return next;
            });
          },
          onFinal: (finalJson) => applyFinal(finalJson),
        });
        // If the server never sent a final payload, keep the streamed text as the answer.
        if (acc.trim().length) {
          setThread((prev) => {
            const next = prev.slice();
            for (let i = next.length - 1; i >= 0; i--) {
              if (next[i]?.role !== 'assistant') continue;
              if (next[i]?.thinking) continue;
              next[i] = { ...next[i], text: acc.trim() };
              break;
            }
            return next;
          });
        }
        return;
      }

      const data = await resp.json().catch(() => ({}));
      const rec = isRecord(data) ? data : {};
      const nextAnswer =
        typeof rec.answer === 'string' ? rec.answer.trim() : String(rec.answer ?? '').trim();
      const nextSuggestions = Array.isArray(rec.suggestions)
        ? rec.suggestions
            .map((s) => (typeof s === 'string' ? s.trim() : String(s ?? '').trim()))
            .filter(Boolean)
            .slice(0, 3)
        : [];

      if (Array.isArray(rec.thread)) {
        const parsedThread = rec.thread
          .map(parseAiHelperTurn)
          .filter((t): t is AiHelperTurn => !!t);
        let nextThread = parsedThread;
        if (!shouldResetThread) {
          nextThread = mergeHistoricSuggestions(threadBefore, nextThread);
        }
        if (nextSuggestions.length) {
          // Attach reply options to the latest assistant turn in the thread.
          let lastAssistantIdx = -1;
          for (let i = nextThread.length - 1; i >= 0; i--) {
            if (nextThread[i]?.role === 'assistant') {
              lastAssistantIdx = i;
              break;
            }
          }
          if (lastAssistantIdx >= 0) {
            const t = nextThread[lastAssistantIdx];
            nextThread = nextThread.slice();
            nextThread[lastAssistantIdx] = { ...t, suggestions: nextSuggestions };
          }
        }

        lastTurnRef.current = null;
        if (autoScrollRetryRef.current.timer) clearTimeout(autoScrollRetryRef.current.timer);
        autoScrollRetryRef.current.timer = null;
        autoScrollRetryRef.current.attempts = 0;
        autoScrollIntentRef.current = 'answer';
        if (nextThread.length) setThread(nextThread);
      } else if (nextAnswer || nextSuggestions.length) {
        lastTurnRef.current = null;
        if (autoScrollRetryRef.current.timer) clearTimeout(autoScrollRetryRef.current.timer);
        autoScrollRetryRef.current.timer = null;
        autoScrollRetryRef.current.attempts = 0;
        autoScrollIntentRef.current = 'answer';
        setThread((prev) => {
          const next = prev.slice();
          if (
            next.length &&
            next[next.length - 1]?.role === 'assistant' &&
            next[next.length - 1]?.thinking
          ) {
            next.pop();
          }
          next.push({
            role: 'assistant',
            text: nextAnswer,
            ...(nextSuggestions.length ? { suggestions: nextSuggestions } : {}),
          });
          return next;
        });
      }
    } catch (e: unknown) {
      openInfo('AI helper failed', getErrorMessage(e));
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  }, [
    activeConversationId,
    apiUrl,
    cdnResolve,
    fetchAuthSession,
    instruction,
    isDm,
    loading,
    mediaUrlByPath,
    messages,
    mode,
    openInfo,
    peer,
    resetThread,
    thread,
  ]);

  return {
    open,
    openHelper,
    closeHelper,
    instruction,
    setInstruction,
    loading,
    thread,
    mode,
    setMode,
    submit,
    resetHelperThread,
    // scroll plumbing for AiHelperModal
    scrollRef,
    scrollContentRef,
    lastTurnRef,
    scrollViewportHRef,
    scrollContentHRef,
    lastAutoScrollAtRef,
    lastAutoScrollContentHRef,
    autoScrollRetryRef,
    autoScrollIntentRef,
    autoScroll: autoScroll,
  };
}
