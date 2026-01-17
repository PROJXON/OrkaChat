import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';

export type AvatarState = {
  bgColor?: string;
  textColor?: string;
  imagePath?: string;
  imageUri?: string; // cached preview URL (not persisted)
};

export function useMyAvatarSettings({
  userSub,
  apiUrl,
  fetchAuthSession,
  cdn,
}: {
  userSub: string | null;
  apiUrl: string;
  fetchAuthSession: () => Promise<{ tokens?: { idToken?: { toString: () => string } } }>;
  cdn: { resolve: (path: string) => string | undefined } | null | undefined;
}): {
  avatarOpen: boolean;
  setAvatarOpen: (v: boolean) => void;
  avatarSaving: boolean;
  setAvatarSaving: (v: boolean) => void;
  avatarSavingRef: React.MutableRefObject<boolean>;
  avatarError: string | null;
  setAvatarError: (v: string | null) => void;

  myAvatar: AvatarState;
  setMyAvatar: React.Dispatch<React.SetStateAction<AvatarState>>;
  avatarDraft: AvatarState;
  setAvatarDraft: React.Dispatch<React.SetStateAction<AvatarState>>;
  avatarDraftImageUri: string | null;
  setAvatarDraftImageUri: (v: string | null) => void;
  avatarDraftRemoveImage: boolean;
  setAvatarDraftRemoveImage: (v: boolean) => void;

  saveAvatarToStorageAndServer: (next: {
    bgColor?: string;
    textColor?: string;
    imagePath?: string;
  }) => Promise<void>;
} {
  const [avatarOpen, setAvatarOpen] = React.useState<boolean>(false);
  const [avatarSaving, setAvatarSaving] = React.useState<boolean>(false);
  const avatarSavingRef = React.useRef<boolean>(false);
  const [avatarError, setAvatarError] = React.useState<string | null>(null);

  // Persisted avatar state (what we actually saved / loaded).
  const [myAvatar, setMyAvatar] = React.useState<AvatarState>(() => ({ textColor: '#fff' }));
  // Draft avatar state for the Avatar modal. Changes here should only commit on "Save".
  const [avatarDraft, setAvatarDraft] = React.useState<AvatarState>(() => ({ textColor: '#fff' }));
  const [avatarDraftImageUri, setAvatarDraftImageUri] = React.useState<string | null>(null);
  const [avatarDraftRemoveImage, setAvatarDraftRemoveImage] = React.useState<boolean>(false);

  // Initialize draft state when opening the Avatar modal.
  React.useEffect(() => {
    if (!avatarOpen) return;
    setAvatarDraft(myAvatar);
    setAvatarDraftImageUri(null);
    setAvatarDraftRemoveImage(false);
  }, [avatarOpen, myAvatar]);

  // Load avatar settings per signed-in user (AsyncStorage cache; best-effort server fetch for cross-device).
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userSub) return;
      const key = `avatar:v1:${userSub}`;
      try {
        const raw = await AsyncStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (!cancelled && parsed && typeof parsed === 'object') {
            setMyAvatar((prev) => ({
              ...prev,
              bgColor: typeof parsed.bgColor === 'string' ? parsed.bgColor : prev.bgColor,
              textColor: typeof parsed.textColor === 'string' ? parsed.textColor : prev.textColor,
              imagePath: typeof parsed.imagePath === 'string' ? parsed.imagePath : prev.imagePath,
              imageUri: undefined,
            }));
          }
        }

        // Always do a best-effort server fetch too, even if we have cache, so changes
        // made on another device (or after a backend write) show up without reinstalling.
        if (!apiUrl) return;
        const { tokens } = await fetchAuthSession();
        const idToken = tokens?.idToken?.toString();
        if (!idToken) return;
        const resp = await fetch(
          `${apiUrl.replace(/\/$/, '')}/users?sub=${encodeURIComponent(userSub)}`,
          {
            headers: { Authorization: `Bearer ${idToken}` },
          },
        );
        if (!resp.ok) return;
        const u = await resp.json();
        if (!cancelled && u && typeof u === 'object') {
          const next = {
            bgColor: typeof u.avatarBgColor === 'string' ? u.avatarBgColor : undefined,
            textColor: typeof u.avatarTextColor === 'string' ? u.avatarTextColor : undefined,
            imagePath: typeof u.avatarImagePath === 'string' ? u.avatarImagePath : undefined,
          };
          setMyAvatar((prev) => ({
            ...prev,
            bgColor: typeof next.bgColor === 'string' ? next.bgColor : prev.bgColor,
            textColor: typeof next.textColor === 'string' ? next.textColor : prev.textColor,
            imagePath: typeof next.imagePath === 'string' ? next.imagePath : prev.imagePath,
            imageUri: undefined,
          }));
          // Keep the local cache in sync with what the server says.
          await AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {});
        }
      } catch (e) {
        if (__DEV__) console.debug('avatar cache load failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, fetchAuthSession, userSub]);

  // Resolve a preview URL for the current avatar image (if any).
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!myAvatar?.imagePath) return;
      if (myAvatar.imageUri) return;
      const s = cdn?.resolve?.(myAvatar.imagePath);
      if (s && !cancelled) setMyAvatar((prev) => ({ ...prev, imageUri: s }));
    })();
    return () => {
      cancelled = true;
    };
  }, [cdn, myAvatar?.imagePath, myAvatar?.imageUri]);

  const saveAvatarToStorageAndServer = React.useCallback(
    async (next: { bgColor?: string; textColor?: string; imagePath?: string }) => {
      if (!userSub) return;
      const key = `avatar:v1:${userSub}`;
      await AsyncStorage.setItem(key, JSON.stringify(next));

      if (!apiUrl) return;
      const { tokens } = await fetchAuthSession();
      const idToken = tokens?.idToken?.toString();
      if (!idToken) return;
      const resp = await fetch(`${apiUrl.replace(/\/$/, '')}/users/profile`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        let msg = `Avatar save failed (${resp.status})`;
        try {
          const parsed = JSON.parse(text || '{}');
          if (parsed?.message) msg = String(parsed.message);
        } catch {
          if (text.trim()) msg = `${msg}: ${text.trim()}`;
        }
        throw new Error(msg);
      }
    },
    [apiUrl, fetchAuthSession, userSub],
  );

  return {
    avatarOpen,
    setAvatarOpen,
    avatarSaving,
    setAvatarSaving,
    avatarSavingRef,
    avatarError,
    setAvatarError,
    myAvatar,
    setMyAvatar,
    avatarDraft,
    setAvatarDraft,
    avatarDraftImageUri,
    setAvatarDraftImageUri,
    avatarDraftRemoveImage,
    setAvatarDraftRemoveImage,
    saveAvatarToStorageAndServer,
  };
}
