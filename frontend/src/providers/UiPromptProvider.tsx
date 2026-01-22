import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';

import { UiPromptModal } from '../components/modals/UiPromptModal';
import type { UiPrompt, UiPromptVariant } from '../types/uiPrompt';

type ConfirmOpts = {
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  dontShowAgain?: { storageKey: string; label?: string };
};
type AlertOpts = { confirmText?: string; destructive?: boolean };
type Choice3Opts = {
  primaryText: string;
  secondaryText: string;
  tertiaryText: string;
  primaryVariant?: UiPromptVariant;
  secondaryVariant?: UiPromptVariant;
  tertiaryVariant?: UiPromptVariant;
};
type Choice3Args = { title: string; message: string } & Choice3Opts;

export type UiPromptApi = {
  alert: (title: string, message: string, opts?: AlertOpts) => Promise<void>;
  confirm: (title: string, message: string, opts?: ConfirmOpts) => Promise<boolean>;
  choice3: {
    (
      title: string,
      message: string,
      opts: {
        primaryText: string;
        secondaryText: string;
        tertiaryText: string;
        primaryVariant?: UiPromptVariant;
        secondaryVariant?: UiPromptVariant;
        tertiaryVariant?: UiPromptVariant;
      },
    ): Promise<'primary' | 'secondary' | 'tertiary'>;
    (args: {
      title: string;
      message: string;
      primaryText: string;
      secondaryText: string;
      tertiaryText: string;
      primaryVariant?: UiPromptVariant;
      secondaryVariant?: UiPromptVariant;
      tertiaryVariant?: UiPromptVariant;
    }): Promise<'primary' | 'secondary' | 'tertiary'>;
  };
  isOpen: boolean;
};

const UiPromptContext = React.createContext<UiPromptApi | null>(null);

export function UiPromptProvider({
  isDark,
  children,
}: {
  isDark: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  const [uiPrompt, setUiPrompt] = React.useState<UiPrompt | null>(null);
  const queueRef = React.useRef<UiPrompt[]>([]);

  // When the current prompt closes, show the next queued one (if any).
  React.useEffect(() => {
    if (uiPrompt) return;
    const next = queueRef.current.shift() || null;
    if (next) setUiPrompt(next);
  }, [uiPrompt]);

  // Enqueue prompts safely even if multiple are queued within the same tick.
  const enqueue = React.useCallback((p: UiPrompt) => {
    setUiPrompt((prev) => {
      if (!prev) return p;
      queueRef.current.push(p);
      return prev;
    });
  }, []);

  const api = React.useMemo<UiPromptApi>(() => {
    return {
      isOpen: !!uiPrompt,
      alert: async (title: string, message: string, opts?: AlertOpts) =>
        await new Promise<void>((resolve) => {
          enqueue({
            kind: 'alert',
            title: String(title || ''),
            message: String(message || ''),
            confirmText: opts?.confirmText,
            destructive: !!opts?.destructive,
            resolve,
          });
        }),
      confirm: async (title: string, message: string, opts?: ConfirmOpts) => {
        const key = String(opts?.dontShowAgain?.storageKey || '').trim();
        if (key) {
          try {
            const v = await AsyncStorage.getItem(key);
            if (v === '1') return true;
          } catch {
            // ignore
          }
        }

        const res = await new Promise<{ confirmed: boolean; dontShowAgain: boolean }>((resolve) => {
          enqueue({
            kind: 'confirm',
            title: String(title || ''),
            message: String(message || ''),
            confirmText: opts?.confirmText,
            cancelText: opts?.cancelText,
            destructive: !!opts?.destructive,
            dontShowAgain: key
              ? { label: String(opts?.dontShowAgain?.label || "Don't show again") }
              : undefined,
            resolve,
          });
        });

        if (res.confirmed && res.dontShowAgain && key) {
          try {
            await AsyncStorage.setItem(key, '1');
          } catch {
            // ignore
          }
        }
        return !!res.confirmed;
      },
      choice3: (async (
        titleOrArgs: string | Choice3Args,
        message?: string,
        opts?: Choice3Opts,
      ): Promise<'primary' | 'secondary' | 'tertiary'> =>
        await new Promise<'primary' | 'secondary' | 'tertiary'>((resolve) => {
          const normalized: Choice3Args =
            titleOrArgs && typeof titleOrArgs === 'object'
              ? titleOrArgs
              : {
                  title: String(titleOrArgs || ''),
                  message: String(message || ''),
                  ...(opts || ({} as Choice3Opts)),
                };

          enqueue({
            kind: 'choice3',
            title: String(normalized.title || ''),
            message: String(normalized.message || ''),
            primaryText: String(normalized.primaryText || 'OK'),
            secondaryText: String(normalized.secondaryText || 'Cancel'),
            tertiaryText: String(normalized.tertiaryText || 'Other'),
            primaryVariant: normalized.primaryVariant,
            secondaryVariant: normalized.secondaryVariant,
            tertiaryVariant: normalized.tertiaryVariant,
            resolve,
          });
        })) as UiPromptApi['choice3'],
    };
  }, [enqueue, uiPrompt]);

  return (
    <UiPromptContext.Provider value={api}>
      {children}
      <UiPromptModal uiPrompt={uiPrompt} setUiPrompt={setUiPrompt} isDark={isDark} />
    </UiPromptContext.Provider>
  );
}

export function useUiPrompt(): UiPromptApi {
  const ctx = React.useContext(UiPromptContext);
  if (!ctx) {
    // Fail loudly in dev; in prod this still gives a clear error.
    throw new Error('useUiPrompt must be used within UiPromptProvider');
  }
  return ctx;
}

// Optional variant for shared components that may be rendered outside the provider
// (e.g. in isolation during development). Prefer `useUiPrompt()` in screens.
export function useUiPromptOptional(): UiPromptApi | null {
  return React.useContext(UiPromptContext);
}
