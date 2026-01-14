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
  const [theme, setTheme] = React.useState<StoredTheme>(defaultTheme);
  const [ready, setReady] = React.useState<boolean>(false);

  const reload = React.useCallback(async () => {
    try {
      // Prefer in-memory shared theme if available (avoids AsyncStorage roundtrip).
      if (sharedTheme === 'dark' || sharedTheme === 'light') {
        setTheme(sharedTheme);
        return;
      }
      const stored = await AsyncStorage.getItem(storageKey);
      if (stored === 'dark' || stored === 'light') {
        setTheme(stored);
        broadcastTheme(stored);
      }
    } catch {
      // ignore
    } finally {
      setReady(true);
    }
  }, [storageKey]);

  // Keep all hook instances in sync.
  React.useEffect(() => {
    const onShared = (t: StoredTheme) => {
      setTheme((prev) => (prev === t ? prev : t));
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
    (async () => {
      try {
        await AsyncStorage.setItem(storageKey, theme);
      } catch {
        // ignore
      }
    })();
    // Also publish immediately so global providers (and other screens) update.
    broadcastTheme(theme);
  }, [storageKey, theme]);

  return { theme, setTheme, isDark: theme === 'dark', ready, reload };
}
