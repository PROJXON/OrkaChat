import * as React from 'react';
import { UIManager, findNodeHandle, ScrollView, View } from 'react-native';
import { buildAiHelperContext } from './aiHelperContext';
import type { ChatMessage } from './types';

export type AiHelperTurn = { role: 'user' | 'assistant'; text: string; thinking?: boolean };

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
  return { role, text, ...(typeof thinking === 'boolean' ? { thinking } : {}) };
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
  const { apiUrl, activeConversationId, peer, messages, isDm, mediaUrlByPath, cdnResolve, fetchAuthSession, openInfo } =
    opts;

  const [open, setOpen] = React.useState(false);
  const [instruction, setInstruction] = React.useState<string>('');
  const [loading, setLoading] = React.useState<boolean>(false);
  const [answer, setAnswer] = React.useState<string>('');
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [thread, setThread] = React.useState<AiHelperTurn[]>([]);
  const [resetThread, setResetThread] = React.useState<boolean>(false);
  const [mode, setMode] = React.useState<'ask' | 'reply'>('ask');

  const scrollRef = React.useRef<ScrollView | null>(null);
  const scrollViewportHRef = React.useRef<number>(0);
  const scrollContentHRef = React.useRef<number>(0);
  const scrollContentRef = React.useRef<View | null>(null);
  const lastTurnRef = React.useRef<View | null>(null);
  const lastTurnLayoutRef = React.useRef<{ y: number; h: number; ok: boolean }>({ y: 0, h: 0, ok: false });
  const autoScrollRetryRef = React.useRef<{ timer: ReturnType<typeof setTimeout> | null; attempts: number }>({
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
    setOpen(false);
    setInstruction('');
    setAnswer('');
    setSuggestions([]);
  }, []);

  const resetHelperThread = React.useCallback(() => {
    setThread([]);
    setResetThread(true);
    setAnswer('');
    setSuggestions([]);
    setInstruction('');
  }, []);

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

    const lastLayout = lastTurnLayoutRef.current;
    if (intent === 'answer' && lastLayout?.ok) {
      const bubbleTopY = Math.max(0, Math.floor(lastLayout.y));
      const latestViewportH = Math.max(0, Math.floor(scrollViewportHRef.current || 0));
      const latestContentH = Math.max(0, Math.floor(scrollContentHRef.current || 0));
      const latestEndY = latestViewportH > 0 ? Math.max(0, latestContentH - latestViewportH) : 0;
      const responseH = Math.max(0, Math.floor(latestContentH - bubbleTopY));
      const targetY = responseH > latestViewportH ? bubbleTopY : latestEndY;
      scrollRef.current?.scrollTo({ y: targetY, animated: true });
      lastAutoScrollAtRef.current = Date.now();
      lastAutoScrollContentHRef.current = latestContentH;
      autoScrollIntentRef.current = null;
      if (autoScrollRetryRef.current.timer) clearTimeout(autoScrollRetryRef.current.timer);
      autoScrollRetryRef.current.timer = null;
      autoScrollRetryRef.current.attempts = 0;
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
            const latestEndY = latestViewportH > 0 ? Math.max(0, latestContentH - latestViewportH) : 0;
            const responseH = Math.max(0, Math.floor(latestContentH - bubbleTopY));
            const targetY = responseH > latestViewportH ? bubbleTopY : latestEndY;
            scrollRef.current?.scrollTo({ y: targetY, animated: true });
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
      setInstruction('');
      setLoading(true);
      setAnswer('');
      setSuggestions([]);

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
        maxMessages: 50,
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
          thread: threadBefore,
          resetThread: shouldResetThread,
          attachments: attachmentsForAi,
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
          setThread(threadBefore);
          openInfo('AI limit reached', msg);
          return;
        }
        throw new Error(`AI helper failed (${resp.status}): ${bodyText || 'no body'}`);
      }

      const data = await resp.json().catch(() => ({}));
      const rec = isRecord(data) ? data : {};
      const nextAnswer = typeof rec.answer === 'string' ? rec.answer.trim() : String(rec.answer ?? '').trim();
      const nextSuggestions = Array.isArray(rec.suggestions)
        ? rec.suggestions
            .map((s) => (typeof s === 'string' ? s.trim() : String(s ?? '').trim()))
            .filter(Boolean)
            .slice(0, 3)
        : [];

      setAnswer(nextAnswer);
      setSuggestions(nextSuggestions);

      if (Array.isArray(rec.thread)) {
        const parsedThread = rec.thread.map(parseAiHelperTurn).filter((t): t is AiHelperTurn => !!t);
        lastTurnRef.current = null;
        if (autoScrollRetryRef.current.timer) clearTimeout(autoScrollRetryRef.current.timer);
        autoScrollRetryRef.current.timer = null;
        autoScrollRetryRef.current.attempts = 0;
        autoScrollIntentRef.current = 'answer';
        if (parsedThread.length) setThread(parsedThread);
      } else if (nextAnswer) {
        lastTurnRef.current = null;
        if (autoScrollRetryRef.current.timer) clearTimeout(autoScrollRetryRef.current.timer);
        autoScrollRetryRef.current.timer = null;
        autoScrollRetryRef.current.attempts = 0;
        autoScrollIntentRef.current = 'answer';
        setThread((prev) => {
          const next = prev.slice();
          if (next.length && next[next.length - 1]?.role === 'assistant' && next[next.length - 1]?.thinking) {
            next.pop();
          }
          next.push({ role: 'assistant', text: nextAnswer });
          return next;
        });
      }
    } catch (e: unknown) {
      openInfo('AI helper failed', getErrorMessage(e));
    } finally {
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
    answer,
    suggestions,
    thread,
    mode,
    setMode,
    submit,
    resetHelperThread,
    // scroll plumbing for AiHelperModal
    scrollRef,
    scrollContentRef,
    lastTurnRef,
    lastTurnLayoutRef,
    scrollViewportHRef,
    scrollContentHRef,
    lastAutoScrollAtRef,
    lastAutoScrollContentHRef,
    autoScrollRetryRef,
    autoScrollIntentRef,
    autoScroll: autoScroll,
  };
}

