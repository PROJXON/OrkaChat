import * as React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ChatBackgroundState =
  | { mode: 'default' }
  | { mode: 'color'; color: string }
  | { mode: 'image'; uri: string; blur?: number; opacity?: number };

export function useChatBackgroundSettings(): {
  chatBackground: ChatBackgroundState;
  setChatBackground: React.Dispatch<React.SetStateAction<ChatBackgroundState>>;

  backgroundOpen: boolean;
  setBackgroundOpen: (v: boolean) => void;

  backgroundSaving: boolean;
  setBackgroundSaving: (v: boolean) => void;
  backgroundSavingRef: React.MutableRefObject<boolean>;

  backgroundError: string | null;
  setBackgroundError: (v: string | null) => void;

  backgroundDraft: ChatBackgroundState;
  setBackgroundDraft: React.Dispatch<React.SetStateAction<ChatBackgroundState>>;
  backgroundDraftImageUri: string | null;
  setBackgroundDraftImageUri: (v: string | null) => void;

  bgEffectBlur: number;
  setBgEffectBlur: (v: number) => void;
  bgEffectOpacity: number;
  setBgEffectOpacity: (v: number) => void;
} {
  const [chatBackground, setChatBackground] = React.useState<ChatBackgroundState>({ mode: 'default' });
  const [backgroundOpen, setBackgroundOpen] = React.useState<boolean>(false);
  const [backgroundSaving, setBackgroundSaving] = React.useState<boolean>(false);
  const backgroundSavingRef = React.useRef<boolean>(false);
  const [backgroundError, setBackgroundError] = React.useState<string | null>(null);
  const [backgroundDraft, setBackgroundDraft] = React.useState<ChatBackgroundState>({ mode: 'default' });
  const [backgroundDraftImageUri, setBackgroundDraftImageUri] = React.useState<string | null>(null);

  // Background "effects" are local draft controls for photo backgrounds.
  // Applied immediately to the preview; saved only on "Save".
  const [bgEffectBlur, setBgEffectBlur] = React.useState<number>(0);
  const [bgEffectOpacity, setBgEffectOpacity] = React.useState<number>(1);

  // Load global chat background (local-only).
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('ui:chatBackground');
        if (cancelled) return;
        if (!raw) return;
        const obj = JSON.parse(raw);
        if (obj && obj.mode === 'color' && typeof obj.color === 'string') {
          setChatBackground({ mode: 'color', color: obj.color });
        } else if (obj && obj.mode === 'image' && typeof obj.uri === 'string') {
          setChatBackground({
            mode: 'image',
            uri: obj.uri,
            blur: typeof obj.blur === 'number' ? Math.max(0, Math.min(10, Math.round(obj.blur))) : 0,
            opacity: typeof obj.opacity === 'number' ? obj.opacity : 1,
          });
        } else if (obj && obj.mode === 'default') {
          setChatBackground({ mode: 'default' });
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Initialize draft state when opening Background modal.
  React.useEffect(() => {
    if (!backgroundOpen) return;
    setBackgroundDraft(chatBackground);
    setBackgroundDraftImageUri(null);
    setBackgroundError(null);
    if (chatBackground?.mode === 'image') {
      const blur = typeof chatBackground.blur === 'number' ? chatBackground.blur : 0;
      const opacity = typeof chatBackground.opacity === 'number' ? chatBackground.opacity : 1;
      const clampedBlur = Math.max(0, Math.min(10, Math.round(blur)));
      const clampedOpacity = Math.max(0.2, Math.min(1, Math.round(opacity * 100) / 100));
      setBgEffectBlur(clampedBlur);
      setBgEffectOpacity(clampedOpacity);
    } else {
      setBgEffectBlur(0);
      setBgEffectOpacity(1);
    }
  }, [backgroundOpen, chatBackground]);

  return {
    chatBackground,
    setChatBackground,
    backgroundOpen,
    setBackgroundOpen,
    backgroundSaving,
    setBackgroundSaving,
    backgroundSavingRef,
    backgroundError,
    setBackgroundError,
    backgroundDraft,
    setBackgroundDraft,
    backgroundDraftImageUri,
    setBackgroundDraftImageUri,
    bgEffectBlur,
    setBgEffectBlur,
    bgEffectOpacity,
    setBgEffectOpacity,
  };
}

