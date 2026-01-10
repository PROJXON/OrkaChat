import * as React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function useGlobalAboutOncePerVersion(version: string): {
  globalAboutOpen: boolean;
  setGlobalAboutOpen: React.Dispatch<React.SetStateAction<boolean>>;
  dismissGlobalAbout: () => Promise<void>;
  globalAboutStorageKey: string;
} {
  const globalAboutStorageKey = React.useMemo(() => `ui:globalAboutSeen:${String(version || '').trim()}`, [version]);
  const [globalAboutOpen, setGlobalAboutOpen] = React.useState<boolean>(false);

  // Auto-popup Global About once per version.
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(globalAboutStorageKey);
        if (!mounted) return;
        if (!seen) setGlobalAboutOpen(true);
      } catch {
        if (mounted) setGlobalAboutOpen(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [globalAboutStorageKey]);

  const dismissGlobalAbout = React.useCallback(async () => {
    setGlobalAboutOpen(false);
    try {
      await AsyncStorage.setItem(globalAboutStorageKey, '1');
    } catch {
      // ignore
    }
  }, [globalAboutStorageKey]);

  return { globalAboutOpen, setGlobalAboutOpen, dismissGlobalAbout, globalAboutStorageKey };
}

