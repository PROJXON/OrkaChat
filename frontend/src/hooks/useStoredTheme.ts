import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';

export type StoredTheme = 'light' | 'dark';

/**
 * IMPORTANT: `useStoredTheme` is used in multiple places (root App + screens).
 * If each hook instance owns isolated React state, toggling theme in one place
 * won't update the others until they manually reload from AsyncStorage.
 *
 * That desynchronization is especially visible for globally-mounted components
 * like `UiPromptProvider`, whose modals can appear "light" while the rest of the
 * UI is in dark mode (or vice versa).
 *
 * We keep a tiny in-memory pub/sub so all hook instances stay in sync immediately.
 */
let sharedTheme: StoredTheme | null = null;
const listeners = new Set<(t: StoredTheme) => void>();

function broadcastTheme(next: StoredTheme) {
  if (sharedTheme === next) return;
  sharedTheme = next;
  for (const fn of listeners) {
    try {
      fn(next);
    } catch {
      // ignore broken listeners
    }
  }
}

export function useStoredTheme({
  storageKey = 'ui:theme',
  defaultTheme = 'light',
  reloadDeps = [],
}: {
  storageKey?: string;
  defaultTheme?: StoredTheme;
  reloadDeps?: React.DependencyList;
}): {
  theme: StoredTheme;
  setTheme: React.Dispatch<React.SetStateAction<StoredTheme>>;
  isDark: boolean;
  ready: boolean;
  reload: () => Promise<void>;
} {
  // Keep `theme` and `ready` in a single state update so we never briefly become "ready"
  // while still showing the default theme (causes a visible light/dark flash on cold start).
  const initialSharedTheme = sharedTheme === 'dark' || sharedTheme === 'light' ? sharedTheme : null;
  const [state, setState] = React.useState<{ theme: StoredTheme; ready: boolean }>({
    // If another instance already loaded theme from storage, start with it immediately
    // to avoid a brief light-mode flash when mounting additional screens/providers.
    theme: initialSharedTheme ?? defaultTheme,
    // If we already have a shared theme, we can consider ourselves ready for rendering purposes.
    ready: !!initialSharedTheme,
  });

  const theme = state.theme;
  const ready = state.ready;

  const setTheme: React.Dispatch<React.SetStateAction<StoredTheme>> = React.useCallback((next) => {
    setState((prev) => {
      const nextTheme =
        typeof next === 'function' ? (next as (t: StoredTheme) => StoredTheme)(prev.theme) : next;
      if (nextTheme !== 'dark' && nextTheme !== 'light') return prev;
      if (prev.theme === nextTheme) return prev;
      return { ...prev, theme: nextTheme };
    });
  }, []);

  const reload = React.useCallback(async () => {
    try {
      // Prefer in-memory shared theme if available (avoids AsyncStorage roundtrip).
      const shared = sharedTheme;
      if (shared === 'dark' || shared === 'light') {
        setState({ theme: shared, ready: true });
        return;
      }
      const stored = await AsyncStorage.getItem(storageKey);
      if (stored === 'dark' || stored === 'light') {
        setState({ theme: stored, ready: true });
        broadcastTheme(stored);
      }
    } catch {
      // ignore
    } finally {
      // If we didn't load a stored theme, we're still "ready" (we'll keep defaultTheme).
      setState((prev) => (prev.ready ? prev : { ...prev, ready: true }));
    }
  }, [storageKey]);

  // Keep all hook instances in sync.
  React.useEffect(() => {
    const onShared = (t: StoredTheme) => {
      setState((prev) => (prev.theme === t ? prev : { ...prev, theme: t }));
    };
    listeners.add(onShared);
    return () => {
      listeners.delete(onShared);
    };
  }, []);

  // Initial load + optional re-load triggers (e.g. opening a modal).
  React.useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, ...reloadDeps]);

  // Persist changes.
  React.useEffect(() => {
    // CRITICAL: don't persist the defaultTheme before we've had a chance to load the stored value.
    // Otherwise, every cold start/refresh overwrites the user's saved theme.
    if (!ready) return;
    (async () => {
      try {
        await AsyncStorage.setItem(storageKey, theme);
      } catch {
        // ignore
      }
    })();
    // Also publish immediately so global providers (and other screens) update.
    broadcastTheme(theme);
  }, [ready, storageKey, theme]);

  return { theme, setTheme, isDark: theme === 'dark', ready, reload };
}
