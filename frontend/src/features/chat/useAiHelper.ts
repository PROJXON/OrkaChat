import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';
import { findNodeHandle, Platform, type ScrollView, UIManager, type View } from 'react-native';

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
          const rec =
            parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
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

function dedupeAdjacentUserTurns(turns: AiHelperTurn[]): AiHelperTurn[] {
  if (!Array.isArray(turns) || turns.length < 2) return turns;
  const next: AiHelperTurn[] = [];
  for (const t of turns) {
    const prev = next[next.length - 1];
    if (
      prev &&
      prev.role === 'user' &&
      t.role === 'user' &&
      String(prev.text || '').trim() === String(t.text || '').trim()
    ) {
      // The AI helper UI can't submit twice while `loading` is true, so adjacent identical user turns
      // are always a server/client merge artifact. Drop the duplicate defensively.
      continue;
    }
    next.push(t);
  }
  return next;
}

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
  const [mode, setModeState] = React.useState<'ask' | 'reply'>('ask');

  // Refs to avoid stale-state races (e.g. toggling Ask/Draft then immediately submitting).
  const threadRef = React.useRef<AiHelperTurn[]>([]);
  React.useEffect(() => {
    threadRef.current = thread;
  }, [thread]);
  const resetThreadRef = React.useRef<boolean>(false);
  React.useEffect(() => {
    resetThreadRef.current = resetThread;
  }, [resetThread]);
  const modeRef = React.useRef<'ask' | 'reply'>('ask');
  React.useEffect(() => {
    // Keep in sync in case state is updated elsewhere.
    modeRef.current = mode;
  }, [mode]);
  const setMode = React.useCallback((m: 'ask' | 'reply') => {
    // Critical: update ref synchronously so submit() sees the latest mode
    // even if the user toggles and submits before React commits the render.
    modeRef.current = m;
    setModeState(m);
  }, []);

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
  const scrollYRef = React.useRef<number>(0);
  const scrollContentRef = React.useRef<View | null>(null);
  const lastTurnRef = React.useRef<View | null>(null);
  const lastAssistantLayoutRef = React.useRef<null | { y: number; height: number }>(null);
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
  const lastAutoScrollModeRef = React.useRef<null | 'end' | 'bubble'>(null);
  const reopenScrollToEndRef = React.useRef<boolean>(false);
  const reopenAfterBottomRef = React.useRef<boolean>(false);

  // RN-web tends to under-scroll slightly when pinning to a specific child.
  // This nudges the bubble a bit closer to the top (clamped to endY).
  const WEB_PIN_TO_BUBBLE_OFFSET_PX = 33;

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
      if (Platform.OS === 'web' && (viewportH <= 0 || contentH <= 0)) {
        scheduleRetry();
        return;
      }
      if (scrollRef.current?.scrollToEnd) {
        const animateThisScroll = !(
          Platform.OS === 'web' &&
          reopenScrollToEndRef.current &&
          autoScrollRetryRef.current.attempts > 0
        );
        scrollRef.current.scrollToEnd({ animated: animateThisScroll });
        lastAutoScrollAtRef.current = Date.now();
        lastAutoScrollContentHRef.current = Math.max(0, Math.floor(scrollContentHRef.current || 0));
        lastAutoScrollModeRef.current = 'end';
        // RN-web: programmatic scroll doesn't always fire onScroll; just retry a few times on reopen
        // so we reliably land at the true bottom after layout settles.
        if (Platform.OS === 'web' && reopenScrollToEndRef.current) {
          if (autoScrollRetryRef.current.attempts < 12) {
            scheduleRetry();
            return;
          }
          reopenScrollToEndRef.current = false;
        }
        if (Platform.OS === 'web') {
          const latestViewportH = Math.max(0, Math.floor(scrollViewportHRef.current || 0));
          const latestContentH = Math.max(0, Math.floor(scrollContentHRef.current || 0));
          const latestEndY =
            latestViewportH > 0 ? Math.max(0, latestContentH - latestViewportH) : 0;
          const yNow = Math.max(0, Math.floor(scrollYRef.current || 0));
          const remaining = latestEndY - yNow;
          if (remaining > 3) {
            scheduleRetry();
            return;
          }
        }
        if (Platform.OS === 'web' && reopenAfterBottomRef.current) {
          // Phase 2: after we settle at the bottom, run the "answer" scroll logic
          // so big last messages pin to their top on reopen.
          reopenAfterBottomRef.current = false;
          reopenScrollToEndRef.current = false;
          autoScrollRetryRef.current.attempts = 0;
          autoScrollIntentRef.current = 'answer';
          setTimeout(() => autoScroll(), 0);
          return;
        }

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
      const animateThisScroll = !(
        Platform.OS === 'web' &&
        reopenScrollToEndRef.current &&
        autoScrollRetryRef.current.attempts > 0
      );
      scrollRef.current?.scrollTo({ y: endY, animated: animateThisScroll });
      lastAutoScrollAtRef.current = Date.now();
      lastAutoScrollContentHRef.current = Math.max(0, Math.floor(scrollContentHRef.current || 0));
      lastAutoScrollModeRef.current = 'end';
      if (Platform.OS === 'web') {
        const yNow = Math.max(0, Math.floor(scrollYRef.current || 0));
        const remaining = endY - yNow;
        if (remaining > 3) {
          scheduleRetry();
          return;
        }
      }
      if (Platform.OS === 'web' && reopenAfterBottomRef.current) {
        reopenAfterBottomRef.current = false;
        reopenScrollToEndRef.current = false;
        autoScrollRetryRef.current.attempts = 0;
        autoScrollIntentRef.current = 'answer';
        setTimeout(() => autoScroll(), 0);
        return;
      }

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
      // RN-web: prefer onLayout coordinates (more reliable than UIManager.measureLayout there).
      if (Platform.OS === 'web' && lastAssistantLayoutRef.current) {
        const yRaw = lastAssistantLayoutRef.current.y;
        const bubbleHRaw = lastAssistantLayoutRef.current.height;
        const bubbleTopY = Math.max(0, Math.floor(Number(yRaw)));
        if (Number.isFinite(bubbleTopY)) {
          const latestViewportH = Math.max(0, Math.floor(scrollViewportHRef.current || 0));
          const latestContentH = Math.max(0, Math.floor(scrollContentHRef.current || 0));
          const latestEndY =
            latestViewportH > 0 ? Math.max(0, latestContentH - latestViewportH) : 0;
          const bubbleH = Math.max(0, Math.floor(Number(bubbleHRaw || 0)));
          const responseH = Math.max(0, Math.floor(latestContentH - bubbleTopY));
          const isBig = bubbleH > 0 ? bubbleH > latestViewportH : responseH > latestViewportH;
          const targetYRaw = isBig ? bubbleTopY : latestEndY;
          const targetY =
            Platform.OS === 'web' && targetYRaw === bubbleTopY
              ? Math.min(latestEndY, bubbleTopY + WEB_PIN_TO_BUBBLE_OFFSET_PX)
              : targetYRaw;
          const animated = targetY === bubbleTopY ? false : true;
          if (targetYRaw === latestEndY && scrollRef.current?.scrollToEnd) {
            const animateThisScroll = !(
              Platform.OS === 'web' &&
              reopenScrollToEndRef.current &&
              autoScrollRetryRef.current.attempts > 0
            );
            scrollRef.current.scrollToEnd({ animated: animateThisScroll });
          } else {
            scrollRef.current?.scrollTo({ y: targetY, animated });
          }
          lastAutoScrollAtRef.current = Date.now();
          lastAutoScrollContentHRef.current = latestContentH;
          lastAutoScrollModeRef.current = targetYRaw === bubbleTopY ? 'bubble' : 'end';

          // Web reopen: if we're targeting bottom, do a short burst of scrollToEnd() calls
          // (RN-web may not apply/settle the bottom position on the first tick).
          if (Platform.OS === 'web' && reopenScrollToEndRef.current && targetYRaw === latestEndY) {
            if (autoScrollRetryRef.current.attempts < 12) {
              scheduleRetry();
              return true;
            }
            reopenScrollToEndRef.current = false;
          }

          // RN-web: scrolling to end can land mid-way during initial layout ticks.
          // Keep retrying briefly until we observe we're actually at the bottom.
          if (Platform.OS === 'web' && targetYRaw === latestEndY) {
            const yNow = Math.max(0, Math.floor(scrollYRef.current || 0));
            const remaining = latestEndY - yNow;
            if (remaining > 3) {
              scheduleRetry();
              return true;
            }
          }

          autoScrollIntentRef.current = null;
          if (autoScrollRetryRef.current.timer) clearTimeout(autoScrollRetryRef.current.timer);
          autoScrollRetryRef.current.timer = null;
          autoScrollRetryRef.current.attempts = 0;
          return true;
        }
      }

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
          (_x: number, y: number, _w: number, h: number) => {
            const bubbleTopY = Math.max(0, Math.floor(y));
            const latestViewportH = Math.max(0, Math.floor(scrollViewportHRef.current || 0));
            const latestContentH = Math.max(0, Math.floor(scrollContentHRef.current || 0));
            const latestEndY =
              latestViewportH > 0 ? Math.max(0, latestContentH - latestViewportH) : 0;
            const bubbleH = Math.max(0, Math.floor(Number(h || 0)));
            const responseH = Math.max(0, Math.floor(latestContentH - bubbleTopY));
            const isBig = bubbleH > 0 ? bubbleH > latestViewportH : responseH > latestViewportH;
            const targetYRaw = isBig ? bubbleTopY : latestEndY;
            const targetY =
              Platform.OS === 'web' && targetYRaw === bubbleTopY
                ? Math.min(latestEndY, bubbleTopY + WEB_PIN_TO_BUBBLE_OFFSET_PX)
                : targetYRaw;
            const animated = targetY === bubbleTopY ? false : true;
            if (targetYRaw === latestEndY && scrollRef.current?.scrollToEnd) {
              const animateThisScroll = !(
                Platform.OS === 'web' &&
                reopenScrollToEndRef.current &&
                autoScrollRetryRef.current.attempts > 0
              );
              scrollRef.current.scrollToEnd({ animated: animateThisScroll });
            } else {
              scrollRef.current?.scrollTo({ y: targetY, animated });
            }
            lastAutoScrollAtRef.current = Date.now();
            lastAutoScrollContentHRef.current = latestContentH;
            lastAutoScrollModeRef.current = targetYRaw === bubbleTopY ? 'bubble' : 'end';

            // Web reopen: if we're targeting bottom, do a short burst of scrollToEnd() calls.
            if (
              Platform.OS === 'web' &&
              reopenScrollToEndRef.current &&
              targetYRaw === latestEndY
            ) {
              if (autoScrollRetryRef.current.attempts < 12) {
                scheduleRetry();
                return;
              }
              reopenScrollToEndRef.current = false;
            }

            // RN-web: scrolling to end can land mid-way during initial layout ticks.
            // Keep retrying briefly until we observe we're actually at the bottom.
            if (Platform.OS === 'web' && targetYRaw === latestEndY) {
              const yNow = Math.max(0, Math.floor(scrollYRef.current || 0));
              const remaining = latestEndY - yNow;
              if (remaining > 3) {
                scheduleRetry();
                return;
              }
            }

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

  const requestAutoScrollToLatestAssistant = React.useCallback(
    (intent: 'thinking' | 'answer') => {
      // Reset scroll measurement so we don't use stale nodes.
      lastTurnRef.current = null;
      lastAssistantLayoutRef.current = null;
      lastAutoScrollModeRef.current = null;
      if (autoScrollRetryRef.current.timer) clearTimeout(autoScrollRetryRef.current.timer);
      autoScrollRetryRef.current.timer = null;
      autoScrollRetryRef.current.attempts = 0;
      autoScrollIntentRef.current = intent;
      // Run on next tick so layout refs have a chance to update.
      setTimeout(() => autoScroll(), 0);
    },
    [autoScroll],
  );

  const openHelper = React.useCallback(() => {
    setOpen(true);
    setLoading(false);
    setInstruction('');
    // Keep `thread` so follow-up questions work across open/close.
    // Reopen with history: scroll to bottom unless the last assistant bubble is bigger
    // than the viewport (then pin to the top of that bubble).
    if (thread.length) {
      if (Platform.OS === 'web') reopenScrollToEndRef.current = true;
      if (Platform.OS === 'web') {
        reopenAfterBottomRef.current = true;
        requestAutoScrollToLatestAssistant('thinking');
      } else {
        requestAutoScrollToLatestAssistant('answer');
      }
    }
  }, [requestAutoScrollToLatestAssistant, thread.length]);

  const closeHelper = React.useCallback(() => {
    try {
      abortRef.current?.abort();
    } catch {
      // ignore
    }
    abortRef.current = null;
    reopenScrollToEndRef.current = false;
    reopenAfterBottomRef.current = false;
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
    lastAssistantLayoutRef.current = null;
    lastAutoScrollModeRef.current = null;
    reopenScrollToEndRef.current = false;
    reopenAfterBottomRef.current = false;
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
    lastAssistantLayoutRef.current = null;
    lastAutoScrollModeRef.current = null;
    setModeState('ask');
    modeRef.current = 'ask';
    reopenScrollToEndRef.current = false;
    reopenAfterBottomRef.current = false;
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
        if (hydrated.length) {
          setThread(hydrated);
          // After hydration: scroll to bottom unless the last assistant bubble is bigger
          // than the viewport (then pin to the top of that bubble).
          if (Platform.OS === 'web') reopenScrollToEndRef.current = true;
          if (Platform.OS === 'web') {
            reopenAfterBottomRef.current = true;
            requestAutoScrollToLatestAssistant('thinking');
          } else {
            requestAutoScrollToLatestAssistant('answer');
          }
        }
      } catch {
        // ignore
      }
    })();
  }, [open, requestAutoScrollToLatestAssistant, storageKey, thread.length]);

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

      const modeNow = modeRef.current;
      const threadBefore = threadRef.current;
      const shouldResetThread = resetThreadRef.current;
      setResetThread(false);
      resetThreadRef.current = false;
      reopenScrollToEndRef.current = false;

      if (autoScrollRetryRef.current.timer) clearTimeout(autoScrollRetryRef.current.timer);
      autoScrollRetryRef.current.timer = null;
      autoScrollRetryRef.current.attempts = 0;
      autoScrollIntentRef.current = 'thinking';
      // We're about to render a new "last assistant" turn; discard any previous measurement.
      lastTurnRef.current = null;

      const localUserTurn: AiHelperTurn = { role: 'user', text: instructionTrimmed };
      setThread((prev) => [
        ...prev,
        localUserTurn,
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
          wantReplies: modeNow === 'reply',
          messages: transcript,
          // Include the user turn we just added so the backend thread cannot omit it.
          thread: threadForApi([...threadBefore, localUserTurn]),
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
            // Safety: ensure the submitted user turn is present (some backend paths may omit it).
            if (instructionTrimmed) {
              const want = instructionTrimmed.trim();
              const has = nextThread.some((t) => t.role === 'user' && t.text.trim() === want);
              if (!has) nextThread = [...nextThread, localUserTurn];
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
            nextThread = dedupeAdjacentUserTurns(nextThread);
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
        // Safety: ensure the submitted user turn is present (some backend paths may omit it).
        if (instructionTrimmed) {
          const want = instructionTrimmed.trim();
          const has = nextThread.some((t) => t.role === 'user' && t.text.trim() === want);
          if (!has) nextThread = [...nextThread, localUserTurn];
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
        nextThread = dedupeAdjacentUserTurns(nextThread);

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
    openInfo,
    peer,
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
    scrollYRef,
    lastAutoScrollAtRef,
    lastAutoScrollContentHRef,
    lastAutoScrollModeRef,
    autoScrollRetryRef,
    autoScrollIntentRef,
    lastAssistantLayoutRef,
    autoScroll: autoScroll,
  };
}
