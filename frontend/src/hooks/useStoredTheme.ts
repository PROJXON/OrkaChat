import * as React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type StoredTheme = 'light' | 'dark';

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
      const stored = await AsyncStorage.getItem(storageKey);
      if (stored === 'dark' || stored === 'light') setTheme(stored);
    } catch {
      // ignore
    } finally {
      setReady(true);
    }
  }, [storageKey]);

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
  }, [storageKey, theme]);

  return { theme, setTheme, isDark: theme === 'dark', ready, reload };
}

