import { fetchAuthSession } from 'aws-amplify/auth';
import * as React from 'react';
import { AppState } from 'react-native';

import type { AmplifyUiUser } from '../../types/amplifyUi';

function appendQueryParam(url: string, key: string, value: string): string {
  const hasQuery = url.includes('?');
  const sep = hasQuery ? '&' : '?';
  return `${url}${sep}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

function redactWsUrl(url: string): string {
  // Avoid leaking JWTs into device logs/crash reports.
  // Replace token=<anything> with token=REDACTED (handles ?token= and &token=).
  return url.replace(/([?&]token=)[^&]+/gi, '$1REDACTED');
}

export function useChatWsConnection(opts: {
  user: AmplifyUiUser;
  wsUrl: string | null | undefined;
  wsRef?: React.MutableRefObject<WebSocket | null>;
  appStateRef: React.MutableRefObject<string>;
  activeConversationIdRef: React.MutableRefObject<string>;
  pendingJoinConversationIdRef: React.MutableRefObject<string | null>;
  flushPendingRead: () => void;
  setError: (next: string | null) => void;
  onMessage: (event: { data: unknown }) => void;
}) {
  const {
    user,
    wsUrl,
    appStateRef,
    activeConversationIdRef,
    pendingJoinConversationIdRef,
    flushPendingRead,
    setError,
  } = opts;

  // Keep a stable handler so reconnect logic doesn't flap on re-renders.
  const onMessageRef = React.useRef(opts.onMessage);
  React.useEffect(() => {
    onMessageRef.current = opts.onMessage;
  }, [opts.onMessage]);

  const internalWsRef = React.useRef<WebSocket | null>(null);
  const wsRef = opts.wsRef ?? internalWsRef;
  const wsReconnectTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsReconnectAttemptRef = React.useRef<number>(0);
  const connectWsRef = React.useRef<() => void>(() => {});

  const [isConnecting, setIsConnecting] = React.useState<boolean>(false);
  const [isConnected, setIsConnected] = React.useState<boolean>(false);

  const closeWs = React.useCallback(() => {
    if (wsReconnectTimerRef.current) {
      clearTimeout(wsReconnectTimerRef.current);
      wsReconnectTimerRef.current = null;
    }
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      // NOTE (web): closing a socket while CONNECTING can produce noisy console errors like:
      // "WebSocket is closed before the connection is established."
      // Instead, defer the close until it opens (or fails naturally).
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.close(1000, 'app background');
        } catch {
          // ignore
        }
      } else if (ws.readyState === WebSocket.CONNECTING) {
        try {
          ws.onopen = () => {
            try {
              ws.close(1000, 'app background');
            } catch {
              // ignore
            }
          };
        } catch {
          // ignore
        }
      }
    }
    setIsConnecting(false);
    setIsConnected(false);
  }, [wsRef]);

  const scheduleReconnect = React.useCallback(() => {
    if (wsReconnectTimerRef.current) return;
    if (!user) return;
    if (!wsUrl) return;
    if (appStateRef.current !== 'active') return;
    const attempt = Math.min(wsReconnectAttemptRef.current + 1, 8);
    wsReconnectAttemptRef.current = attempt;
    const delayMs = Math.min(10_000, 500 * Math.pow(1.7, attempt - 1));
    wsReconnectTimerRef.current = setTimeout(() => {
      wsReconnectTimerRef.current = null;
      // connectWs will no-op if already open/connecting
      connectWsRef.current();
    }, delayMs);
  }, [user, wsUrl, appStateRef]);

  const connectWs = React.useCallback(() => {
    if (!user) return;
    if (!wsUrl) {
      setError('WebSocket URL not configured. Set expo.extra.WS_URL in app.json');
      return;
    }
    const existing = wsRef.current;
    if (
      existing &&
      (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    setError(null);
    setIsConnecting(true);

    (async () => {
      // If WS auth is enabled, include Cognito token in the WS URL query string.
      // (React Native WebSocket headers are unreliable cross-platform, query string is the common pattern.)
      let wsUrlWithAuth = wsUrl;
      try {
        const { tokens } = await fetchAuthSession();
        const idToken = tokens?.idToken?.toString();
        if (!idToken) {
          setIsConnecting(false);
          setIsConnected(false);
          setError('Not authenticated (missing idToken).');
          scheduleReconnect();
          return;
        }
        wsUrlWithAuth = appendQueryParam(wsUrl, 'token', idToken);
      } catch {
        setIsConnecting(false);
        setIsConnected(false);
        setError('Unable to authenticate WebSocket connection.');
        scheduleReconnect();
        return;
      }

      const ws = new WebSocket(wsUrlWithAuth);
      wsRef.current = ws;

      ws.onopen = () => {
        // Ignore events from stale sockets.
        if (wsRef.current !== ws) return;
        wsReconnectAttemptRef.current = 0;
        setIsConnecting(false);
        setIsConnected(true);
        setError(null);
        flushPendingRead();
        // Best-effort "join" so backend can route/broadcast efficiently.
        const pendingJoin = pendingJoinConversationIdRef.current || activeConversationIdRef.current;
        if (pendingJoin) {
          try {
            ws.send(
              JSON.stringify({
                action: 'join',
                conversationId: pendingJoin,
                createdAt: Date.now(),
              }),
            );
            pendingJoinConversationIdRef.current = null;
          } catch {
            // ignore
          }
        }
      };

      ws.onmessage = (event: { data: unknown }) => {
        // Ignore events from stale sockets.
        if (wsRef.current !== ws) return;
        try {
          onMessageRef.current({ data: event?.data });
        } catch {
          // ignore
        }
      };

      ws.onerror = (e: unknown) => {
        // Ignore events from stale sockets.
        if (wsRef.current !== ws) return;
        // RN WebSocket doesn't expose much, but log what we can
        const rec = typeof e === 'object' && e != null ? (e as Record<string, unknown>) : {};
        const msg = typeof rec.message === 'string' ? rec.message : 'WebSocket error';
        if (__DEV__) console.debug('WS error:', msg, 'url:', redactWsUrl(ws.url));
        setIsConnecting(false);
        setIsConnected(false);
        setError(
          typeof rec.message === 'string' && rec.message
            ? `WebSocket error: ${rec.message}`
            : 'WebSocket error',
        );
        scheduleReconnect();
      };
      ws.onclose = (e) => {
        // Ignore events from stale sockets.
        if (wsRef.current !== ws) return;
        const rec =
          typeof e === 'object' && e != null ? (e as { code?: unknown; reason?: unknown }) : {};
        const code = typeof rec.code === 'number' ? rec.code : undefined;
        const reason = typeof rec.reason === 'string' ? rec.reason : undefined;
        if (__DEV__) console.debug('WS close:', code, reason, 'url:', redactWsUrl(ws.url));
        setIsConnected(false);
        scheduleReconnect();
      };
    })();
  }, [
    user,
    wsUrl,
    wsRef,
    setError,
    flushPendingRead,
    pendingJoinConversationIdRef,
    activeConversationIdRef,
    scheduleReconnect,
  ]);

  // Keep a stable pointer for reconnect timers.
  connectWsRef.current = connectWs;

  // Keep WS alive across "open picker -> app background -> return" transitions.
  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;
      if (nextState === 'active') {
        connectWs();
      } else {
        // Free resources while backgrounded; we'll reconnect on resume.
        closeWs();
      }
    });
    return () => sub.remove();
  }, [appStateRef, connectWs, closeWs]);

  // Initial connect on mount / when user changes
  React.useEffect(() => {
    connectWs();
    return () => closeWs();
  }, [connectWs, closeWs]);

  return { wsRef, isConnecting, isConnected, connectWs, closeWs };
}
