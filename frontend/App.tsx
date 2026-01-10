import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  ActivityIndicator,
  processColor,
  StyleSheet,
  Text,
  View,
  TextInput,
  Image,
  Pressable,
  Modal,
  Switch,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { styles } from './App.styles';
import Slider from '@react-native-community/slider';

// Development-only: print global error stacks to Metro logs.
// This helps chase down redbox errors that otherwise show only a short message in the terminal.
declare const __DEV__: boolean;
try {
  const eu: any = (globalThis as any)?.ErrorUtils;
  if (__DEV__ && eu && typeof eu.getGlobalHandler === 'function' && typeof eu.setGlobalHandler === 'function') {
    const prev = eu.getGlobalHandler();
    eu.setGlobalHandler((error: any, isFatal: boolean) => {
      try {
        console.log('[global error]', { message: error?.message, stack: error?.stack, isFatal });
      } catch {}
      try {
        prev?.(error, isFatal);
      } catch {}
    });
  }
} catch {}

import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';
import ChatScreen from './src/screens/ChatScreen';
import GuestGlobalScreen from './src/screens/GuestGlobalScreen';
import { AnimatedDots } from './src/components/AnimatedDots';
import { AppBrandIcon } from './src/components/AppBrandIcon';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ScreenOrientation from 'expo-screen-orientation';
import { requireOptionalNativeModule } from 'expo-modules-core';

import { Amplify } from "aws-amplify";
import {
  Authenticator,
  ThemeProvider,
  useAuthenticator,
} from "@aws-amplify/ui-react-native/dist";
// IMPORTANT:
// Import Amplify UI from `dist/*` (compiled JS + .d.ts) so TypeScript does NOT compile Amplify's internal TS
// sources during `tsc --watch`. Keep all Amplify UI imports on the same `dist/*` path to avoid ThemeContext
// duplication/mismatches.
import { icons } from '@aws-amplify/ui-react-native/dist/assets';
import { deleteUser, fetchUserAttributes } from 'aws-amplify/auth';
import { fetchAuthSession } from '@aws-amplify/auth';
import { uploadData } from 'aws-amplify/storage';
import { API_URL, CDN_URL } from './src/config/env';
import { searchChannels } from './src/utils/channelSearch';
import { useCdnUrlCache } from './src/hooks/useCdnUrlCache';
import { useDebouncedValue } from './src/hooks/useDebouncedValue';
import { useStoredTheme } from './src/hooks/useStoredTheme';
import {
  registerForDmPushNotifications,
  setForegroundNotificationPolicy,
  unregisterDmPushNotifications,
} from './src/utils/pushNotifications';
import { HeaderMenuModal } from './src/components/HeaderMenuModal';
import { AVATAR_DEFAULT_COLORS, AvatarBubble, pickDefaultAvatarColor } from './src/components/AvatarBubble';
import { GLOBAL_ABOUT_VERSION } from './src/utils/globalAbout';
import Feather from '@expo/vector-icons/Feather';
import { ThemeToggleRow } from './src/components/ThemeToggleRow';
import {
  applyTitleOverridesToConversations,
  applyTitleOverridesToUnreadMap,
  setTitleOverride,
} from './src/utils/conversationTitles';
import { formatChatActivityDate } from './src/utils/chatDates';
import { UiPromptProvider, useUiPrompt } from './src/providers/UiPromptProvider';
import { AuthModal } from './src/components/modals/AuthModal';
import { useAmplifyAuthenticatorConfig } from './src/features/auth/amplifyAuthenticator';
import { useGlobalAboutOncePerVersion } from './src/features/globalAbout/useGlobalAboutOncePerVersion';
import { GlobalAboutContent } from './src/components/globalAbout/GlobalAboutContent';
import { useViewportWidth } from './src/hooks/useViewportWidth';
import { useMenuAnchor } from './src/hooks/useMenuAnchor';

import {
  generateKeypair,
  storeKeyPair,
  loadKeyPair,
  decryptPrivateKey,
  derivePublicKey,
  encryptPrivateKey,
} from './src/utils/crypto';
import type { BackupBlob } from './src/types/crypto';

import 'react-native-get-random-values'
import 'react-native-url-polyfill/auto'

// Keep the native splash visible until we explicitly hide it (prevents a brief
// "white screen + spinner" flash while JS bootstraps and we check auth session).
SplashScreen.preventAutoHideAsync().catch(() => {
  // ignore (can throw if called multiple times in dev)
});

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const outputs =
    // Prefer a committed web/prod outputs file so Hosting doesn't accidentally create a new Cognito pool.
    // Falls back to local/sandbox outputs for native/dev.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    (Platform.OS === 'web' ? require('./amplify_outputs.web.json') : null) ||
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('./amplify_outputs.json');
  Amplify.configure(outputs);
} catch {
  // amplify_outputs.json not present yet; run `npx ampx sandbox` to generate it.
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message || 'unknown error';
  if (typeof err === 'string') return err || 'unknown error';
  if (!err) return 'unknown error';
  try {
    const rec = err as Record<string, unknown>;
    const msg = rec?.message;
    return typeof msg === 'string' && msg ? msg : 'unknown error';
  } catch {
    return 'unknown error';
  }
}

function getUsernameFromAuthenticatorUser(user: unknown): string | undefined {
  if (!user || typeof user !== 'object') return undefined;
  const rec = user as Record<string, unknown>;
  const u = rec.username;
  return typeof u === 'string' && u.trim() ? u.trim() : undefined;
}

function AppSafeAreaProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  // Web: ignore safe-area insets entirely.
  // On some mobile browsers (esp Android/Chrome), `react-native-safe-area-context` can report large left/right
  // insets (e.g. ~42px) that flip with rotation, causing visible side "gaps". We prefer consistent full-bleed
  // layout on web.
  const { width, height } = useWindowDimensions();

  if (Platform.OS === 'web') {
    return (
      <SafeAreaInsetsContext.Provider value={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <SafeAreaFrameContext.Provider value={{ x: 0, y: 0, width, height }}>
          {children}
        </SafeAreaFrameContext.Provider>
      </SafeAreaInsetsContext.Provider>
    );
  }

  return <SafeAreaProvider>{children}</SafeAreaProvider>;
}

const MainAppContent = ({ onSignedOut }: { onSignedOut?: () => void }) => {
  const { user } = useAuthenticator();
  const { signOut } = useAuthenticator();
  const { alert: promptAlert, confirm: promptConfirm, choice3: promptChoice3, isOpen: uiPromptOpen } = useUiPrompt();
  const cdn = useCdnUrlCache(CDN_URL);
  const [displayName, setDisplayName] = useState<string>('anon');
  const [myUserSub, setMyUserSub] = React.useState<string | null>(null);
  // Bump this whenever we change/recover/reset keys so ChatScreen reloads them from storage.
  const [keyEpoch, setKeyEpoch] = React.useState<number>(0);
  const [avatarOpen, setAvatarOpen] = React.useState<boolean>(false);
  const [avatarSaving, setAvatarSaving] = React.useState<boolean>(false);
  const avatarSavingRef = React.useRef<boolean>(false);
  const [avatarError, setAvatarError] = React.useState<string | null>(null);
  type AvatarState = {
    bgColor?: string;
    textColor?: string;
    imagePath?: string;
    imageUri?: string; // cached preview URL (not persisted)
  };
  // Persisted avatar state (what we actually saved / loaded).
  const [myAvatar, setMyAvatar] = React.useState<AvatarState>(() => ({ textColor: '#fff' }));
  // Draft avatar state for the Avatar modal. Changes here should only commit on "Save".
  const [avatarDraft, setAvatarDraft] = React.useState<AvatarState>(() => ({ textColor: '#fff' }));
  const [avatarDraftImageUri, setAvatarDraftImageUri] = React.useState<string | null>(null);
  const [avatarDraftRemoveImage, setAvatarDraftRemoveImage] = React.useState<boolean>(false);

  type ChatBackgroundState =
    | { mode: 'default' }
    | { mode: 'color'; color: string }
    | { mode: 'image'; uri: string; blur?: number; opacity?: number };
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
  const [passphrasePrompt, setPassphrasePrompt] = useState<{
    mode: 'setup' | 'restore' | 'change' | 'reset';
    resolve: (value: string) => void;
    reject: (reason?: unknown) => void;
  } | null>(null);
  const [passphraseInput, setPassphraseInput] = useState('');
  const [passphraseConfirmInput, setPassphraseConfirmInput] = useState('');
  const [passphraseVisible, setPassphraseVisible] = useState(false);
  const [passphraseError, setPassphraseError] = useState<string | null>(null);
  const [hasRecoveryBlob, setHasRecoveryBlob] = useState(false);
  // hasRecoveryBlob defaults false; track whether we've actually checked the server this session.
  const [recoveryBlobKnown, setRecoveryBlobKnown] = useState(false);
  const [recoveryLocked, setRecoveryLocked] = React.useState<boolean>(false);
  const [processing, setProcessing] = useState(false);

  // Initialize draft state when opening the Avatar modal.
  React.useEffect(() => {
    if (!avatarOpen) return;
    setAvatarDraft(myAvatar);
    setAvatarDraftImageUri(null);
    setAvatarDraftRemoveImage(false);
  }, [avatarOpen, myAvatar]);

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

  const promptPassphrase = (mode: 'setup' | 'restore' | 'change' | 'reset'): Promise<string> =>
    new Promise<string>((resolve, reject) => {
      setPassphraseInput('');
      setPassphraseConfirmInput('');
      setPassphraseVisible(false);
      setPassphraseError(null);
      setPassphrasePrompt({ mode, resolve, reject });
    });

  // promptAlert / promptConfirm / promptChoice3 come from the global UiPromptProvider.

  const closePrompt = () => {
    setPassphrasePrompt(null);
    setPassphraseInput('');
    setPassphraseConfirmInput('');
    setPassphraseVisible(false);
    setPassphraseError(null);
    setProcessing(false);
  };

  const deleteMyAccount = React.useCallback(async () => {
    if (!API_URL) {
      await promptAlert('Unavailable', 'Missing API_URL (backend not configured).');
      return;
    }

    const ok = await promptConfirm(
      'Delete account?',
      "This will permanently delete your OrkaChat account\n\nWhat will be deleted:\n- Your profile (display name / avatar)\n- Your blocklist and chat index (best-effort)\n- Push notification tokens\n- Recovery backup (if set)\n\nWhat may remain:\n- Messages you already sent may still be visible to other users\n- Cached media may take a short time to disappear\n\nTimeline: typically immediate, but some cleanup may take a few minutes\n\nContinue?",
      { confirmText: 'Delete', cancelText: 'Cancel', destructive: true }
    );
    if (!ok) return;

    // Best-effort: clear local push + crypto material for this user.
    try {
      await unregisterDmPushNotifications();
    } catch {
      // ignore
    }
    try {
      if (myUserSub) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const SecureStore = require('expo-secure-store') as typeof import('expo-secure-store');
        await SecureStore.deleteItemAsync(`crypto_keys_${myUserSub}`).catch(() => undefined);
      }
    } catch {
      // ignore
    }

    let idToken = '';
    try {
      const { tokens } = await fetchAuthSession();
      idToken = tokens?.idToken?.toString() || '';
    } catch {
      idToken = '';
    }

    if (!idToken) {
      await promptAlert('Not signed in', 'Missing auth token. Please sign in again and retry.');
      return;
    }

    // Step 1: delete app-side data while JWT is still valid.
    try {
      const res = await fetch(`${API_URL.replace(/\/$/, '')}/account/delete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Backend deletion failed (${res.status})`);
      }
    } catch (e: unknown) {
      await promptAlert('Delete failed', getErrorMessage(e) || 'Failed to delete account data.');
      return;
    }

    // Step 2: delete the Cognito user (removes the login itself).
    try {
      await deleteUser();
    } catch {
      // If this fails (expired token, etc.), fall back to signOut.
    }

    try {
      await signOut();
    } catch {
      // ignore
    } finally {
      onSignedOut?.();
    }

    await promptAlert('Account deleted', 'Your account deletion request completed.');
  }, [myUserSub, onSignedOut, promptAlert, promptConfirm, signOut]);

  const handlePromptSubmit = () => {
    if (!passphrasePrompt || processing) return;
    const needsConfirm =
      passphrasePrompt.mode === 'setup' || passphrasePrompt.mode === 'change' || passphrasePrompt.mode === 'reset';
    if (needsConfirm) {
      if (passphraseInput.trim() !== passphraseConfirmInput.trim()) {
        setPassphraseError('Passphrases do not match');
        return;
      }
    }
    setProcessing(true);
    // Defer resolving to the next tick so React Native has a chance to render
    // the "processing" state before CPU-heavy crypto work begins.
    setTimeout(() => passphrasePrompt.resolve(passphraseInput), 0);
  };

  const handlePromptCancel = async () => {
    if (!passphrasePrompt) return;
    const isSetup = passphrasePrompt.mode === 'setup';
    const isRestore = passphrasePrompt.mode === 'restore';
    if (isRestore) {
      // Restore flow: allow reset, try again immediately, or try again later.
      const choice = await promptChoice3({
        title: 'Forgot your recovery passphrase?',
        message:
          "If you reset recovery, you’ll create a new keypair and recovery passphrase on this device.\n\nOld encrypted direct messages will become unrecoverable.\n\nIf you might remember it later, you can try again later and you’ll be prompted again the next time you sign in.",
        primaryText: 'Try Again',
        secondaryText: 'Try Later',
        tertiaryText: 'Reset recovery',
        tertiaryVariant: 'danger',
      });
      if (choice === 'primary') {
        // Keep the prompt open; just clear input so they can re-enter immediately.
        setPassphraseInput('');
        setPassphraseConfirmInput('');
        setPassphraseError(null);
        return;
      }
      closePrompt();
      passphrasePrompt.reject(new Error(choice === 'tertiary' ? 'Recovery reset requested' : 'Prompt cancelled'));
      return;
    }
    if (!isSetup) {
      // Change/reset flow: cancelling should just close (no "skip setup" warning).
      closePrompt();
      passphrasePrompt.reject(new Error('Prompt cancelled'));
      return;
    }

    // Setup flow: user is choosing to skip creating a recovery passphrase.
    const ok = await promptConfirm(
      'Skip Recovery Setup?',
      "If you don't set a recovery passphrase, you won't be able to restore older encrypted messages if you switch devices.\n\nWe do NOT store your passphrase, so make sure you remember it.",
      { confirmText: 'Skip for now', cancelText: 'Go back', destructive: true }
    );
    if (!ok) return;
    closePrompt();
    passphrasePrompt.reject(new Error('Prompt cancelled'));
  };

  const applyRecoveryBlobExists = (exists: boolean) => {
    setRecoveryBlobKnown(true);
    setHasRecoveryBlob(exists);
  };

  const uploadRecoveryBlob = async (
    token: string,
    privateKeyHex: string,
    passphrase: string
  ) => {
    const t0 = Date.now();
    console.log('encrypting backup...');
    const blob = await encryptPrivateKey(privateKeyHex, passphrase);
    console.log('backup encrypted in', Date.now() - t0, 'ms');

    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const fetchPromise = fetch(`${API_URL.replace(/\/$/, '')}/users/recovery`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(blob),
        signal: controller.signal,
      });

      const timeoutPromise = new Promise<Response>((_, reject) => {
        timeoutId = setTimeout(() => {
          try {
            controller.abort();
          } catch {
            // ignore
          }
          reject(new Error('createRecovery timed out'));
        }, 20000);
      });

      const resp = await Promise.race([fetchPromise, timeoutPromise]);

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        console.warn('createRecovery non-2xx', resp.status, text);
        throw new Error(`createRecovery failed (${resp.status})`);
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  const checkRecoveryBlobExists = async (token: string): Promise<boolean | null> => {
    if (!API_URL) return null;
    const url = `${API_URL.replace(/\/$/, '')}/users/recovery`;
    // Web/dev fix: many API Gateway deployments don't enable CORS for HEAD (preflight fails),
    // so use GET which is already supported by our handlers.
    try {
      const resp = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
      if (resp.ok) return true;
      if (resp.status === 404) {
        console.log('recovery blob exists check: 404');
        return false;
      }
      console.log('recovery blob exists check: unexpected status', resp.status);
      return null;
    } catch {
      console.log('recovery blob exists check: network error');
      return null;
    }
  };

  const getIdTokenWithRetry = async (opts?: { maxAttempts?: number; delayMs?: number }): Promise<string | null> => {
    const maxAttempts = Math.max(1, Math.floor(opts?.maxAttempts ?? 8));
    const delayMs = Math.max(0, Math.floor(opts?.delayMs ?? 200));
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const token = (await fetchAuthSession()).tokens?.idToken?.toString();
        if (token) return token;
      } catch {
        // ignore and retry
      }
      if (i < maxAttempts - 1 && delayMs > 0) {
        // Small backoff to allow Amplify to rehydrate the session after a Metro refresh.
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs * (i + 1)));
      }
    }
    return null;
  };

  const uploadPublicKey = async (token: string | undefined, publicKey: string) => {
    if (!token) {
      console.warn('uploadPublicKey: missing idToken');
      return;
    }
    const resp = await fetch(`${API_URL.replace(/\/$/, '')}/users/public-key`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ publicKey }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      console.warn('uploadPublicKey non-2xx', resp.status, text);
    }
  };

  React.useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // Notification policy: avoid banners/sounds while foregrounded (chat UI handles it).
        await setForegroundNotificationPolicy();

        // reset per-user UI state on sign-in changes
        setHasRecoveryBlob(false);
        setRecoveryBlobKnown(false);
        setRecoveryLocked(false);
        setProcessing(false);

        const attrs = await fetchUserAttributes();
        const name =
          (attrs.preferred_username as string | undefined) ||
          (attrs.email as string | undefined) ||
          getUsernameFromAuthenticatorUser(user as unknown) ||
          'anon';
        const userId = attrs.sub as string;
        if (mounted) setMyUserSub(userId);
        if (mounted) setDisplayName(name);

        let keyPair = await loadKeyPair(userId);
        // If a keypair exists locally, ensure it's internally consistent.
        // (We previously had cases where a stale Cognito public key was stored alongside a different private key.)
        if (keyPair) {
          const derivedPublicKey = derivePublicKey(keyPair.privateKey);
          if (derivedPublicKey !== keyPair.publicKey) {
            console.warn('Local keypair mismatch: fixing public key from private key');
            keyPair = { ...keyPair, publicKey: derivedPublicKey };
            await storeKeyPair(userId, keyPair);
            const token = (await fetchAuthSession()).tokens?.idToken?.toString();
            await uploadPublicKey(token, derivedPublicKey);
          }
        }

        // Even when we already have a local keypair, check if an account recovery backup exists
        // so the Recovery modal can show "Change passphrase" vs "Set up recovery" correctly.
        if (keyPair) {
          const token = await getIdTokenWithRetry({ maxAttempts: 10, delayMs: 200 });
          if (token) {
            const exists = await checkRecoveryBlobExists(token);
            if (exists !== null && mounted) applyRecoveryBlobExists(exists);
          }
        }

        // Fetch recovery blob only when we don't already have a local keypair.
        let recoveryBlobExists = false;
        let resetRecoveryRequested = false;
        if (!keyPair) {
          const token = (await fetchAuthSession()).tokens?.idToken?.toString();
          const recoveryResp = await fetch(`${API_URL.replace(/\/$/, '')}/users/recovery`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (recoveryResp.ok) {
            recoveryBlobExists = true;
            setHasRecoveryBlob(true);
            setRecoveryBlobKnown(true);
            try {
              const blob: BackupBlob = await recoveryResp.json();
              let recovered = false;
              while (!recovered) {
                let passphrase: string;
                try {
                  passphrase = await promptPassphrase('restore');
                } catch (err) {
                  if (err instanceof Error && err.message === 'Prompt cancelled') {
                    closePrompt();
                    break;
                  }
                  if (err instanceof Error && err.message === 'Recovery reset requested') {
                    resetRecoveryRequested = true;
                    closePrompt();
                    break;
                  }
                  console.error('Recovery prompt error', err);
                  closePrompt();
                  break;
                }

                try {
                  const restoredPrivateKey = await decryptPrivateKey(blob, passphrase);
                  const derivedPublicKey = derivePublicKey(restoredPrivateKey);
                  keyPair = {
                    privateKey: restoredPrivateKey,
                    // IMPORTANT: always derive from the recovered private key to avoid
                    // mismatches with a stale Cognito public key.
                    publicKey: derivedPublicKey,
                  };
                  await storeKeyPair(userId, keyPair);
                  setKeyEpoch((v) => v + 1);
                  // Ensure Cognito has the matching public key so other devices encrypt to the right key.
                  await uploadPublicKey(token, derivedPublicKey);
                  recovered = true;
                  closePrompt();
                } catch (err) {
                  await promptAlert(
                    'Incorrect passphrase',
                    'You have entered an incorrect passphrase. Try again.'
                  );
                  console.warn('Recovery attempt failed', err);
                  closePrompt();
                  // continue prompting
                }
              }
            } catch (err) {
              console.error('Recovery failed to load blob', err);
              closePrompt();
            }
          } else {
            setHasRecoveryBlob(false);
            setRecoveryBlobKnown(true);
            closePrompt();
            if (recoveryResp.status !== 404) {
              console.warn('Unexpected response fetching recovery blob', recoveryResp.status);
            }
          }
        }

        // If a recovery blob exists but the user cancelled recovery, keep them "locked".
        // We should prompt again next login (and provide settings actions to retry/reset).
        if (!keyPair && recoveryBlobExists && !resetRecoveryRequested) {
          if (mounted) setRecoveryLocked(true);
          return;
        }

        // If no recovery blob exists OR user explicitly requested a reset, generate a new keypair.
        if (!keyPair) {
          const token = (await fetchAuthSession()).tokens?.idToken?.toString();
          try {
            if (resetRecoveryRequested) {
              // Reset flow is destructive; only proceed AFTER the user submits a new passphrase.
              const recoveryPassphrase = await promptPassphrase('reset');
              const newKeyPair = await generateKeypair();
              await storeKeyPair(userId, newKeyPair);
              setKeyEpoch((v) => v + 1);
              await uploadPublicKey(token, newKeyPair.publicKey);
              await uploadRecoveryBlob(token!, newKeyPair.privateKey, recoveryPassphrase);
              applyRecoveryBlobExists(true);
              if (mounted) setRecoveryLocked(false);
              return;
            }

            // First-time key setup (non-destructive): generate keys immediately so messaging works,
            // then optionally prompt to create a recovery backup.
            const newKeyPair = await generateKeypair();
            await storeKeyPair(userId, newKeyPair);
            setKeyEpoch((v) => v + 1);
            // Publish the public key immediately so other users/devices can encrypt to us,
            // even if the user cancels recovery setup.
            await uploadPublicKey(token, newKeyPair.publicKey);
            const recoveryPassphrase = await promptPassphrase('setup');
            await uploadRecoveryBlob(token!, newKeyPair.privateKey, recoveryPassphrase);
            applyRecoveryBlobExists(true);
          } catch (err) {
            if (resetRecoveryRequested) {
              // If they cancel the reset passphrase prompt, do NOT rotate keys. Keep locked.
              if (mounted) setRecoveryLocked(true);
              return;
            }
            console.warn('Recovery backup skipped:', err);
          } finally {
            // ensure the UI doesn't get stuck in "processing" for setup flow
            setProcessing(false);
            closePrompt();
          }
        }
      } catch {
        if (mounted) setDisplayName(getUsernameFromAuthenticatorUser(user as unknown) || 'anon');
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user]);

  // Load avatar settings per signed-in user (AsyncStorage cache; best-effort server fetch for cross-device).
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!myUserSub) return;
      const key = `avatar:v1:${myUserSub}`;
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
        if (!API_URL) return;
        const { tokens } = await fetchAuthSession();
        const idToken = tokens?.idToken?.toString();
        if (!idToken) return;
        const resp = await fetch(`${API_URL.replace(/\/$/, '')}/users?sub=${encodeURIComponent(myUserSub)}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
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
        console.log('avatar cache load failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [myUserSub]);

  // Resolve a preview URL for the current avatar image (if any).
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!myAvatar?.imagePath) return;
      if (myAvatar.imageUri) return;
      const s = cdn.resolve(myAvatar.imagePath);
      if (s && !cancelled) setMyAvatar((prev) => ({ ...prev, imageUri: s }));
    })();
    return () => {
      cancelled = true;
    };
  }, [cdn, myAvatar?.imagePath, myAvatar?.imageUri]);

  const saveAvatarToStorageAndServer = React.useCallback(
    async (next: { bgColor?: string; textColor?: string; imagePath?: string }) => {
      if (!myUserSub) return;
      const key = `avatar:v1:${myUserSub}`;
      await AsyncStorage.setItem(key, JSON.stringify(next));

      if (!API_URL) return;
      const { tokens } = await fetchAuthSession();
      const idToken = tokens?.idToken?.toString();
      if (!idToken) return;
      const resp = await fetch(`${API_URL.replace(/\/$/, '')}/users/profile`, {
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
    [myUserSub]
  );

  // Best-effort: register DM push token after login (Signal-like: sender name only, no message preview).
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!user) return;
        const res = await registerForDmPushNotifications();
        if (!mounted) return;
        if (!res.ok) {
          // Avoid spamming a modal; this should be transparent unless debugging.
          console.log('push registration skipped/failed:', res.reason || 'unknown');
        }
      } catch (err) {
        console.log('push registration error:', err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  const currentUsername = displayName.length ? displayName : getUsernameFromAuthenticatorUser(user as unknown) || 'anon';

  const [conversationId, setConversationId] = useState<string>('global');
  const [channelRestoreDone, setChannelRestoreDone] = React.useState<boolean>(false);
  const [peer, setPeer] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState<boolean>(false); // DM search
  const [peerInput, setPeerInput] = useState<string>('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [unreadDmMap, setUnreadDmMap] = useState<
    Record<string, { user: string; count: number; senderSub?: string }>
  >(
    () => ({})
  );
  // Local-only DM thread list (v1): used to power "Chats" inbox UI.
  // Backed by AsyncStorage so it survives restarts (per-device is OK for now).
  const [dmThreads, setDmThreads] = useState<Record<string, { peer: string; lastActivityAt: number }>>(() => ({}));
  const [serverConversations, setServerConversations] = React.useState<
    Array<{
      conversationId: string;
      peerDisplayName?: string;
      peerSub?: string;
      conversationKind?: 'dm' | 'group';
      memberStatus?: 'active' | 'left' | 'banned';
      lastMessageAt?: number;
    }>
  >([]);
  const [chatsLoading, setChatsLoading] = React.useState<boolean>(false);
  const [conversationsCacheAt, setConversationsCacheAt] = React.useState<number>(0);
  const isDmMode = conversationId.startsWith('dm#') || conversationId.startsWith('gdm#');
  const isChannelMode = !isDmMode;
  const lastChannelConversationIdRef = React.useRef<string>('global');
  // "My Channels" modal (opened from Settings → Channels). Lists channels you've joined.
  const [channelsOpen, setChannelsOpen] = React.useState<boolean>(false);
  const [myChannelsLoading, setMyChannelsLoading] = React.useState<boolean>(false);
  const [myChannelsError, setMyChannelsError] = React.useState<string | null>(null);
  const [myChannels, setMyChannels] = React.useState<Array<{ channelId: string; name: string }>>([]);

  // Channel search/join modal (opened from header channel pill).
  const [channelSearchOpen, setChannelSearchOpen] = React.useState<boolean>(false);
  const [channelsLoading, setChannelsLoading] = React.useState<boolean>(false);
  const [channelsQuery, setChannelsQuery] = React.useState<string>('');
  const [channelsError, setChannelsError] = React.useState<string | null>(null);
  const [globalUserCount, setGlobalUserCount] = React.useState<number | null>(null);
  const [channelsResults, setChannelsResults] = React.useState<
    Array<{
      channelId: string;
      name: string;
      nameLower?: string;
      isPublic: boolean;
      hasPassword?: boolean;
      activeMemberCount?: number;
      isMember?: boolean;
    }>
  >([]);
  const [channelNameById, setChannelNameById] = React.useState<Record<string, string>>({});
  const [channelPasswordPrompt, setChannelPasswordPrompt] = React.useState<null | { channelId: string; name: string }>(null);
  const [channelPasswordInput, setChannelPasswordInput] = React.useState<string>('');
  const [channelJoinError, setChannelJoinError] = React.useState<string | null>(null);
  // Inline create form (inside My Channels modal)
  const [createChannelOpen, setCreateChannelOpen] = React.useState<boolean>(false);
  const [createChannelName, setCreateChannelName] = React.useState<string>('');
  const [createChannelPassword, setCreateChannelPassword] = React.useState<string>('');
  const [createChannelIsPublic, setCreateChannelIsPublic] = React.useState<boolean>(true);
  const [createChannelLoading, setCreateChannelLoading] = React.useState<boolean>(false);
  const [createChannelError, setCreateChannelError] = React.useState<string | null>(null);
  const { theme, setTheme, isDark } = useStoredTheme({ storageKey: 'ui:theme', defaultTheme: 'light' });
  const [menuOpen, setMenuOpen] = React.useState<boolean>(false);
  const menu = useMenuAnchor<React.ElementRef<typeof Pressable>>();
  const { width: windowWidth } = useWindowDimensions();
  const { isWide: isWideUi } = useViewportWidth(windowWidth, { wideBreakpointPx: 900, maxContentWidthPx: 1040 });
  const [channelAboutRequestEpoch, setChannelAboutRequestEpoch] = React.useState<number>(0);
  const { globalAboutOpen, setGlobalAboutOpen, dismissGlobalAbout } = useGlobalAboutOncePerVersion(GLOBAL_ABOUT_VERSION);
  const [chatsOpen, setChatsOpen] = React.useState<boolean>(false);
  const [blocklistOpen, setBlocklistOpen] = React.useState<boolean>(false);
  const [recoveryOpen, setRecoveryOpen] = React.useState<boolean>(false);
  const [blocklistLoading, setBlocklistLoading] = React.useState<boolean>(false);
  const [blockUsername, setBlockUsername] = React.useState<string>('');
  const [blockError, setBlockError] = React.useState<string | null>(null);
  const [blockedUsers, setBlockedUsers] = React.useState<
    Array<{ blockedSub: string; blockedDisplayName?: string; blockedUsernameLower?: string; blockedAt?: number }>
  >([]);
  const [blocklistCacheAt, setBlocklistCacheAt] = React.useState<number>(0);

  const blockedSubs = React.useMemo(() => blockedUsers.map((b) => b.blockedSub).filter(Boolean), [blockedUsers]);

  // Global About is code-defined + versioned. Show once per version; About menu reopens it.

  // Restore last visited channel on boot (Global or ch#...).
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('ui:lastChannelConversationId');
        const v = typeof raw === 'string' ? raw.trim() : '';
        if (!mounted) return;
        if (v === 'global' || v.startsWith('ch#')) {
          lastChannelConversationIdRef.current = v;
          // Only auto-switch if we're not already in a DM.
          setConversationId((prev) => (prev && (prev.startsWith('dm#') || prev.startsWith('gdm#')) ? prev : v));
        }
      } catch {
        // ignore
      } finally {
        if (mounted) setChannelRestoreDone(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Persist last visited channel (not DMs).
  React.useEffect(() => {
    const v = conversationId;
    if (v === 'global' || v.startsWith('ch#')) {
      lastChannelConversationIdRef.current = v;
      (async () => {
        try {
          await AsyncStorage.setItem('ui:lastChannelConversationId', v);
        } catch {
          // ignore
        }
      })();
    }
  }, [conversationId]);

  const getIdToken = React.useCallback(async (): Promise<string | null> => {
    return await getIdTokenWithRetry({ maxAttempts: 10, delayMs: 200 });
  }, []);

  const fetchRecoveryBlob = React.useCallback(
    async (token: string): Promise<BackupBlob | null> => {
      const resp = await fetch(`${API_URL.replace(/\/$/, '')}/users/recovery`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.status === 404) return null;
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`Failed to fetch recovery blob (${resp.status}) ${text}`.trim());
      }
      return (await resp.json()) as BackupBlob;
    },
    [API_URL]
  );

  const enterRecoveryPassphrase = React.useCallback(async () => {
    if (!myUserSub) return;
    const token = await getIdToken();
    if (!token) {
      await promptAlert('Not signed in', 'Missing auth token.');
      return;
    }
    const blob = await fetchRecoveryBlob(token);
    if (!blob) {
      await promptAlert('No recovery backup', 'No recovery backup was found for your account.');
      return;
    }

    // Keep prompting until success or user cancels.
    while (true) {
      let passphrase: string;
      try {
        passphrase = await promptPassphrase('restore');
      } catch (err) {
        if (err instanceof Error && err.message === 'Recovery reset requested') {
          await resetRecovery();
        }
        return;
      }
      try {
        const restoredPrivateKey = await decryptPrivateKey(blob, passphrase);
        const derivedPublicKey = derivePublicKey(restoredPrivateKey);
        await storeKeyPair(myUserSub, { privateKey: restoredPrivateKey, publicKey: derivedPublicKey });
        setKeyEpoch((v) => v + 1);
        await uploadPublicKey(token, derivedPublicKey);
        setHasRecoveryBlob(true);
        setRecoveryBlobKnown(true);
        setRecoveryLocked(false);
        await promptAlert('Recovery Unlocked', 'Your recovery passphrase has been accepted');
        return;
      } catch (e) {
        await promptAlert('Incorrect passphrase', 'You have entered an incorrect passphrase. Try again.');
      } finally {
        closePrompt();
      }
    }
  }, [myUserSub, getIdToken, fetchRecoveryBlob]);

  const changeRecoveryPassphrase = React.useCallback(async () => {
    if (!myUserSub) return;
    const token = await getIdToken();
    if (!token) {
      await promptAlert('Not signed in', 'Missing auth token.');
      return;
    }
    const kp = await loadKeyPair(myUserSub);
    if (!kp?.privateKey) {
      await promptAlert(
        'Recovery locked',
        'You need to enter your existing recovery passphrase on this device before you can change it.'
      );
      return;
    }
    try {
      const nextPass = await promptPassphrase('change');
      await uploadRecoveryBlob(token, kp.privateKey, nextPass);
      setHasRecoveryBlob(true);
      setRecoveryBlobKnown(true);
      await promptAlert('Passphrase updated', 'Your recovery passphrase has been updated');
    } catch {
      // cancelled
    } finally {
      closePrompt();
    }
  }, [myUserSub, getIdToken]);

  const setupRecovery = React.useCallback(async () => {
    if (!myUserSub) return;
    const token = await getIdToken();
    if (!token) {
      await promptAlert('Not signed in', 'Missing auth token.');
      return;
    }
    const kp = await loadKeyPair(myUserSub);
    if (!kp?.privateKey) {
      await promptAlert(
        'Recovery locked',
        'You need to enter your existing recovery passphrase on this device before you can set up recovery.'
      );
      return;
    }
    try {
      const pass = await promptPassphrase('setup');
      await uploadRecoveryBlob(token, kp.privateKey, pass);
      setHasRecoveryBlob(true);
      setRecoveryBlobKnown(true);
      await promptAlert('Recovery set up', 'A recovery passphrase has been set for your account.');
    } catch {
      // cancelled
    } finally {
      closePrompt();
    }
  }, [myUserSub, getIdToken]);

  const resetRecovery = React.useCallback(async () => {
    if (!myUserSub) return;
    const ok = await promptConfirm(
      'Reset Recovery?',
      'This will generate a new keypair and recovery passphrase on this device.\n\nOld encrypted direct messages will become unrecoverable.',
      { confirmText: 'Reset', cancelText: 'Cancel', destructive: true }
    );
    if (!ok) return;
    const token = await getIdToken();
    if (!token) {
      await promptAlert('Not signed in', 'Missing auth token.');
      return;
    }
    try {
      // IMPORTANT: Don't reset anything until the user successfully submits a new passphrase.
      // If they cancel, recovery should remain unchanged.
      const nextPass = await promptPassphrase('reset');
      const newKeyPair = await generateKeypair();
      await storeKeyPair(myUserSub, newKeyPair);
      setKeyEpoch((v) => v + 1);
      await uploadPublicKey(token, newKeyPair.publicKey);
      await uploadRecoveryBlob(token, newKeyPair.privateKey, nextPass);
      setHasRecoveryBlob(true);
      setRecoveryBlobKnown(true);
      setRecoveryLocked(false);
      await promptAlert('Recovery reset', 'A new recovery passphrase has been set.');
    } catch {
      // cancelled setup
    } finally {
      closePrompt();
    }
  }, [myUserSub, getIdToken]);

  const upsertDmThread = React.useCallback((convId: string, peerName: string, lastActivityAt?: number) => {
    const id = String(convId || '').trim();
    if (!id || id === 'global') return;
    const name = String(peerName || '').trim() || 'Direct Message';
    const ts = Number.isFinite(Number(lastActivityAt)) ? Number(lastActivityAt) : Date.now();
    setDmThreads((prev) => {
      const existing = prev[id];
      const next = { ...prev };
      next[id] = {
        peer: name || existing?.peer || 'Direct Message',
        lastActivityAt: Math.max(ts, existing?.lastActivityAt || 0),
      };
      return next;
    });
  }, []);

  // Local title overrides (source of truth from in-chat group meta).
  // Used to keep Chats list + unread labels consistent even if serverConversations is stale.
  const titleOverrideByConvIdRef = React.useRef<Record<string, string>>({});

  const dmThreadsList = React.useMemo(() => {
    const entries = Object.entries(dmThreads)
      .map(([convId, info]) => ({
        conversationId: convId,
        peer: info.peer,
        lastActivityAt: info.lastActivityAt || 0,
        unreadCount: unreadDmMap[convId]?.count || 0,
      }))
      .sort((a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0));
    return entries;
  }, [dmThreads, unreadDmMap]);

  const fetchConversations = React.useCallback(async (): Promise<void> => {
    if (!API_URL) return;
    try {
      setChatsLoading(true);
      const { tokens } = await fetchAuthSession();
      const idToken = tokens?.idToken?.toString();
      if (!idToken) return;
      const res = await fetch(`${API_URL.replace(/\/$/, '')}/conversations?limit=100`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) return;
      const json = await res.json().catch(() => null);
      const convos = Array.isArray(json?.conversations) ? json.conversations : [];
      const parsed = convos
        .map((c: any) => ({
          conversationId: String(c?.conversationId || ''),
          peerDisplayName: c?.peerDisplayName ? String(c.peerDisplayName) : undefined,
          peerSub: c?.peerSub ? String(c.peerSub) : undefined,
          conversationKind: c?.conversationKind === 'group' ? 'group' : c?.conversationKind === 'dm' ? 'dm' : undefined,
          memberStatus:
            c?.memberStatus === 'active'
              ? 'active'
              : c?.memberStatus === 'left'
                ? 'left'
                : c?.memberStatus === 'banned'
                  ? 'banned'
                  : undefined,
          lastMessageAt: Number(c?.lastMessageAt ?? 0),
        }))
        .filter((c: any) => c.conversationId);

      // Apply any local overrides (e.g. group name changed in-chat).
      const parsedWithOverrides = applyTitleOverridesToConversations(parsed, titleOverrideByConvIdRef.current);
      setServerConversations(parsedWithOverrides);
      setConversationsCacheAt(Date.now());
      try {
        await AsyncStorage.setItem(
          'conversations:cache:v1',
          JSON.stringify({ at: Date.now(), conversations: parsedWithOverrides })
        );
      } catch {
        // ignore
      }

      // Best-effort: keep "Added to group: <title>" unread labels in sync with renamed group titles.
      try {
        const titleByConvId = new Map(
          parsedWithOverrides
            .map((c: any) => [String(c.conversationId || ''), String(c.peerDisplayName || '').trim()] as const)
            .filter(([id, t]: readonly [string, string]) => id && t)
        );
        setUnreadDmMap((prev) => {
          const next = { ...prev };
          for (const [convId, info] of Object.entries(prev || {})) {
            const title = titleByConvId.get(convId);
            if (!title) continue;
            if (info?.user && String(info.user).startsWith('Added to group:')) {
              next[convId] = { ...info, user: `Added to group: ${title}` };
            }
          }
          return next;
        });
      } catch {
        // ignore
      }
    } catch {
      // ignore
    } finally {
      setChatsLoading(false);
    }
  }, [API_URL]);

  const fetchUnreads = React.useCallback(async (): Promise<void> => {
    if (!API_URL) return;
    try {
      const { tokens } = await fetchAuthSession();
      const idToken = tokens?.idToken?.toString();
      if (!idToken) return;
      const res = await fetch(`${API_URL.replace(/\/$/, '')}/unreads`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const unread = Array.isArray(data.unread) ? data.unread : [];
      const next: Record<string, { user: string; count: number; senderSub?: string }> = {};
      for (const it of unread) {
        const convId = String(it.conversationId || '');
        if (!convId) continue;
        const kind = typeof it.kind === 'string' ? String(it.kind) : '';
        // Prefer display name if backend provides it; fall back to legacy `sender`/`user`.
        // For kind=added, senderDisplayName is treated as the group title.
        const sender = String(
          it.senderDisplayName || it.sender || it.user || (kind === 'added' ? 'Added to group' : 'someone')
        );
        const senderSub = it.senderSub ? String(it.senderSub) : undefined;
        const countRaw = Number.isFinite(Number(it.messageCount)) ? Number(it.messageCount) : 1;
        const count = kind === 'added' ? 1 : Math.max(1, Math.floor(countRaw));
        next[convId] = {
          user: kind === 'added' ? `Added to group: ${sender}` : sender,
          senderSub,
          count,
        };
        const lastAt = Number(it.lastMessageCreatedAt || 0);
        upsertDmThread(convId, sender, Number.isFinite(lastAt) && lastAt > 0 ? lastAt : Date.now());
      }
      setUnreadDmMap((prev) => {
        // Prefer freshly fetched unread info, but apply any local group title overrides
        // so UI doesn't regress to a stale default name.
        const merged: Record<string, { user: string; count: number; senderSub?: string }> = { ...prev, ...next };
        return applyTitleOverridesToUnreadMap(merged, titleOverrideByConvIdRef.current);
      });
    } catch {
      // ignore
    }
  }, [API_URL, upsertDmThread]);

  // Used by ChatScreen to instantly update the Chats list + current header title after
  // a group name change (without waiting for refetch).
  const handleConversationTitleChanged = React.useCallback(
    (convIdRaw: string, titleRaw: string) => {
      const convId = String(convIdRaw || '').trim();
      if (!convId || convId === 'global') return;
      const title = String(titleRaw || '').trim();
      if (!title) return;

      // Channels: update channelNameById so the header "Channel" label updates immediately.
      if (convId.startsWith('ch#')) {
        const channelId = convId.slice('ch#'.length).trim();
        if (channelId) {
          setChannelNameById((prev) => ({ ...prev, [channelId]: title }));
        }
      }

      // Persist local override so fetches won't overwrite the UI with stale server titles.
      titleOverrideByConvIdRef.current = setTitleOverride(titleOverrideByConvIdRef.current, convId, title);

      // Update current chat title if we're in it.
      if (conversationId === convId) {
        setPeer(title);
      }

      // Update server-backed conversations cache + DM threads list (best-effort).
      setServerConversations((prev) => {
        const next = prev.map((c) => (c.conversationId === convId ? { ...c, peerDisplayName: title } : c));
        try {
          AsyncStorage.setItem('conversations:cache:v1', JSON.stringify({ at: Date.now(), conversations: next })).catch(() => {});
        } catch {
          // ignore
        }
        return next;
      });

      // If there's a pending "Added to group: ..." unread label for this conversation, keep it in sync.
      setUnreadDmMap((prev) => {
        return applyTitleOverridesToUnreadMap(prev, { [convId]: title });
      });
      upsertDmThread(convId, title, Date.now());
    },
    [conversationId, upsertDmThread]
  );

  const deleteConversationFromList = React.useCallback(
    async (conversationIdToDelete: string) => {
      const convId = String(conversationIdToDelete || '').trim();
      if (!convId || !API_URL) return;
      const ok = await promptConfirm(
        'Remove chat?',
        'This removes the selected chat from your Chats list. If they message you again, it will reappear.\n\nThis does not delete message history.',
        { confirmText: 'Remove', cancelText: 'Cancel', destructive: true }
      );
      if (!ok) return;

      try {
        const { tokens } = await fetchAuthSession();
        const idToken = tokens?.idToken?.toString();
        if (!idToken) return;
        const res = await fetch(`${API_URL.replace(/\/$/, '')}/conversations/delete`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${idToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ conversationId: convId }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          console.warn('deleteConversation failed', res.status, text);
          return;
        }
      } catch (err) {
        console.warn('deleteConversation error', err);
        return;
      }

      // Optimistic local cleanup
      setServerConversations((prev) => prev.filter((c) => c.conversationId !== convId));
      setDmThreads((prev) => {
        if (!prev[convId]) return prev;
        const next = { ...prev };
        delete next[convId];
        return next;
      });
      setUnreadDmMap((prev) => {
        if (!prev[convId]) return prev;
        const next = { ...prev };
        delete next[convId];
        return next;
      });
    },
    [API_URL, promptConfirm]
  );

  const fetchBlocks = React.useCallback(async (): Promise<void> => {
    if (!API_URL) return;
    try {
      setBlocklistLoading(true);
      const { tokens } = await fetchAuthSession();
      const idToken = tokens?.idToken?.toString();
      if (!idToken) return;
      const res = await fetch(`${API_URL.replace(/\/$/, '')}/blocks`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) return;
      const json = await res.json().catch(() => null);
      const arr = Array.isArray(json?.blocked) ? json.blocked : [];
      const parsed = arr
        .map((it: any) => ({
          blockedSub: String(it?.blockedSub || ''),
          blockedDisplayName: it?.blockedDisplayName ? String(it.blockedDisplayName) : undefined,
          blockedUsernameLower: it?.blockedUsernameLower ? String(it.blockedUsernameLower) : undefined,
          blockedAt: typeof it?.blockedAt === 'number' ? Number(it.blockedAt) : undefined,
        }))
        .filter((b: any) => b.blockedSub);
      setBlockedUsers(parsed);
      setBlocklistCacheAt(Date.now());
      try {
        await AsyncStorage.setItem('blocklist:cache:v1', JSON.stringify({ at: Date.now(), blocked: parsed }));
      } catch {
        // ignore
      }
    } catch {
      // ignore
    } finally {
      setBlocklistLoading(false);
    }
  }, [API_URL]);

  const addBlockByUsername = React.useCallback(async (): Promise<void> => {
    if (!API_URL) return;
    const username = blockUsername.trim();
    if (!username) {
      setBlockError('Enter a username');
      return;
    }
    const ok = await promptConfirm(
      'Block user?',
      `Block "${username}"? You won’t see their messages, and they won’t be able to DM you.\n\nYou can unblock them later from your Blocklist.`,
      { confirmText: 'Block', cancelText: 'Cancel', destructive: true }
    );
    if (!ok) return;

    try {
      setBlockError(null);
      setBlocklistLoading(true);
      const { tokens } = await fetchAuthSession();
      const idToken = tokens?.idToken?.toString();
      if (!idToken) return;
      const res = await fetch(`${API_URL.replace(/\/$/, '')}/blocks`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      if (res.status === 404) {
        setBlockError('No such user');
        return;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        setBlockError(text ? `Failed to block (${res.status})` : `Failed to block (${res.status})`);
        return;
      }
      setBlockUsername('');
      await fetchBlocks();
    } catch {
      setBlockError('Failed to block user');
    } finally {
      setBlocklistLoading(false);
    }
  }, [API_URL, blockUsername, fetchBlocks, promptConfirm]);

  const addBlockBySub = React.useCallback(
    async (blockedSub: string, label?: string): Promise<void> => {
      if (!API_URL) throw new Error('Missing API_URL');
      const sub = String(blockedSub || '').trim();
      if (!sub) throw new Error('Missing user id');

      const { tokens } = await fetchAuthSession();
      const idToken = tokens?.idToken?.toString();
      if (!idToken) throw new Error('Missing auth token');

      const res = await fetch(`${API_URL.replace(/\/$/, '')}/blocks`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockedSub: sub }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const who = label ? `"${label}"` : 'user';
        throw new Error(text?.trim() ? `Failed to block ${who}: ${text.trim()}` : `Failed to block ${who} (${res.status})`);
      }

      await fetchBlocks();
    },
    [API_URL, fetchBlocks]
  );

  const unblockUser = React.useCallback(
    async (blockedSub: string, label?: string) => {
      const subToUnblock = String(blockedSub || '').trim();
      if (!subToUnblock || !API_URL) return;
      const ok = await promptConfirm(
        'Unblock user?',
        `Unblock ${label ? `"${label}"` : 'this user'}?`,
        { confirmText: 'Unblock', cancelText: 'Cancel', destructive: false }
      );
      if (!ok) return;

      try {
        setBlocklistLoading(true);
        const { tokens } = await fetchAuthSession();
        const idToken = tokens?.idToken?.toString();
        if (!idToken) return;
        const res = await fetch(`${API_URL.replace(/\/$/, '')}/blocks/delete`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ blockedSub: subToUnblock }),
        });
        if (!res.ok) return;
        setBlockedUsers((prev) => prev.filter((b) => b.blockedSub !== subToUnblock));
      } finally {
        setBlocklistLoading(false);
      }
    },
    [API_URL, promptConfirm]
  );

  React.useEffect(() => {
    if (!blocklistOpen) return;
    setBlockError(null);
    // Cache strategy:
    // - Show whatever we already have immediately (state or persisted cache).
    // - Refresh in background only if stale.
    const STALE_MS = 60_000;
    if (blocklistCacheAt && Date.now() - blocklistCacheAt < STALE_MS) return;
    void fetchBlocks();
  }, [blocklistOpen, fetchBlocks, blocklistCacheAt]);

  // Load cached blocklist on boot so Blocklist opens instantly.
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('blocklist:cache:v1');
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const arr = Array.isArray(parsed?.blocked) ? parsed.blocked : [];
        const at = Number(parsed?.at ?? 0);
        if (!mounted) return;
        if (arr.length) setBlockedUsers(arr);
        if (Number.isFinite(at) && at > 0) setBlocklistCacheAt(at);
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const chatsList = React.useMemo(() => {
    const mapUnread = unreadDmMap;
    if (serverConversations.length) {
      return serverConversations
        .map((c) => ({
          conversationId: c.conversationId,
          peer: c.peerDisplayName || mapUnread[c.conversationId]?.user || 'Direct Message',
          conversationKind: c.conversationKind,
          memberStatus: c.memberStatus,
          lastActivityAt: Number(c.lastMessageAt || 0),
          unreadCount: mapUnread[c.conversationId]?.count || 0,
        }))
        .sort((a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0));
    }
    return dmThreadsList;
  }, [dmThreadsList, serverConversations, unreadDmMap]);

  // theme persistence handled by useStoredTheme

  // Load persisted DM threads (best-effort).
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('dm:threads:v1');
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!mounted) return;
        if (parsed && typeof parsed === 'object') {
          setDmThreads(() => parsed);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Persist DM threads (best-effort).
  React.useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem('dm:threads:v1', JSON.stringify(dmThreads));
      } catch {
        // ignore
      }
    })();
  }, [dmThreads]);

  // Refresh conversation list when opening the Chats modal.
  React.useEffect(() => {
    if (!chatsOpen) return;
    void fetchConversations();
    void fetchUnreads();
  }, [chatsOpen, fetchConversations, fetchUnreads]);

  // Load cached conversations on boot so Chats opens instantly.
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('conversations:cache:v1');
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const convos = Array.isArray(parsed?.conversations) ? parsed.conversations : [];
        const at = Number(parsed?.at ?? 0);
        if (!mounted) return;
        if (convos.length) setServerConversations(convos);
        if (Number.isFinite(at) && at > 0) setConversationsCacheAt(at);
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const startDM = async () => {
      const raw = peerInput.trim();
      const normalizedCurrent = currentUsername.trim().toLowerCase();
      if (!raw) {
        setSearchError('Enter a username');
        return;
      }

      // Support group DMs: comma/space separated usernames.
      const tokens = raw
        .split(/[,\s]+/g)
        .map((t) => t.trim())
        .filter(Boolean);
      const normalizedTokens = Array.from(new Set(tokens.map((t) => t.toLowerCase())));

      // 1:1 DM (existing behavior)
      if (normalizedTokens.length === 1) {
        const trimmed = tokens[0];
        const normalizedInput = trimmed.toLowerCase();
        if (!trimmed || normalizedInput === normalizedCurrent) {
          setSearchError(normalizedInput === normalizedCurrent ? 'Not you silly!' : 'Enter a username');
          return;
        }

        const { tokens: authTokens } = await fetchAuthSession();
        const idToken = authTokens?.idToken?.toString();
        if (!idToken) {
          setSearchError('Unable to authenticate');
          return;
        }

        const res = await fetch(`${API_URL.replace(/\/$/, '')}/users?username=${encodeURIComponent(trimmed)}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (res.status === 404) {
          setSearchError('No such user!');
          return;
        }
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          console.warn('getUser failed', res.status, text);
          let msg = text;
          try {
            const parsed = text ? JSON.parse(text) : null;
            if (parsed && typeof parsed.message === 'string') msg = parsed.message;
          } catch {
            // ignore
          }
          setSearchError(msg ? `User lookup failed (${res.status}): ${msg}` : `User lookup failed (${res.status})`);
          return;
        }

        const data = await res.json();
        const peerSub = String(data.sub || data.userSub || '').trim();
        const canonical = String(data.displayName || data.preferred_username || data.username || trimmed).trim();
        if (!peerSub) {
          console.warn('getUser ok but missing sub', data);
          setSearchError('User lookup missing sub (check getUser response JSON)');
          return;
        }
        if (blockedSubs.includes(peerSub)) {
          setSearchError('That user is in your Blocklist. Unblock them to start a DM.');
          return;
        }
        const normalizedCanonical = canonical.toLowerCase();
        if (normalizedCanonical === normalizedCurrent) {
          setSearchError('Not you silly!');
          return;
        }
        const mySub = (await fetchUserAttributes()).sub as string | undefined;
        if (!mySub) {
          setSearchError('Unable to authenticate');
          return;
        }
        if (peerSub === mySub) {
          setSearchError('Not you silly!');
          return;
        }
        const [a, b] = [mySub, peerSub].sort();
        const id = `dm#${a}#${b}`;
        setPeer(canonical);
        setConversationId(id);
        upsertDmThread(id, canonical, Date.now());
        setSearchOpen(false);
        setPeerInput('');
        setSearchError(null);
        return;
      }

      // Group DM start
      if (normalizedTokens.length > 7) {
        setSearchError('Too many members (max 8 including you).');
        return;
      }
      if (normalizedTokens.includes(normalizedCurrent)) {
        setSearchError("Don't include yourself.");
        return;
      }

      const { tokens: authTokens } = await fetchAuthSession();
      const idToken = authTokens?.idToken?.toString();
      if (!idToken) {
        setSearchError('Unable to authenticate');
        return;
      }

      const res = await fetch(`${API_URL.replace(/\/$/, '')}/groups/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: normalizedTokens }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        let msg = text;
        try {
          const parsed = text ? JSON.parse(text) : null;
          if (parsed && typeof parsed.message === 'string') msg = parsed.message;
        } catch {
          // ignore
        }
        setSearchError(msg ? `Group start failed (${res.status}): ${msg}` : `Group start failed (${res.status})`);
        return;
      }
      const data = await res.json().catch(() => ({}));
      const convId = String(data.conversationId || '').trim();
      const title = String(data.title || 'Group DM').trim();
      if (!convId) {
        setSearchError('Group start missing conversationId');
        return;
      }
      setPeer(title);
      setConversationId(convId);
      upsertDmThread(convId, title, Date.now());
      setSearchOpen(false);
      setPeerInput('');
      setSearchError(null);
    };

  const getChannelIdFromConversationId = React.useCallback((cid: string): string | null => {
    const s = String(cid || '').trim();
    if (!s.startsWith('ch#')) return null;
    const id = s.slice('ch#'.length).trim();
    return id || null;
  }, []);

  const activeChannelConversationId = React.useMemo(() => {
    if (!isDmMode) return conversationId || 'global';
    return lastChannelConversationIdRef.current || 'global';
  }, [isDmMode, conversationId]);

  const activeChannelLabel = React.useMemo(() => {
    if (activeChannelConversationId === 'global') return 'Global';
    const id = getChannelIdFromConversationId(activeChannelConversationId);
    if (!id) return 'Global';
    return channelNameById[id] || 'Channel';
  }, [activeChannelConversationId, getChannelIdFromConversationId, channelNameById]);

  const enterChannelConversation = React.useCallback(
    (nextConversationId: string) => {
      const cid = String(nextConversationId || '').trim() || 'global';
      // Entering a channel should close DM search UI and clear DM peer state.
      setConversationId(cid);
      setPeer(null);
      setSearchOpen(false);
      setPeerInput('');
      setSearchError(null);
      setChannelsOpen(false);
      setChannelSearchOpen(false);
      setChannelsError(null);
      setChannelJoinError(null);
      setChannelsQuery('');
    },
    []
  );

  const fetchChannelsSearch = React.useCallback(
    async (query: string) => {
      if (!API_URL) return;
      setChannelsLoading(true);
      setChannelsError(null);
      try {
        const token = await getIdToken();
        if (!token) {
          setChannelsError('Unable to authenticate');
          return;
        }
        const q = String(query || '').trim();
        const r = await searchChannels({
          apiUrl: API_URL,
          query: q,
          limit: 50,
          token,
          preferPublic: false,
          includePublic: false,
          includeAuthed: true,
        });
        if (typeof r.globalUserCount === 'number') {
          setGlobalUserCount(r.globalUserCount);
        } else if (!q) {
          // When opening the modal with empty search, prefer clearing stale counts if not provided.
          setGlobalUserCount(null);
        }
        const normalized = r.channels.map((c) => ({ ...c, isPublic: !!(c as any).isPublic }));
        setChannelsResults(normalized);
        setChannelNameById((prev) => {
          const next = { ...prev };
          for (const c of normalized) next[c.channelId] = c.name;
          return next;
        });
      } catch (e: any) {
        setChannelsError(String(e?.message || 'Channel search failed'));
      } finally {
        setChannelsLoading(false);
      }
    },
    [API_URL, getIdToken]
  );

  const debouncedChannelsQuery = useDebouncedValue(channelsQuery, 150, channelSearchOpen);

  React.useEffect(() => {
    if (!channelSearchOpen) return;
    const q = debouncedChannelsQuery;
    void fetchChannelsSearch(q);
  }, [channelSearchOpen, debouncedChannelsQuery, fetchChannelsSearch]);

  const joinChannel = React.useCallback(
    async (channel: { channelId: string; name: string; isMember?: boolean; hasPassword?: boolean }) => {
      const channelId = String(channel.channelId || '').trim();
      if (!channelId) return;
      if (channel.isMember) {
        enterChannelConversation(`ch#${channelId}`);
        return;
      }
      if (channel.hasPassword) {
        setChannelPasswordInput('');
        setChannelJoinError(null);
        setChannelSearchOpen(false);
        setChannelPasswordPrompt({ channelId, name: String(channel.name || 'Channel') });
        return;
      }
      if (!API_URL) return;
      const token = await getIdToken();
      if (!token) {
        setChannelJoinError('Unable to authenticate');
        return;
      }
      const base = API_URL.replace(/\/$/, '');
      const resp = await fetch(`${base}/channels/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId }),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        let msg = `Join failed (${resp.status})`;
        try {
          const parsed = text ? JSON.parse(text) : null;
          if (parsed && typeof parsed.message === 'string') msg = parsed.message;
        } catch {
          if (text.trim()) msg = `${msg}: ${text.trim()}`;
        }
        setChannelJoinError(msg);
        return;
      }
      const data = await resp.json().catch(() => ({}));
      const ch = data?.channel || {};
      const name = String(ch.name || channel.name || 'Channel').trim();
      setChannelNameById((prev) => ({ ...prev, [channelId]: name }));
      enterChannelConversation(`ch#${channelId}`);
    },
    [API_URL, getIdToken, enterChannelConversation]
  );

  const submitChannelPassword = React.useCallback(async () => {
    const prompt = channelPasswordPrompt;
    if (!prompt) return;
    const channelId = String(prompt.channelId || '').trim();
    const pw = String(channelPasswordInput || '').trim();
    if (!channelId) return;
    if (!pw) {
      setChannelJoinError('Enter a password');
      return;
    }
    if (!API_URL) return;
    const token = await getIdToken();
    if (!token) {
      setChannelJoinError('Unable to authenticate');
      return;
    }
    setChannelJoinError(null);
    const base = API_URL.replace(/\/$/, '');
    const resp = await fetch(`${base}/channels/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId, password: pw }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      let msg = `Join failed (${resp.status})`;
      try {
        const parsed = text ? JSON.parse(text) : null;
        if (parsed && typeof parsed.message === 'string') msg = parsed.message;
      } catch {
        if (text.trim()) msg = `${msg}: ${text.trim()}`;
      }
      setChannelJoinError(msg);
      return;
    }
    const data = await resp.json().catch(() => ({}));
    const ch = data?.channel || {};
    const name = String(ch.name || prompt.name || 'Channel').trim();
    setChannelNameById((prev) => ({ ...prev, [channelId]: name }));
    // Save locally for re-join UX (optional).
    try {
      await AsyncStorage.setItem(`channels:pw:${channelId}`, pw);
    } catch {
      // ignore
    }
    setChannelPasswordPrompt(null);
    setChannelPasswordInput('');
    enterChannelConversation(`ch#${channelId}`);
  }, [channelPasswordPrompt, channelPasswordInput, API_URL, getIdToken, enterChannelConversation]);

  const fetchMyChannels = React.useCallback(async () => {
    if (!API_URL) return;
    setMyChannelsLoading(true);
    setMyChannelsError(null);
    try {
      const token = await getIdToken();
      if (!token) {
        setMyChannelsError('Unable to authenticate');
        return;
      }
      const r = await searchChannels({
        apiUrl: API_URL,
        query: '',
        limit: 100,
        token,
        preferPublic: false,
        includePublic: false,
        includeAuthed: true,
      });
      const joined = r.channels
        .filter((c) => c && c.isMember === true)
        .map((c) => ({ channelId: String(c.channelId || '').trim(), name: String(c.name || '').trim() }))
        .filter((c: any) => c.channelId && c.name)
        .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));
      setMyChannels(joined);
      setChannelNameById((prev) => {
        const next = { ...prev };
        for (const c of joined) next[c.channelId] = c.name;
        return next;
      });
    } catch (e: any) {
      setMyChannelsError(String(e?.message || 'Failed to load channels'));
    } finally {
      setMyChannelsLoading(false);
    }
  }, [API_URL, getIdToken]);

  React.useEffect(() => {
    if (!channelsOpen) return;
    void fetchMyChannels();
  }, [channelsOpen, fetchMyChannels]);

  const leaveChannelFromSettings = React.useCallback(
    async (channelId: string) => {
      const cid = String(channelId || '').trim();
      if (!cid) return;
      if (!API_URL) return;
      try {
        const token = await getIdToken();
        if (!token) {
          setMyChannelsError('Unable to authenticate');
          return;
        }
        const base = API_URL.replace(/\/$/, '');
        const resp = await fetch(`${base}/channels/leave`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelId: cid }),
        });
        if (!resp.ok) {
          const text = await resp.text().catch(() => '');
          let msg = `Leave failed (${resp.status})`;
          try {
            const parsed = text ? JSON.parse(text) : null;
            if (parsed && typeof parsed.message === 'string') msg = parsed.message;
          } catch {
            if (text.trim()) msg = `${msg}: ${text.trim()}`;
          }
          // Show a proper prompt (especially for "last admin" cases).
          void promptAlert('Unable to leave', msg);
          return;
        }
        setMyChannels((prev) => (Array.isArray(prev) ? prev : []).filter((c) => String(c.channelId) !== cid));
      } catch (e: any) {
        void promptAlert('Unable to leave', String(e?.message || 'Leave failed'));
      }
    },
    [API_URL, getIdToken, promptAlert]
  );

  const submitCreateChannelInline = React.useCallback(async () => {
    if (!API_URL) return;
    if (createChannelLoading) return;
    const name = String(createChannelName || '').trim();
    if (!name) {
      setCreateChannelError('Enter a channel name');
      return;
    }
    const token = await getIdToken();
    if (!token) {
      setCreateChannelError('Unable to authenticate');
      return;
    }
    setCreateChannelLoading(true);
    setCreateChannelError(null);
    try {
      const base = API_URL.replace(/\/$/, '');
      const body: { name: string; isPublic: boolean; password?: string } = { name, isPublic: !!createChannelIsPublic };
      const pw = String(createChannelPassword || '').trim();
      // Passwords only apply to public channels (private channels aren't joinable via password).
      if (pw && createChannelIsPublic) body.password = pw;
      const resp = await fetch(`${base}/channels/create`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        let msg = `Create failed (${resp.status})`;
        try {
          const parsed = text ? JSON.parse(text) : null;
          if (parsed && typeof parsed.message === 'string') msg = parsed.message;
        } catch {
          if (text.trim()) msg = `${msg}: ${text.trim()}`;
        }
        setCreateChannelError(msg);
        return;
      }
      const data = await resp.json().catch(() => ({}));
      const ch = data?.channel || {};
      const channelId = String(ch.channelId || '').trim();
      const channelName = String(ch.name || name || 'Channel').trim();
      if (!channelId) {
        setCreateChannelError('Create failed (missing channelId)');
        return;
      }
      setChannelNameById((prev) => ({ ...prev, [channelId]: channelName }));
      setCreateChannelOpen(false);
      setCreateChannelName('');
      setCreateChannelPassword('');
      setCreateChannelError(null);
      setChannelsOpen(false);
      enterChannelConversation(`ch#${channelId}`);
      void fetchMyChannels();
    } finally {
      setCreateChannelLoading(false);
    }
  }, [
    API_URL,
    createChannelLoading,
    createChannelName,
    createChannelIsPublic,
    createChannelPassword,
    getIdToken,
    enterChannelConversation,
    fetchMyChannels,
  ]);

  const hasUnreadDms = Object.keys(unreadDmMap).length > 0;
  const unreadEntries = React.useMemo(
    () => Object.entries(unreadDmMap),
    [unreadDmMap]
  );

  const goToConversation = React.useCallback(
    (targetConversationId: string) => {
      if (!targetConversationId) return;
      setConversationId(targetConversationId);
      if (targetConversationId === 'global' || String(targetConversationId).startsWith('ch#')) {
        setPeer(null);
        setSearchOpen(false);
        setPeerInput('');
        setSearchError(null);
        setChannelsOpen(false);
        setChannelSearchOpen(false);
        setChannelsError(null);
        setChannelJoinError(null);
        setChannelsQuery('');
        return;
      }
      // Best-effort title selection:
      // 1) server conversations (authoritative titles for groups + DMs)
      // 2) unread cache (push/unreads can provide a title)
      // 3) fallback by kind
      const server = serverConversations.find((c) => c.conversationId === targetConversationId);
      const cached = unreadDmMap[targetConversationId];
      const kind =
        server?.conversationKind ||
        (String(targetConversationId || '').startsWith('gdm#') ? 'group' : String(targetConversationId || '').startsWith('dm#') ? 'dm' : undefined);
      const title =
        (server?.peerDisplayName && String(server.peerDisplayName).trim()) ||
        (cached?.user && String(cached.user).trim()) ||
        (targetConversationId === 'global' ? '' : kind === 'group' ? 'Group DM' : 'Direct Message');
      if (targetConversationId === 'global') setPeer(null);
      else setPeer(title || (kind === 'group' ? 'Group DM' : 'Direct Message'));
      if (targetConversationId !== 'global') {
        upsertDmThread(
          targetConversationId,
          title || peer || (kind === 'group' ? 'Group DM' : 'Direct Message'),
          Date.now()
        );
      }
      setSearchOpen(false);
      setPeerInput('');
      setSearchError(null);
    },
    [unreadDmMap, upsertDmThread, peer, serverConversations]
  );

  // Handle taps on OS notifications to jump into the DM.
  React.useEffect(() => {
    let sub: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Notifications = require('expo-notifications');
      sub = Notifications.addNotificationResponseReceivedListener((resp: any) => {
        const data = resp?.notification?.request?.content?.data || {};
        const kind = typeof data.kind === 'string' ? data.kind : '';
        const convId = typeof data.conversationId === 'string' ? data.conversationId : '';
        const senderName = typeof data.senderDisplayName === 'string' ? data.senderDisplayName : '';
        if ((kind === 'dm' || kind === 'group') && convId) {
          setSearchOpen(false);
          setPeerInput('');
          setSearchError(null);
          setConversationId(convId);
          setPeer(senderName || (kind === 'group' ? 'Group DM' : 'Direct Message'));
          return;
        }
        if ((kind === 'channelMention' || kind === 'channelReply') && convId && convId.startsWith('ch#')) {
          const channelName = typeof data.channelName === 'string' ? data.channelName : '';
          const channelId = convId.slice('ch#'.length).trim();
          if (channelId && channelName.trim()) {
            setChannelNameById((prev) => ({ ...prev, [channelId]: channelName.trim() }));
          }
          setSearchOpen(false);
          setPeerInput('');
          setSearchError(null);
          setPeer(null);
          setConversationId(convId);
        }
      });
    } catch {
      // expo-notifications not installed / dev client not rebuilt
    }
    return () => {
      try {
        sub?.remove?.();
      } catch {
        // ignore
      }
    };
  }, []);

  const handleNewDmNotification = React.useCallback(
    (newConversationId: string, sender: string, senderSub?: string) => {
      setUnreadDmMap((prev) => {
        if (!newConversationId || newConversationId === 'global') return prev;
        if (newConversationId === conversationId) return prev;
        const existing = prev[newConversationId];
        const next = { ...prev };
        next[newConversationId] = {
          user: sender || existing?.user || 'someone',
          senderSub: senderSub || existing?.senderSub,
          count: (existing?.count ?? 0) + 1,
        };
        return next;
      });
      if (newConversationId && newConversationId !== 'global') {
        upsertDmThread(newConversationId, sender || 'Direct Message', Date.now());
      }
    },
    [conversationId, upsertDmThread]
  );

  React.useEffect(() => {
    if (!conversationId) return;
    // Only clear unread badges for DM / group DM conversations.
    if (!(conversationId.startsWith('dm#') || conversationId.startsWith('gdm#'))) return;
    setUnreadDmMap((prev) => {
      if (!prev[conversationId]) return prev;
      const next = { ...prev };
      delete next[conversationId];
      return next;
    });
  }, [conversationId]);

  // Hydrate unread DMs on login so the badge survives logout/login.
  React.useEffect(() => {
    if (!user) return;
    void fetchUnreads();
  }, [user, fetchUnreads]);

  // Avoid stacking multiple React Native `Modal`s at once on web:
  // when we show a confirm/choice prompt (uiPrompt), hide the passphrase modal so
  // the confirm/choice isn't rendered "behind" it.
  const promptVisible = !!passphrasePrompt && !uiPromptOpen;
  const promptLabel =
    passphrasePrompt?.mode === 'restore'
      ? 'Enter your Recovery Passphrase'
      : passphrasePrompt?.mode === 'change'
        ? 'Change your Recovery Passphrase'
        : passphrasePrompt?.mode === 'reset'
          ? 'Set a New Recovery Passphrase'
        : 'Create a Recovery Passphrase';

  const headerTop = (
    <>
      <View style={styles.topRow}>
        <View style={[styles.segment, isDark && styles.segmentDark]}>
          <Pressable
            onPress={() => {
              if (isDmMode) {
                // Jump back to the last channel (default Global).
                enterChannelConversation(activeChannelConversationId);
                return;
              }
              // While already in channel mode, open the channel search/join picker (like "Start DM").
              setChannelsError(null);
              setChannelJoinError(null);
              setChannelsQuery('');
              setChannelSearchOpen(true);
            }}
            style={({ pressed }) => [
              styles.segmentBtn,
              isChannelMode && styles.segmentBtnActive,
              isChannelMode && isDark && styles.segmentBtnActiveDark,
              pressed && { opacity: 0.9 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Channels"
          >
            <Text
              style={[
                styles.segmentBtnText,
                isDark && styles.segmentBtnTextDark,
                isChannelMode && styles.segmentBtnTextActive,
                isChannelMode && isDark && styles.segmentBtnTextActiveDark,
              ]}
            >
              {activeChannelLabel}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setSearchOpen((prev) => !prev)}
            style={({ pressed }) => [
              styles.segmentBtn,
              (isDmMode || searchOpen) && styles.segmentBtnActive,
              (isDmMode || searchOpen) && isDark && styles.segmentBtnActiveDark,
              pressed && { opacity: 0.9 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Direct messages"
          >
            <View style={styles.dmPillInner}>
              <Text
                style={[
                  styles.segmentBtnText,
                  isDark && styles.segmentBtnTextDark,
                  (isDmMode || searchOpen) && styles.segmentBtnTextActive,
                  (isDmMode || searchOpen) && isDark && styles.segmentBtnTextActiveDark,
                ]}
              >
                DM
              </Text>
              {hasUnreadDms ? <View style={styles.unreadDot} /> : null}
            </View>
          </Pressable>
        </View>

        <View style={styles.rightControls}>
          <Pressable
            ref={menu.ref}
            onPress={() => {
              menu.openFromRef({ enabled: isWideUi, onOpen: () => setMenuOpen(true) });
            }}
            style={({ pressed }) => [
              styles.menuIconBtn,
              isDark && styles.menuIconBtnDark,
              pressed && { opacity: 0.85 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Open menu"
          >
            <AppBrandIcon
              isDark={isDark}
              fit="contain"
              slotWidth={32}
              slotHeight={32}
              accessible={false}
            />
          </Pressable>
        </View>
      </View>

      {searchOpen && (
        <View
          style={[
            styles.searchWrapper,
            // When there are no unread hints, add a bit more space before the chat title row.
            // If there ARE unread hints, keep it tight so we don't "double pad" the header.
            !unreadEntries.length ? { marginBottom: 6 } : null,
          ]}
        >
          <View style={styles.searchRow}>
            <TextInput
              value={peerInput}
              onChangeText={(value) => {
                setPeerInput(value);
                setSearchError(null);
              }}
              placeholder="Enter Names"
              placeholderTextColor={isDark ? '#8f8fa3' : '#999'}
              selectionColor={isDark ? '#ffffff' : '#111'}
              cursorColor={isDark ? '#ffffff' : '#111'}
              style={[styles.searchInput, isDark && styles.searchInputDark]}
            />
            <Pressable
              onPress={startDM}
              style={({ pressed }) => [
                styles.startDmBtn,
                isDark && styles.startDmBtnDark,
                pressed && { opacity: 0.9 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Start direct message"
            >
              <Text style={[styles.startDmBtnText, isDark && styles.startDmBtnTextDark]}>
                Start DM
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setSearchOpen(false);
                setPeerInput('');
                setSearchError(null);
              }}
              style={({ pressed }) => [
                styles.cancelBtn,
                isDark && styles.cancelBtnDark,
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Cancel direct message"
            >
              <Text style={[styles.cancelBtnText, isDark && styles.cancelBtnTextDark]}>
                Cancel
              </Text>
            </Pressable>
          </View>
          {unreadEntries.length ? (
            <View style={styles.unreadList}>
              {unreadEntries.map(([convId, info]) => (
                <Pressable
                  key={convId}
                  style={styles.unreadHintWrapper}
                  onPress={() => goToConversation(convId)}
                >
                  <Text style={[styles.unreadHint, isDark && styles.unreadHintDark]}>
                    {info.count} unread {info.count === 1 ? 'message' : 'messages'} from{' '}
                    <Text style={[styles.unreadHintBold, isDark && styles.unreadHintBoldDark]}>
                      {info.user}
                    </Text>
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      )}

      {searchError ? (
        <Text style={[styles.errorText, isDark && styles.errorTextDark]}>{searchError}</Text>
      ) : null}
    </>
  );

  return (
    <View style={[styles.appContent, isDark ? styles.appContentDark : null]}>
      <HeaderMenuModal
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={undefined}
        isDark={isDark}
        cardWidth={160}
        anchor={isWideUi ? menu.anchor : null}
        headerRight={
          <ThemeToggleRow isDark={isDark} onSetTheme={setTheme} styles={styles} />
        }
        items={[
          {
            key: 'about',
            label: 'About',
            onPress: () => {
              setMenuOpen(false);
              // About is tied to the Channels-side conversation (Global or a channel),
              // even if the user is currently looking at a DM.
              const cid = String(activeChannelConversationId || '').trim() || 'global';
              if (cid === 'global') {
                setGlobalAboutOpen(true);
                return;
              }
              if (cid.startsWith('ch#')) {
                setChannelAboutRequestEpoch((v) => v + 1);
                return;
              }
            },
          },
          {
            key: 'chats',
            label: 'Chats',
            onPress: () => {
              setMenuOpen(false);
              setChatsOpen(true);
            },
          },
          {
            key: 'channels',
            label: 'Channels',
            onPress: () => {
              setMenuOpen(false);
              setMyChannelsError(null);
              setCreateChannelError(null);
              setCreateChannelOpen(false);
              setCreateChannelName('');
              setCreateChannelPassword('');
              setCreateChannelIsPublic(true);
              setChannelSearchOpen(false);
              setChannelsError(null);
              setChannelJoinError(null);
              setChannelsQuery('');
              setChannelsOpen(true);
            },
          },
          {
            key: 'avatar',
            label: 'Avatar',
            onPress: () => {
              setMenuOpen(false);
              setAvatarError(null);
              setAvatarOpen(true);
            },
          },
          {
            key: 'background',
            label: 'Background',
            onPress: () => {
              setMenuOpen(false);
              setBackgroundError(null);
              setBackgroundOpen(true);
            },
          },
          {
            key: 'recovery',
            label: 'Recovery',
            onPress: async () => {
              setMenuOpen(false);
              setRecoveryOpen(true);
              // After a Metro refresh, Amplify may take a moment to rehydrate tokens.
              // Refresh recovery state so the modal shows "Change" vs "Set up" correctly.
              const token = await getIdTokenWithRetry({ maxAttempts: 10, delayMs: 200 });
              if (token) {
                const exists = await checkRecoveryBlobExists(token);
                if (exists !== null) applyRecoveryBlobExists(exists);
              }
            },
          },
          {
            key: 'blocked',
            label: 'Blocklist',
            onPress: () => {
              setMenuOpen(false);
              setBlocklistOpen(true);
            },
          },
          {
            key: 'deleteAccount',
            label: 'Delete account',
            onPress: async () => {
              setMenuOpen(false);
              await deleteMyAccount();
            },
          },
          {
            key: 'signout',
            label: 'Sign out',
            onPress: async () => {
              setMenuOpen(false);
              try {
                await unregisterDmPushNotifications();
                await signOut();
              } finally {
                onSignedOut?.();
              }
            },
          },
        ]}
      />

      <Modal
        visible={globalAboutOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          void dismissGlobalAbout();
        }}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => void dismissGlobalAbout()} />
          <View style={[styles.modalContent, isDark ? styles.modalContentDark : null]}>
            <ScrollView style={{ maxHeight: 340 }}>
              <GlobalAboutContent
                isDark={isDark}
                titleStyle={[styles.modalTitle, isDark ? styles.modalTitleDark : null]}
                bodyStyle={[
                  styles.modalHelperText,
                  ...(isDark ? [styles.modalHelperTextDark] : []),
                  // Slightly more comfortable reading in the About modal.
                  { marginBottom: 0 },
                ]}
              />
            </ScrollView>
            <View style={[styles.modalButtons, { justifyContent: 'flex-end', marginTop: 12 }]}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonSmall, isDark ? styles.modalButtonDark : null]}
                onPress={() => void dismissGlobalAbout()}
              >
                <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>Got it</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={avatarOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (avatarSavingRef.current) return;
          // Discard draft changes unless saved.
          setAvatarOpen(false);
          setAvatarDraft(myAvatar);
          setAvatarDraftImageUri(null);
          setAvatarDraftRemoveImage(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            disabled={avatarSaving}
            onPress={() => {
              if (avatarSavingRef.current) return;
              // Discard draft changes unless saved.
              setAvatarOpen(false);
              setAvatarDraft(myAvatar);
              setAvatarDraftImageUri(null);
              setAvatarDraftRemoveImage(false);
            }}
          />
          <View style={[styles.profileCard, isDark ? styles.profileCardDark : null]}>
            <View style={styles.chatsTopRow}>
              <Text style={[styles.modalTitle, isDark ? styles.modalTitleDark : null]}>Avatar</Text>
            </View>

            <View style={styles.profilePreviewRow}>
              <AvatarBubble
                seed={myUserSub || displayName}
                label={displayName}
                size={44}
                backgroundColor={avatarDraft.bgColor || pickDefaultAvatarColor(myUserSub || displayName)}
                textColor={avatarDraft.textColor || '#fff'}
                imageUri={avatarDraftImageUri || avatarDraft.imageUri}
                imageBgColor={isDark ? '#1c1c22' : '#f2f2f7'}
              />
              <View style={styles.profilePreviewMeta}>
                <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null]}>
                  Pick colors or upload a photo (you can zoom/crop)
                </Text>
              </View>
            </View>

            {avatarError ? (
              <Text style={[styles.errorText, isDark && styles.errorTextDark]}>{avatarError}</Text>
            ) : null}

            {avatarDraftImageUri || avatarDraft.imageUri ? (
              <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null, { marginTop: 6 }]}>
                Photo avatar enabled - remove the photo to edit bubble/text colors
              </Text>
            ) : (
              <>
                <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null, styles.profileSectionTitle]}>
                  Bubble color
                </Text>
                <View style={styles.avatarPaletteRow}>
                  {AVATAR_DEFAULT_COLORS.map((c) => {
                    const selected = (avatarDraft.bgColor || '') === c;
                    return (
                      <Pressable
                        key={`bg:${c}`}
                        onPress={() => setAvatarDraft((prev) => ({ ...prev, bgColor: c }))}
                        style={[
                          styles.avatarColorDot,
                          { backgroundColor: c },
                          selected ? (isDark ? styles.avatarColorDotSelectedDark : styles.avatarColorDotSelected) : null,
                        ]}
                      />
                    );
                  })}
                </View>

                <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null, styles.profileSectionTitle]}>
                  Text color
                </Text>
                <View style={styles.avatarTextColorRow}>
                  <Pressable
                    onPress={() => setAvatarDraft((prev) => ({ ...prev, textColor: '#fff' }))}
                    style={[
                      styles.avatarTextColorBtn,
                      isDark ? styles.avatarTextColorBtnDark : null,
                      (avatarDraft.textColor || '#fff') === '#fff'
                        ? (isDark ? styles.avatarTextColorBtnSelectedDark : styles.avatarTextColorBtnSelected)
                        : null,
                    ]}
                  >
                    <Text style={[styles.avatarTextColorLabel, isDark ? styles.avatarTextColorLabelDark : null]}>White</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setAvatarDraft((prev) => ({ ...prev, textColor: '#111' }))}
                    style={[
                      styles.avatarTextColorBtn,
                      isDark ? styles.avatarTextColorBtnDark : null,
                      (avatarDraft.textColor || '#fff') === '#111'
                        ? (isDark ? styles.avatarTextColorBtnSelectedDark : styles.avatarTextColorBtnSelected)
                        : null,
                    ]}
                  >
                    <Text style={[styles.avatarTextColorLabel, isDark ? styles.avatarTextColorLabelDark : null]}>Black</Text>
                  </Pressable>
                </View>
              </>
            )}

            <View style={styles.profileActionsRow}>
              <Pressable
                disabled={avatarSaving}
                style={({ pressed }) => [
                  styles.toolBtn,
                  isDark && styles.toolBtnDark,
                  avatarSaving ? { opacity: 0.5 } : null,
                  pressed && !avatarSaving ? { opacity: 0.92 } : null,
                ]}
                onPress={async () => {
                  try {
                    setAvatarError(null);
                    setAvatarDraftRemoveImage(false);
                    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (!perm.granted) {
                      setAvatarError('Please allow photo library access to choose an avatar.');
                      return;
                    }
                    const result = await ImagePicker.launchImageLibraryAsync({
                      // Avoid deprecated MediaTypeOptions while staying compatible with older typings.
                      mediaTypes: ['images'] as any,
                      allowsEditing: true, // built-in crop UI w/ zoom
                      aspect: [1, 1],
                      quality: 0.9,
                    });
                    if (result.canceled) return;
                    const uri = result.assets?.[0]?.uri;
                    if (!uri) return;
                    setAvatarDraftImageUri(uri);
                  } catch (e: any) {
                    setAvatarError(e?.message || 'Could not pick image.');
                  }
                }}
                accessibilityRole="button"
                accessibilityState={{ disabled: avatarSaving }}
              >
                <Text style={[styles.toolBtnText, isDark && styles.toolBtnTextDark]}>Upload photo</Text>
              </Pressable>

              {/*
                Disable "Remove photo" when there's nothing to remove, and while saving to avoid
                racey state changes during the upload/save pipeline.
              */}
              <Pressable
                disabled={avatarSaving || (!avatarDraftImageUri && !avatarDraft.imageUri)}
                style={({ pressed }) => [
                  styles.toolBtn,
                  isDark && styles.toolBtnDark,
                  (avatarSaving || (!avatarDraftImageUri && !avatarDraft.imageUri)) ? { opacity: 0.5 } : null,
                  pressed && !(avatarSaving || (!avatarDraftImageUri && !avatarDraft.imageUri)) ? { opacity: 0.92 } : null,
                ]}
                onPress={() => {
                  setAvatarDraftImageUri(null);
                  setAvatarDraftRemoveImage(true);
                  // Only change draft state; commit happens on Save.
                  setAvatarDraft((prev) => ({ ...prev, imagePath: undefined, imageUri: undefined }));
                }}
                accessibilityRole="button"
                accessibilityState={{ disabled: avatarSaving || (!avatarDraftImageUri && !avatarDraft.imageUri) }}
              >
                <Text style={[styles.toolBtnText, isDark && styles.toolBtnTextDark]}>Remove photo</Text>
              </Pressable>
            </View>

            <View style={[styles.modalButtons, { marginTop: 10 }]}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalButtonSmall,
                  isDark ? styles.modalButtonDark : null,
                  pressed ? { opacity: 0.92 } : null,
                ]}
                onPress={async () => {
                  if (!myUserSub) return;
                  avatarSavingRef.current = true;
                  setAvatarSaving(true);
                  setAvatarError(null);
                  try {
                    let nextImagePath = avatarDraft.imagePath;

                    if (avatarDraftImageUri) {
                      // Normalize to a square JPEG (256x256) after user crop.
                      const normalized = await ImageManipulator.manipulateAsync(
                        avatarDraftImageUri,
                        [{ resize: { width: 256, height: 256 } }],
                        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
                      );
                      const blob = await (await fetch(normalized.uri)).blob();
                      // Store avatars under uploads/global/* so both authenticated users and guests
                      // can resolve them via Amplify Storage permissions (and later behind CloudFront).
                      const path = `uploads/public/avatars/${myUserSub}/${Date.now()}.jpg`;
                      await uploadData({ path, data: blob, options: { contentType: 'image/jpeg' } }).result;
                      nextImagePath = path;
                      setAvatarDraftImageUri(null);
                      setAvatarDraftRemoveImage(false);
                    }

                    const next = {
                      bgColor: avatarDraft.bgColor,
                      textColor: avatarDraft.textColor || '#fff',
                      // IMPORTANT:
                      // - undefined => omit key => "no change" server-side
                      // - ''        => explicit clear (updateProfile.js removes avatarImagePath)
                      imagePath: avatarDraftRemoveImage ? '' : nextImagePath,
                    };

                    // Update local state first so UI feels instant.
                    setMyAvatar((prev) => ({ ...prev, ...next, imageUri: undefined }));
                    await saveAvatarToStorageAndServer(next);
                    setAvatarOpen(false);
                  } catch (e: any) {
                    setAvatarError(e?.message || 'Failed to save avatar.');
                  } finally {
                    avatarSavingRef.current = false;
                    setAvatarSaving(false);
                  }
                }}
                disabled={avatarSaving}
              >
                {avatarSaving ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                    <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>Saving</Text>
                    <AnimatedDots color={isDark ? '#fff' : '#111'} size={18} />
                  </View>
                ) : (
                  <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>Save</Text>
                )}
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalButtonSmall,
                  isDark ? styles.modalButtonDark : null,
                  pressed ? { opacity: 0.92 } : null,
                ]}
                onPress={() => {
                  if (avatarSavingRef.current) return;
                  // Discard draft changes unless saved.
                  setAvatarOpen(false);
                  setAvatarDraft(myAvatar);
                  setAvatarDraftImageUri(null);
                  setAvatarDraftRemoveImage(false);
                }}
                disabled={avatarSaving}
              >
                <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={backgroundOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (backgroundSavingRef.current) return;
          setBackgroundOpen(false);
          setBackgroundDraft(chatBackground);
          setBackgroundDraftImageUri(null);
          setBackgroundError(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            disabled={backgroundSaving}
            onPress={() => {
              if (backgroundSavingRef.current) return;
              setBackgroundOpen(false);
              setBackgroundDraft(chatBackground);
              setBackgroundDraftImageUri(null);
              setBackgroundError(null);
            }}
          />
          <View style={[styles.profileCard, isDark ? styles.profileCardDark : null]}>
            <View style={styles.chatsTopRow}>
              <Text style={[styles.modalTitle, isDark ? styles.modalTitleDark : null]}>Background</Text>
            </View>

            <View style={styles.profilePreviewRow}>
              <View style={styles.bgPreviewBox}>
                {(() => {
                  const effective =
                    backgroundDraftImageUri
                      ? ({ mode: 'image', uri: backgroundDraftImageUri } as const)
                      : backgroundDraft;
                  if (effective.mode === 'image') {
                    return (
                      <Image
                        source={{ uri: effective.uri }}
                        style={[styles.bgPreviewImage, { opacity: bgEffectOpacity }]}
                        resizeMode="cover"
                        blurRadius={bgEffectBlur}
                      />
                    );
                  }
                  if (effective.mode === 'color') {
                    return <View style={[StyleSheet.absoluteFill, { backgroundColor: effective.color }]} />;
                  }
                  return (
                    <View
                      style={[
                        StyleSheet.absoluteFill,
                        { backgroundColor: isDark ? '#0b0b0f' : '#ffffff' },
                      ]}
                    />
                  );
                })()}
              </View>
              <View style={styles.profilePreviewMeta}>
                <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null]}>
                  Choose a chat background
                </Text>
              </View>
            </View>

            {backgroundError ? (
              <Text style={[styles.errorText, isDark && styles.errorTextDark]}>{backgroundError}</Text>
            ) : null}

            {!backgroundDraftImageUri && backgroundDraft.mode !== 'image' ? (
              <>
                <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null, styles.profileSectionTitle]}>
                  Color
                </Text>
                <View style={styles.avatarPaletteRow}>
                  {[
                    '#ffffff',
                    '#f2f2f7',
                    '#e9e9ee',
                    '#111111',
                    '#0b0b0f',
                    ...AVATAR_DEFAULT_COLORS,
                  ].map((c) => {
                    const selected = backgroundDraft.mode === 'color' && backgroundDraft.color === c;
                    return (
                      <Pressable
                        key={`bgc:${c}`}
                        onPress={() => setBackgroundDraft({ mode: 'color', color: c })}
                        style={[
                          styles.avatarColorDot,
                          { backgroundColor: c },
                          selected ? (isDark ? styles.avatarColorDotSelectedDark : styles.avatarColorDotSelected) : null,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Select background color ${c}`}
                      />
                    );
                  })}
                </View>
              </>
            ) : (
              <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null, { marginTop: 6 }]}>
                Photo background enabled - remove the photo to use a solid color
              </Text>
            )}

            {(backgroundDraftImageUri || backgroundDraft.mode === 'image') ? (
              <>
                <View style={styles.bgEffectsHeaderRow}>
                  <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null, styles.profileSectionTitle]}>
                    Photo effects
                  </Text>
                  <Pressable
                    disabled={backgroundSaving}
                    style={({ pressed }) => [styles.bgEffectsResetBtn, pressed ? { opacity: 0.85 } : null]}
                    onPress={() => {
                      setBgEffectBlur(0);
                      setBgEffectOpacity(1);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Reset background effects"
                  >
                    <Text style={[styles.bgEffectsResetText, isDark ? styles.bgEffectsResetTextDark : null]}>Reset</Text>
                  </Pressable>
                </View>

                <View style={styles.bgSliderSection}>
                  <View style={styles.bgSliderLabelRow}>
                    <Text style={[styles.bgSliderLabel, isDark ? styles.bgSliderLabelDark : null]}>Blur</Text>
                    <Text style={[styles.bgSliderValue, isDark ? styles.bgSliderValueDark : null]}>{bgEffectBlur}</Text>
                  </View>
                  <Slider
                    style={styles.bgSlider}
                    minimumValue={0}
                    maximumValue={10}
                    step={1}
                    value={bgEffectBlur}
                    onValueChange={(v: number) => setBgEffectBlur(v)}
                    onSlidingComplete={(v: number) => setBgEffectBlur(Math.max(0, Math.min(10, Math.round(v))))}
                    minimumTrackTintColor={isDark ? '#fff' : '#111'}
                    maximumTrackTintColor={isDark ? '#2a2a33' : '#d6d6de'}
                    thumbTintColor={isDark ? '#fff' : '#111'}
                  />
                </View>

                <View style={styles.bgSliderSection}>
                  <View style={styles.bgSliderLabelRow}>
                    <Text style={[styles.bgSliderLabel, isDark ? styles.bgSliderLabelDark : null]}>Opacity</Text>
                    <Text style={[styles.bgSliderValue, isDark ? styles.bgSliderValueDark : null]}>
                      {`${Math.round(bgEffectOpacity * 100)}%`}
                    </Text>
                  </View>
                  <Slider
                    style={styles.bgSlider}
                    minimumValue={0.2}
                    maximumValue={1}
                    step={0.01}
                    value={bgEffectOpacity}
                    onValueChange={(v: number) => setBgEffectOpacity(Math.round(v * 100) / 100)}
                    onSlidingComplete={(v: number) =>
                      setBgEffectOpacity(Math.max(0.2, Math.min(1, Math.round(v * 100) / 100)))
                    }
                    minimumTrackTintColor={isDark ? '#fff' : '#111'}
                    maximumTrackTintColor={isDark ? '#2a2a33' : '#d6d6de'}
                    thumbTintColor={isDark ? '#fff' : '#111'}
                  />
                </View>
              </>
            ) : null}

            <View style={styles.profileActionsRow}>
              <Pressable
                disabled={backgroundSaving}
                style={({ pressed }) => [
                  styles.toolBtn,
                  isDark && styles.toolBtnDark,
                  backgroundSaving ? { opacity: 0.5 } : null,
                  pressed && !backgroundSaving ? { opacity: 0.92 } : null,
                ]}
                onPress={async () => {
                  try {
                    setBackgroundError(null);
                    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (!perm.granted) {
                      setBackgroundError('Please allow photo library access to choose a background.');
                      return;
                    }
                    const result = await ImagePicker.launchImageLibraryAsync({
                      mediaTypes: ['images'] as any,
                      allowsEditing: true,
                      aspect: [9, 16],
                      quality: 0.9,
                    });
                    if (result.canceled) return;
                    const uri = result.assets?.[0]?.uri;
                    if (!uri) return;
                    setBackgroundDraftImageUri(uri);
                    setBackgroundDraft({ mode: 'image', uri, blur: bgEffectBlur, opacity: bgEffectOpacity });
                  } catch (e: any) {
                    setBackgroundError(e?.message || 'Could not pick image.');
                  }
                }}
                accessibilityRole="button"
              >
                <Text style={[styles.toolBtnText, isDark && styles.toolBtnTextDark]}>Choose image</Text>
              </Pressable>

              <Pressable
                disabled={backgroundSaving || (!backgroundDraftImageUri && backgroundDraft.mode !== 'image')}
                style={({ pressed }) => [
                  styles.toolBtn,
                  isDark && styles.toolBtnDark,
                  (backgroundSaving || (!backgroundDraftImageUri && backgroundDraft.mode !== 'image')) ? { opacity: 0.5 } : null,
                  pressed && !(backgroundSaving || (!backgroundDraftImageUri && backgroundDraft.mode !== 'image')) ? { opacity: 0.92 } : null,
                ]}
                onPress={() => {
                  setBackgroundDraftImageUri(null);
                  setBackgroundDraft({ mode: 'default' });
                }}
                accessibilityRole="button"
              >
                <Text style={[styles.toolBtnText, isDark && styles.toolBtnTextDark]}>Remove image</Text>
              </Pressable>

              <Pressable
                disabled={backgroundSaving}
                style={({ pressed }) => [
                  styles.toolBtn,
                  isDark && styles.toolBtnDark,
                  backgroundSaving ? { opacity: 0.5 } : null,
                  pressed && !backgroundSaving ? { opacity: 0.92 } : null,
                ]}
                onPress={() => {
                  setBackgroundDraftImageUri(null);
                  setBackgroundDraft({ mode: 'default' });
                }}
                accessibilityRole="button"
              >
                <Text style={[styles.toolBtnText, isDark && styles.toolBtnTextDark]}>Default</Text>
              </Pressable>
            </View>

            <View style={[styles.modalButtons, { marginTop: 10 }]}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalButtonSmall,
                  isDark ? styles.modalButtonDark : null,
                  pressed ? { opacity: 0.92 } : null,
                ]}
                onPress={async () => {
                  backgroundSavingRef.current = true;
                  setBackgroundSaving(true);
                  setBackgroundError(null);
                  try {
                    let effective: ChatBackgroundState;
                    if (backgroundDraftImageUri) {
                      effective = { mode: 'image', uri: backgroundDraftImageUri, blur: bgEffectBlur, opacity: bgEffectOpacity };
                    } else if (backgroundDraft.mode === 'image') {
                      effective = {
                        ...backgroundDraft,
                        blur: bgEffectBlur,
                        opacity: bgEffectOpacity,
                      };
                    } else {
                      effective = backgroundDraft;
                    }
                    setChatBackground(effective);
                    await AsyncStorage.setItem('ui:chatBackground', JSON.stringify(effective));
                    setBackgroundOpen(false);
                  } catch (e: any) {
                    setBackgroundError(e?.message || 'Failed to save background.');
                  } finally {
                    backgroundSavingRef.current = false;
                    setBackgroundSaving(false);
                  }
                }}
                disabled={backgroundSaving}
              >
                {backgroundSaving ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                    <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>Saving</Text>
                    <AnimatedDots color={isDark ? '#fff' : '#111'} size={18} />
                  </View>
                ) : (
                  <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>Save</Text>
                )}
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalButtonSmall,
                  isDark ? styles.modalButtonDark : null,
                  pressed ? { opacity: 0.92 } : null,
                ]}
                onPress={() => {
                  if (backgroundSavingRef.current) return;
                  setBackgroundOpen(false);
                  setBackgroundDraft(chatBackground);
                  setBackgroundDraftImageUri(null);
                  setBackgroundError(null);
                }}
                disabled={backgroundSaving}
              >
                <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={recoveryOpen} transparent animationType="fade" onRequestClose={() => setRecoveryOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setRecoveryOpen(false)} />
          <View style={[styles.profileCard, isDark ? styles.profileCardDark : null]}>
            <View style={styles.chatsTopRow}>
              <Text style={[styles.modalTitle, isDark ? styles.modalTitleDark : null]}>Recovery</Text>
            </View>
            <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null]}>
              {recoveryLocked
                ? 'Recovery is locked on this device. Enter your passphrase to decrypt older messages, or reset recovery if you no longer remember it.'
                : !recoveryBlobKnown
                  ? 'Checking whether your account has a recovery backup...'
                  : hasRecoveryBlob
                  ? 'Your account has a recovery backup. You can change your recovery passphrase here.'
                  : 'Set up a recovery passphrase so you can restore encrypted messages if you switch devices'}
            </Text>

            <View style={styles.recoveryActionList}>
              {recoveryLocked ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.modalButton,
                    styles.modalButtonCta,
                    isDark ? styles.modalButtonCtaDark : null,
                    pressed && { opacity: 0.9 },
                  ]}
                  onPress={async () => {
                    setRecoveryOpen(false);
                    await enterRecoveryPassphrase();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Enter recovery passphrase"
                >
                  <Text style={[styles.modalButtonText, styles.modalButtonCtaText]}>Enter Passphrase</Text>
                </Pressable>
              ) : !recoveryBlobKnown ? null : !hasRecoveryBlob ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.modalButton,
                    styles.modalButtonCta,
                    isDark ? styles.modalButtonCtaDark : null,
                    pressed && { opacity: 0.9 },
                  ]}
                  onPress={async () => {
                    setRecoveryOpen(false);
                    await setupRecovery();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Set up recovery passphrase"
                >
                  <Text style={[styles.modalButtonText, styles.modalButtonCtaText]}>Set Up Recovery Passphrase</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={({ pressed }) => [
                    styles.modalButton,
                    isDark ? styles.modalButtonDark : null,
                    pressed && { opacity: 0.9 },
                  ]}
                  onPress={async () => {
                    setRecoveryOpen(false);
                    await changeRecoveryPassphrase();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Change recovery passphrase"
                >
                  <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>
                    Change Your Recovery Passphrase
                  </Text>
                </Pressable>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  isDark ? styles.modalButtonDark : null,
                  pressed && { opacity: 0.9 },
                ]}
                onPress={async () => {
                  setRecoveryOpen(false);
                  await resetRecovery();
                }}
                accessibilityRole="button"
                accessibilityLabel="Reset recovery"
              >
                <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>
                  Reset Recovery
                </Text>
              </Pressable>
            </View>

            <View style={[styles.modalButtons, { justifyContent: 'flex-end', marginTop: 10 }]}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalButtonSmall,
                  isDark ? styles.modalButtonDark : null,
                  pressed ? { opacity: 0.92 } : null,
                ]}
                onPress={() => setRecoveryOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close recovery"
              >
                <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={chatsOpen} transparent animationType="fade" onRequestClose={() => setChatsOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setChatsOpen(false)} />
          <View style={[styles.chatsCard, isDark ? styles.chatsCardDark : null]}>
            <View style={styles.chatsTopRow}>
              <Text style={[styles.modalTitle, isDark ? styles.modalTitleDark : null]}>Chats</Text>
            </View>
            <ScrollView style={styles.chatsScroll}>
              {chatsLoading ? (
                <View style={styles.chatsLoadingRow}>
                  <Text
                    style={[
                      styles.modalHelperText,
                      isDark ? styles.modalHelperTextDark : null,
                      styles.chatsLoadingText,
                    ]}
                  >
                    Loading
                  </Text>
                  <View style={styles.chatsLoadingDotsWrap}>
                    <AnimatedDots color={isDark ? '#ffffff' : '#111'} size={18} />
                  </View>
                </View>
              ) : chatsList.length ? (
                chatsList.map((t) => (
                  <Pressable
                    key={`chat:${t.conversationId}`}
                    style={({ pressed }) => [
                      styles.chatRow,
                      isDark ? styles.chatRowDark : null,
                      pressed ? { opacity: 0.9 } : null,
                    ]}
                    onPress={() => {
                      setChatsOpen(false);
                      goToConversation(t.conversationId);
                    }}
                  >
                    <View style={styles.chatRowLeft}>
                      <Text style={[styles.chatRowName, isDark ? styles.chatRowNameDark : null]} numberOfLines={1}>
                        {t.peer || 'Direct Message'}
                      </Text>
                    </View>
                    <View style={styles.chatRowRight}>
                        {t.lastActivityAt ? (
                          <Text
                            style={[styles.chatRowDate, isDark ? styles.chatRowDateDark : null]}
                            numberOfLines={1}
                            accessibilityLabel="Last message date"
                          >
                            {formatChatActivityDate(t.lastActivityAt)}
                          </Text>
                        ) : null}
                      {t.unreadCount > 0 ? (
                        <View style={[styles.unreadChip, isDark ? styles.unreadChipDark : null]}>
                          <Text style={[styles.unreadChipText, isDark ? styles.unreadChipTextDark : null]}>
                            {t.unreadCount}
                          </Text>
                        </View>
                      ) : null}
                      <Pressable
                        onPress={() => void deleteConversationFromList(t.conversationId)}
                        style={({ pressed }) => [
                          styles.chatDeleteBtn,
                          isDark ? styles.chatDeleteBtnDark : null,
                          pressed ? { opacity: 0.85 } : null,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Remove chat"
                      >
                        <Feather name="trash-2" size={16} color={isDark ? '#fff' : '#111'} />
                      </Pressable>
                    </View>
                  </Pressable>
                ))
              ) : (
                <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null]}>
                  No active chats
                </Text>
              )}
            </ScrollView>
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonSmall, isDark ? styles.modalButtonDark : null]}
                onPress={() => setChatsOpen(false)}
              >
                <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Settings → Channels: list joined channels (like Chats) */}
      <Modal visible={channelsOpen} transparent animationType="fade" onRequestClose={() => setChannelsOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setChannelsOpen(false)} />
          <View style={[styles.chatsCard, isDark ? styles.chatsCardDark : null]}>
            <View style={styles.chatsTopRow}>
              <Text style={[styles.modalTitle, isDark ? styles.modalTitleDark : null]}>Channels</Text>
            </View>

            {myChannelsError ? (
              <Text style={[styles.errorText, isDark ? styles.errorTextDark : null]}>{myChannelsError}</Text>
            ) : null}

            {createChannelOpen ? (
              <>
                <TextInput
                  value={createChannelName}
                  onChangeText={(v) => {
                    setCreateChannelName(v);
                    setCreateChannelError(null);
                  }}
                  placeholder="Channel name"
                  maxLength={21}
                  placeholderTextColor={isDark ? '#8f8fa3' : '#999'}
                  selectionColor={isDark ? '#ffffff' : '#111'}
                  cursorColor={isDark ? '#ffffff' : '#111'}
                  autoCapitalize="words"
                  autoCorrect={false}
                  style={[
                    styles.blocksInput,
                    isDark ? styles.blocksInputDark : null,
                    {
                      // `blocksInput` uses flex:1 for row layouts; override for column layout.
                      flex: 0,
                      alignSelf: 'stretch',
                      width: '100%',
                      height: 44,
                      fontSize: 16,
                      lineHeight: 20,
                      paddingVertical: 10,
                      textAlignVertical: 'center',
                      color: isDark ? '#fff' : '#111',
                    },
                  ]}
                />

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 10 }}>
                  <Pressable
                    onPress={() => setCreateChannelIsPublic(true)}
                    style={({ pressed }) => [
                      styles.modalButton,
                      styles.modalButtonSmall,
                      createChannelIsPublic ? styles.modalButtonCta : null,
                      isDark ? (createChannelIsPublic ? styles.modalButtonCtaDark : styles.modalButtonDark) : null,
                      // Dark-mode selector: make the active choice visibly different.
                      isDark && createChannelIsPublic ? { backgroundColor: '#3a3a46' } : null,
                      pressed ? { opacity: 0.9 } : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modalButtonText,
                        isDark ? styles.modalButtonTextDark : null,
                        isDark && !createChannelIsPublic ? { color: '#a7a7b4' } : null,
                        createChannelIsPublic ? styles.modalButtonCtaText : null,
                      ]}
                    >
                      Public
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setCreateChannelIsPublic(false);
                      setCreateChannelPassword('');
                    }}
                    style={({ pressed }) => [
                      styles.modalButton,
                      styles.modalButtonSmall,
                      !createChannelIsPublic ? styles.modalButtonCta : null,
                      isDark ? (!createChannelIsPublic ? styles.modalButtonCtaDark : styles.modalButtonDark) : null,
                      // Dark-mode selector: make the active choice visibly different.
                      isDark && !createChannelIsPublic ? { backgroundColor: '#3a3a46' } : null,
                      pressed ? { opacity: 0.9 } : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modalButtonText,
                        isDark ? styles.modalButtonTextDark : null,
                        isDark && createChannelIsPublic ? { color: '#a7a7b4' } : null,
                        !createChannelIsPublic ? styles.modalButtonCtaText : null,
                      ]}
                    >
                      Private
                    </Text>
                  </Pressable>
                </View>

                {createChannelIsPublic ? (
                  <TextInput
                    value={createChannelPassword}
                    onChangeText={(v) => {
                      setCreateChannelPassword(v);
                      setCreateChannelError(null);
                    }}
                    placeholder="Password (optional)"
                    placeholderTextColor={isDark ? '#8f8fa3' : '#999'}
                    selectionColor={isDark ? '#ffffff' : '#111'}
                    cursorColor={isDark ? '#ffffff' : '#111'}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[
                      styles.blocksInput,
                      isDark ? styles.blocksInputDark : null,
                      {
                        flex: 0,
                        alignSelf: 'stretch',
                        width: '100%',
                        height: 44,
                        fontSize: 16,
                        lineHeight: 20,
                        paddingVertical: 10,
                        textAlignVertical: 'center',
                        color: isDark ? '#fff' : '#111',
                      },
                    ]}
                  />
                ) : null}

                {createChannelError ? (
                  <Text style={[styles.errorText, isDark ? styles.errorTextDark : null]}>{createChannelError}</Text>
                ) : null}

                <View style={[styles.modalButtons, { justifyContent: 'flex-end', marginTop: 12 }]}>
                  <Pressable
                    style={[
                      styles.modalButton,
                      styles.modalButtonSmall,
                      styles.modalButtonCta,
                      isDark ? styles.modalButtonCtaDark : null,
                      createChannelLoading ? { opacity: 0.7 } : null,
                    ]}
                    onPress={() => void submitCreateChannelInline()}
                  >
                    <Text style={[styles.modalButtonText, styles.modalButtonCtaText]}>
                      {createChannelLoading ? 'Creating…' : 'Create'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modalButton, styles.modalButtonSmall, isDark ? styles.modalButtonDark : null]}
                    onPress={() => {
                      setCreateChannelOpen(false);
                      setCreateChannelError(null);
                      setCreateChannelLoading(false);
                      setCreateChannelName('');
                      setCreateChannelPassword('');
                      setCreateChannelIsPublic(true);
                    }}
                  >
                    <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>Cancel</Text>
                  </Pressable>
                </View>
              </>
            ) : null}

            <ScrollView style={styles.chatsScroll}>
              <Pressable
                key="mychannel:global"
                style={({ pressed }) => [
                  styles.chatRow,
                  isDark ? styles.chatRowDark : null,
                  pressed ? { opacity: 0.9 } : null,
                ]}
                onPress={() => enterChannelConversation('global')}
              >
                <View style={styles.chatRowLeft}>
                  <Text style={[styles.chatRowName, isDark ? styles.chatRowNameDark : null]} numberOfLines={1}>
                    Global
                  </Text>
                </View>
                <View style={styles.chatRowRight}>
                  <View style={[styles.defaultChip, isDark ? styles.defaultChipDark : null]}>
                    <Text style={[styles.defaultChipText, isDark ? styles.defaultChipTextDark : null]}>Default</Text>
                  </View>
                </View>
              </Pressable>

              {myChannelsLoading ? (
                <View style={styles.chatsLoadingRow}>
                  <Text
                    style={[
                      styles.modalHelperText,
                      isDark ? styles.modalHelperTextDark : null,
                      styles.chatsLoadingText,
                    ]}
                  >
                    Loading
                  </Text>
                  <View style={styles.chatsLoadingDotsWrap}>
                    <AnimatedDots color={isDark ? '#ffffff' : '#111'} size={18} />
                  </View>
                </View>
              ) : myChannels.length ? (
                myChannels.map((c) => (
                  <Pressable
                    key={`mychannel:${c.channelId}`}
                    style={({ pressed }) => [
                      styles.chatRow,
                      isDark ? styles.chatRowDark : null,
                      pressed ? { opacity: 0.9 } : null,
                    ]}
                    onPress={() => {
                      setChannelsOpen(false);
                      enterChannelConversation(`ch#${c.channelId}`);
                    }}
                  >
                    <View style={styles.chatRowLeft}>
                      <Text style={[styles.chatRowName, isDark ? styles.chatRowNameDark : null]} numberOfLines={1}>
                        {c.name}
                      </Text>
                    </View>
                    <View style={styles.chatRowRight}>
                      <Pressable
                        onPress={() => void leaveChannelFromSettings(c.channelId)}
                        style={({ pressed }) => [
                          styles.leaveChip,
                          isDark ? styles.leaveChipDark : null,
                          pressed ? { opacity: 0.9 } : null,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Leave channel"
                      >
                        <Text style={[styles.leaveChipText, isDark ? styles.leaveChipTextDark : null]}>Leave</Text>
                      </Pressable>
                    </View>
                  </Pressable>
                ))
              ) : (
                <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null]}>
                  No joined channels
                </Text>
              )}
            </ScrollView>

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonSmall, isDark ? styles.modalButtonDark : null]}
                onPress={() => {
                  setCreateChannelError(null);
                  setCreateChannelLoading(false);
                  setCreateChannelIsPublic(true);
                  setCreateChannelPassword('');
                  setCreateChannelName('');
                  setCreateChannelOpen((v) => !v);
                }}
              >
                <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>
                  {createChannelOpen ? 'Hide Create' : 'Create'}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonSmall, isDark ? styles.modalButtonDark : null]}
                onPress={() => setChannelsOpen(false)}
              >
                <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Header channel pill: search/join channels (like Start DM) */}
      <Modal visible={channelSearchOpen} transparent animationType="fade" onRequestClose={() => setChannelSearchOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setChannelSearchOpen(false)} />
          <View style={[styles.chatsCard, isDark ? styles.chatsCardDark : null]}>
            <View style={styles.chatsTopRow}>
              <Text style={[styles.modalTitle, isDark ? styles.modalTitleDark : null]}>Find Channels</Text>
            </View>

            <View style={styles.blocksSearchRow}>
              <TextInput
                value={channelsQuery}
                onChangeText={(v) => {
                  setChannelsQuery(v);
                  setChannelsError(null);
                  setChannelJoinError(null);
                }}
                placeholder="Search Channels"
                placeholderTextColor={isDark ? '#8f8fa3' : '#999'}
                selectionColor={isDark ? '#ffffff' : '#111'}
                cursorColor={isDark ? '#ffffff' : '#111'}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.blocksInput, isDark ? styles.blocksInputDark : null]}
              />
              <Pressable
                onPress={() => void fetchChannelsSearch(channelsQuery)}
                style={({ pressed }) => [
                  styles.blocksBtn,
                  isDark ? styles.blocksBtnDark : null,
                  pressed ? { opacity: 0.9 } : null,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Search Channels"
              >
                <Text style={[styles.blocksBtnText, isDark ? styles.blocksBtnTextDark : null]}>Search</Text>
              </Pressable>
            </View>

            {channelsError ? (
              <Text style={[styles.errorText, isDark ? styles.errorTextDark : null]}>{channelsError}</Text>
            ) : null}
            {channelJoinError ? (
              <Text style={[styles.errorText, isDark ? styles.errorTextDark : null]}>{channelJoinError}</Text>
            ) : null}

            <ScrollView style={styles.chatsScroll}>
              {/* Only show Global as a suggestion when not actively searching */}
              {!String(channelsQuery || '').trim() ? (
                <Pressable
                  key="searchchannel:global"
                  style={({ pressed }) => [
                    styles.chatRow,
                    isDark ? styles.chatRowDark : null,
                    pressed ? { opacity: 0.9 } : null,
                  ]}
                  onPress={() => enterChannelConversation('global')}
                >
                  <View style={styles.chatRowLeft}>
                    <Text style={[styles.chatRowName, isDark ? styles.chatRowNameDark : null]} numberOfLines={1}>
                      Global
                    </Text>
                  </View>
                  <View style={[styles.chatRowRight, { marginLeft: 10 }]}>
                    <View style={[styles.memberChip, isDark ? styles.memberChipDark : null]}>
                      <Text style={[styles.memberChipText, isDark ? styles.memberChipTextDark : null]}>
                        {typeof globalUserCount === 'number' ? String(globalUserCount) : '—'}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ) : null}

              {channelsLoading ? (
                <View style={styles.chatsLoadingRow}>
                  <Text
                    style={[
                      styles.modalHelperText,
                      isDark ? styles.modalHelperTextDark : null,
                      styles.chatsLoadingText,
                    ]}
                  >
                    Loading
                  </Text>
                  <View style={styles.chatsLoadingDotsWrap}>
                    <AnimatedDots color={isDark ? '#ffffff' : '#111'} size={18} />
                  </View>
                </View>
              ) : channelsResults.length ? (
                channelsResults.map((c) => (
                  <Pressable
                    key={`searchchannel:${c.channelId}`}
                    style={({ pressed }) => [
                      styles.chatRow,
                      isDark ? styles.chatRowDark : null,
                      pressed ? { opacity: 0.9 } : null,
                    ]}
                    onPress={() => void joinChannel(c)}
                  >
                    <View style={styles.chatRowLeft}>
                      <Text style={[styles.chatRowName, isDark ? styles.chatRowNameDark : null]} numberOfLines={1}>
                        {c.name}
                      </Text>
                      {c.hasPassword ? (
                        <View style={{ marginLeft: 8 }}>
                          <Feather name="lock" size={14} color={isDark ? '#a7a7b4' : '#666'} />
                        </View>
                      ) : null}
                    </View>
                    <View style={[styles.chatRowRight, { marginLeft: 10 }]}>
                      <View style={[styles.memberChip, isDark ? styles.memberChipDark : null]}>
                        <Text style={[styles.memberChipText, isDark ? styles.memberChipTextDark : null]}>
                          {String(typeof c.activeMemberCount === 'number' ? c.activeMemberCount : 0)}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                ))
              ) : (
                <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null]}>
                  No channels found
                </Text>
              )}
            </ScrollView>

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonSmall, isDark ? styles.modalButtonDark : null]}
                onPress={() => setChannelSearchOpen(false)}
              >
                <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!channelPasswordPrompt}
        transparent
        animationType="fade"
        onRequestClose={() => setChannelPasswordPrompt(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setChannelPasswordPrompt(null)} />
          <View style={[styles.profileCard, isDark ? styles.profileCardDark : null]}>
            <View style={styles.chatsTopRow}>
              <Text style={[styles.modalTitle, isDark ? styles.modalTitleDark : null]}>
                Join {channelPasswordPrompt?.name || 'Channel'}
              </Text>
            </View>
            <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null, { marginBottom: 8 }]}>
              Enter Channel Password
            </Text>
            <TextInput
              value={channelPasswordInput}
              onChangeText={(v) => {
                setChannelPasswordInput(v);
                setChannelJoinError(null);
              }}
              placeholder="Channel Password"
              placeholderTextColor={isDark ? '#8f8fa3' : '#999'}
              selectionColor={isDark ? '#ffffff' : '#111'}
              cursorColor={isDark ? '#ffffff' : '#111'}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => void submitChannelPassword()}
              style={[
                styles.blocksInput,
                isDark ? styles.blocksInputDark : null,
                // `blocksInput` is used in row layouts and has flex: 1; override for standalone column input.
                { flex: 0, alignSelf: 'stretch', marginBottom: 12 },
              ]}
            />
            {channelJoinError ? (
              <Text style={[styles.errorText, isDark ? styles.errorTextDark : null]}>{channelJoinError}</Text>
            ) : null}
            <View style={[styles.modalButtons, { marginTop: 2 }]}>
              <Pressable
                // Keep Join consistent with other modal actions (no heavy "blackened" CTA for this prompt).
                style={[styles.modalButton, styles.modalButtonSmall, isDark ? styles.modalButtonDark : null]}
                onPress={() => void submitChannelPassword()}
              >
                <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>Join</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonSmall, isDark ? styles.modalButtonDark : null, { marginLeft: 8 }]}
                onPress={() => {
                  setChannelPasswordPrompt(null);
                  setChannelPasswordInput('');
                  setChannelJoinError(null);
                }}
              >
                <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={blocklistOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setBlocklistOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setBlocklistOpen(false)} />
          <View style={[styles.blocksCard, isDark ? styles.blocksCardDark : null]}>
            <View style={styles.blocksTopRow}>
              <Text style={[styles.modalTitle, isDark ? styles.modalTitleDark : null]}>Blocklist</Text>
            </View>

            <View style={styles.blocksSearchRow}>
              <TextInput
                value={blockUsername}
                onChangeText={(v) => {
                  setBlockUsername(v);
                  setBlockError(null);
                }}
                placeholder="Username to block"
                placeholderTextColor={isDark ? '#8f8fa3' : '#999'}
                selectionColor={isDark ? '#ffffff' : '#111'}
                cursorColor={isDark ? '#ffffff' : '#111'}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.blocksInput, isDark ? styles.blocksInputDark : null]}
              />
              <Pressable
                onPress={() => void addBlockByUsername()}
                style={({ pressed }) => [
                  styles.blocksBtn,
                  isDark ? styles.blocksBtnDark : null,
                  pressed ? { opacity: 0.9 } : null,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Block user"
              >
                <Text style={[styles.blocksBtnText, isDark ? styles.blocksBtnTextDark : null]}>Block</Text>
              </Pressable>
            </View>

            {blockError ? (
              <Text style={[styles.errorText, isDark ? styles.errorTextDark : null]}>{blockError}</Text>
            ) : null}

            <ScrollView style={styles.blocksScroll}>
              {blocklistLoading ? (
                <View style={styles.chatsLoadingRow}>
                  <Text
                    style={[
                      styles.modalHelperText,
                      isDark ? styles.modalHelperTextDark : null,
                      styles.chatsLoadingText,
                    ]}
                  >
                    Loading
                  </Text>
                  <View style={styles.chatsLoadingDotsWrap}>
                    <AnimatedDots color={isDark ? '#ffffff' : '#111'} size={18} />
                  </View>
                </View>
              ) : blockedUsers.length ? (
                blockedUsers
                  .slice()
                  .sort((a, b) => String(a.blockedDisplayName || a.blockedUsernameLower || '').localeCompare(String(b.blockedDisplayName || b.blockedUsernameLower || '')))
                  .map((b) => (
                    <View key={`blocked:${b.blockedSub}`} style={[styles.blockRow, isDark ? styles.blockRowDark : null]}>
                      <Text style={[styles.blockRowName, isDark ? styles.blockRowNameDark : null]} numberOfLines={1}>
                        {b.blockedDisplayName || b.blockedUsernameLower || b.blockedSub}
                      </Text>
                      <Pressable
                        onPress={() => void unblockUser(b.blockedSub, b.blockedDisplayName || b.blockedUsernameLower)}
                        style={({ pressed }) => [
                          styles.blockActionBtn,
                          isDark ? styles.blockActionBtnDark : null,
                          pressed ? { opacity: 0.85 } : null,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Unblock user"
                      >
                        <Feather name="user-check" size={16} color={isDark ? '#fff' : '#111'} />
                      </Pressable>
                    </View>
                  ))
              ) : (
                <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null]}>
                  No blocked users
                </Text>
              )}
            </ScrollView>
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonSmall, isDark ? styles.modalButtonDark : null]}
                onPress={() => setBlocklistOpen(false)}
              >
                <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
        <Modal visible={promptVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            {Platform.OS === 'web' ? (
              // Web: keep password inputs inside a <form> to satisfy browser heuristics.
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handlePromptSubmit();
                }}
                // Center the modal content within the overlay.
                style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
              >
                <View style={[styles.modalContent, isDark ? styles.modalContentDark : null]}>
                  <Text style={[styles.modalTitle, isDark ? styles.modalTitleDark : null]}>{promptLabel}</Text>
                  {passphrasePrompt?.mode === 'setup' ? (
                    <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null]}>
                      Make sure you remember your passphrase for future device recovery - we do not
                      store it.
                    </Text>
                  ) : passphrasePrompt?.mode === 'change' ? (
                    <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null]}>
                      Choose a new passphrase you’ll remember - we do not store it
                    </Text>
                  ) : passphrasePrompt?.mode === 'reset' ? (
                    <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null]}>
                      Set a new recovery passphrase for your account - we do not store it
                    </Text>
                  ) : null}
                  <View style={styles.passphraseFieldWrapper}>
                    <TextInput
                      style={[
                        styles.modalInput,
                        styles.passphraseInput,
                        isDark ? styles.modalInputDark : styles.modalInputLight,
                        processing ? styles.modalInputDisabled : null,
                        isDark && processing ? styles.modalInputDisabledDark : null,
                      ]}
                      secureTextEntry={!passphraseVisible}
                      value={passphraseInput}
                      onChangeText={(t) => {
                        setPassphraseInput(t);
                        if (passphraseError) setPassphraseError(null);
                      }}
                      placeholder="Passphrase"
                      placeholderTextColor={isDark ? '#8f8fa3' : '#999'}
                      selectionColor={isDark ? '#ffffff' : '#111'}
                      cursorColor={isDark ? '#ffffff' : '#111'}
                      autoFocus
                      editable={!processing}
                    />
                    <Pressable
                      style={[styles.passphraseEyeBtn, processing && { opacity: 0.5 }]}
                      onPress={() => setPassphraseVisible((v) => !v)}
                      disabled={processing}
                      accessibilityRole="button"
                      accessibilityLabel={passphraseVisible ? 'Hide passphrase' : 'Show passphrase'}
                    >
                      <Image
                        source={passphraseVisible ? icons.visibilityOn : icons.visibilityOff}
                        tintColor={isDark ? '#8f8fa3' : '#777'}
                        style={{
                          width: 18,
                          height: 18,
                        }}
                      />
                    </Pressable>
                  </View>

                  {passphrasePrompt?.mode === 'setup' ||
                  passphrasePrompt?.mode === 'change' ||
                  passphrasePrompt?.mode === 'reset' ? (
                    <View style={styles.passphraseFieldWrapper}>
                      <TextInput
                        style={[
                          styles.modalInput,
                          styles.passphraseInput,
                          isDark ? styles.modalInputDark : styles.modalInputLight,
                          processing ? styles.modalInputDisabled : null,
                          isDark && processing ? styles.modalInputDisabledDark : null,
                        ]}
                        secureTextEntry={!passphraseVisible}
                        value={passphraseConfirmInput}
                        onChangeText={(t) => {
                          setPassphraseConfirmInput(t);
                          if (passphraseError) setPassphraseError(null);
                        }}
                        placeholder="Confirm Passphrase"
                        placeholderTextColor={isDark ? '#8f8fa3' : '#999'}
                        selectionColor={isDark ? '#ffffff' : '#111'}
                        cursorColor={isDark ? '#ffffff' : '#111'}
                        editable={!processing}
                      />
                      <Pressable
                        style={[styles.passphraseEyeBtn, processing && { opacity: 0.5 }]}
                        onPress={() => setPassphraseVisible((v) => !v)}
                        disabled={processing}
                        accessibilityRole="button"
                        accessibilityLabel={passphraseVisible ? 'Hide passphrase' : 'Show passphrase'}
                      >
                        <Image
                          source={passphraseVisible ? icons.visibilityOn : icons.visibilityOff}
                          tintColor={isDark ? '#8f8fa3' : '#777'}
                          style={{
                            width: 18,
                            height: 18,
                          }}
                        />
                      </Pressable>
                    </View>
                  ) : null}

                  {passphraseError ? (
                    <Text style={[styles.passphraseErrorText, isDark ? styles.passphraseErrorTextDark : null]}>
                      {passphraseError}
                    </Text>
                  ) : null}
                  <View style={styles.modalButtons}>
                    {/*
                      Disable submit until user enters a passphrase (avoid accidental empty submits).
                      Also avoids showing "Incorrect passphrase" alerts due to empty input.
                    */}
                    <Pressable
                      style={[
                        styles.modalButton,
                        styles.modalButtonCta,
                        isDark ? styles.modalButtonCtaDark : null,
                        (processing ||
                          !passphraseInput.trim() ||
                          ((passphrasePrompt?.mode === 'setup' ||
                            passphrasePrompt?.mode === 'change' ||
                            passphrasePrompt?.mode === 'reset') &&
                            !passphraseConfirmInput.trim())) && { opacity: 0.45 },
                      ]}
                      onPress={handlePromptSubmit}
                      disabled={
                        processing ||
                        !passphraseInput.trim() ||
                        ((passphrasePrompt?.mode === 'setup' ||
                          passphrasePrompt?.mode === 'change' ||
                          passphrasePrompt?.mode === 'reset') &&
                          !passphraseConfirmInput.trim())
                      }
                      >
                        {processing ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                            <Text style={[styles.modalButtonText, styles.modalButtonCtaText]}>
                              {passphrasePrompt?.mode === 'restore'
                                ? 'Decrypting'
                                : passphrasePrompt?.mode === 'change'
                                  ? 'Updating backup'
                                  : passphrasePrompt?.mode === 'reset'
                                    ? 'Resetting recovery'
                                    : 'Encrypting backup'}
                            </Text>
                            <AnimatedDots color="#fff" size={18} />
                          </View>
                        ) : (
                          <Text style={[styles.modalButtonText, styles.modalButtonCtaText]}>
                            Submit
                          </Text>
                        )}
                    </Pressable>
                    <Pressable
                      style={[styles.modalButton, isDark ? styles.modalButtonDark : null, processing && { opacity: 0.45 }]}
                      onPress={() => void handlePromptCancel()}
                      disabled={processing}
                    >
                      <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>
                        Cancel
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </form>
            ) : (
              <View style={[styles.modalContent, isDark ? styles.modalContentDark : null]}>
                <Text style={[styles.modalTitle, isDark ? styles.modalTitleDark : null]}>{promptLabel}</Text>
                {passphrasePrompt?.mode === 'setup' ? (
                  <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null]}>
                    Make sure you remember your passphrase for future device recovery - we do not
                    store it.
                  </Text>
                ) : passphrasePrompt?.mode === 'change' ? (
                  <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null]}>
                    Choose a new passphrase you’ll remember - we do not store it
                  </Text>
                ) : passphrasePrompt?.mode === 'reset' ? (
                  <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null]}>
                    Set a new recovery passphrase for your account - we do not store it
                  </Text>
                ) : null}
                <View style={styles.passphraseFieldWrapper}>
                  <TextInput
                    style={[
                      styles.modalInput,
                      styles.passphraseInput,
                      isDark ? styles.modalInputDark : styles.modalInputLight,
                      processing ? styles.modalInputDisabled : null,
                      isDark && processing ? styles.modalInputDisabledDark : null,
                    ]}
                    secureTextEntry={!passphraseVisible}
                    value={passphraseInput}
                    onChangeText={(t) => {
                      setPassphraseInput(t);
                      if (passphraseError) setPassphraseError(null);
                    }}
                    placeholder="Passphrase"
                    placeholderTextColor={isDark ? '#8f8fa3' : '#999'}
                    selectionColor={isDark ? '#ffffff' : '#111'}
                    cursorColor={isDark ? '#ffffff' : '#111'}
                    autoFocus
                    editable={!processing}
                  />
                  <Pressable
                    style={[styles.passphraseEyeBtn, processing && { opacity: 0.5 }]}
                    onPress={() => setPassphraseVisible((v) => !v)}
                    disabled={processing}
                    accessibilityRole="button"
                    accessibilityLabel={passphraseVisible ? 'Hide passphrase' : 'Show passphrase'}
                  >
                    <Image
                      source={passphraseVisible ? icons.visibilityOn : icons.visibilityOff}
                      tintColor={isDark ? '#8f8fa3' : '#777'}
                      style={{
                        width: 18,
                        height: 18,
                      }}
                    />
                  </Pressable>
                </View>
                {passphrasePrompt?.mode === 'setup' ||
                passphrasePrompt?.mode === 'change' ||
                passphrasePrompt?.mode === 'reset' ? (
                  <View style={styles.passphraseFieldWrapper}>
                    <TextInput
                      style={[
                        styles.modalInput,
                        styles.passphraseInput,
                        isDark ? styles.modalInputDark : styles.modalInputLight,
                        processing ? styles.modalInputDisabled : null,
                        isDark && processing ? styles.modalInputDisabledDark : null,
                      ]}
                      secureTextEntry={!passphraseVisible}
                      value={passphraseConfirmInput}
                      onChangeText={(t) => {
                        setPassphraseConfirmInput(t);
                        if (passphraseError) setPassphraseError(null);
                      }}
                      placeholder="Confirm Passphrase"
                      placeholderTextColor={isDark ? '#8f8fa3' : '#999'}
                      selectionColor={isDark ? '#ffffff' : '#111'}
                      cursorColor={isDark ? '#ffffff' : '#111'}
                      editable={!processing}
                    />
                    <Pressable
                      style={[styles.passphraseEyeBtn, processing && { opacity: 0.5 }]}
                      onPress={() => setPassphraseVisible((v) => !v)}
                      disabled={processing}
                      accessibilityRole="button"
                      accessibilityLabel={passphraseVisible ? 'Hide passphrase' : 'Show passphrase'}
                    >
                      <Image
                        source={passphraseVisible ? icons.visibilityOn : icons.visibilityOff}
                        tintColor={isDark ? '#8f8fa3' : '#777'}
                        style={{
                          width: 18,
                          height: 18,
                        }}
                      />
                    </Pressable>
                  </View>
                ) : null}
                {passphraseError ? (
                  <Text style={[styles.passphraseErrorText, isDark ? styles.passphraseErrorTextDark : null]}>
                    {passphraseError}
                  </Text>
                ) : null}
                <View style={styles.modalButtons}>
                  <Pressable
                    style={[
                      styles.modalButton,
                      styles.modalButtonCta,
                      isDark ? styles.modalButtonCtaDark : null,
                      (processing ||
                        !passphraseInput.trim() ||
                        ((passphrasePrompt?.mode === 'setup' ||
                          passphrasePrompt?.mode === 'change' ||
                          passphrasePrompt?.mode === 'reset') &&
                          !passphraseConfirmInput.trim())) && { opacity: 0.45 },
                    ]}
                    onPress={handlePromptSubmit}
                    disabled={
                      processing ||
                      !passphraseInput.trim() ||
                      ((passphrasePrompt?.mode === 'setup' ||
                        passphrasePrompt?.mode === 'change' ||
                        passphrasePrompt?.mode === 'reset') &&
                        !passphraseConfirmInput.trim())
                    }
                  >
                    {processing ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                        <Text style={[styles.modalButtonText, styles.modalButtonCtaText]}>
                          {passphrasePrompt?.mode === 'restore'
                            ? 'Decrypting'
                            : passphrasePrompt?.mode === 'change'
                              ? 'Updating backup'
                              : passphrasePrompt?.mode === 'reset'
                                ? 'Resetting recovery'
                                : 'Encrypting backup'}
                        </Text>
                        <AnimatedDots color="#fff" size={18} />
                      </View>
                    ) : (
                      <Text style={[styles.modalButtonText, styles.modalButtonCtaText]}>Submit</Text>
                    )}
                  </Pressable>
                  <Pressable
                    style={[styles.modalButton, isDark ? styles.modalButtonDark : null, processing && { opacity: 0.45 }]}
                    onPress={() => void handlePromptCancel()}
                    disabled={processing}
                  >
                    <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </Modal>
      <View style={{ flex: 1 }}>
        {channelRestoreDone ? (
          <ChatScreen
            conversationId={conversationId}
            peer={peer}
            displayName={displayName}
            onNewDmNotification={handleNewDmNotification}
            onKickedFromConversation={(convId) => {
              if (!convId) return;
              if (conversationId !== convId) return;
              setConversationId('global');
              setPeer(null);
            }}
            onConversationTitleChanged={handleConversationTitleChanged}
            channelAboutRequestEpoch={channelAboutRequestEpoch}
            headerTop={headerTop}
            theme={theme}
            chatBackground={chatBackground}
            blockedUserSubs={blockedSubs}
            keyEpoch={keyEpoch}
            onBlockUserSub={addBlockBySub}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#0b0b0f' : '#fff' }}>
            <ActivityIndicator size="large" color={isDark ? '#fff' : '#111'} />
          </View>
        )}
      </View>
    </View>
  );
};

export default function App(): React.JSX.Element {
  const [booting, setBooting] = React.useState<boolean>(true);
  const [rootMode, setRootMode] = React.useState<'guest' | 'app'>('guest');
  const [authModalOpen, setAuthModalOpen] = React.useState<boolean>(false);
  const [rootLayoutDone, setRootLayoutDone] = React.useState<boolean>(false);
  const { theme: uiTheme, setTheme: setUiTheme, isDark, ready: themeReady } = useStoredTheme({
    storageKey: 'ui:theme',
    defaultTheme: 'light',
    // Re-read theme when opening the auth modal in case the user toggled it on the guest screen.
    reloadDeps: [authModalOpen ? 1 : 0],
  });
  const appReady = !booting && themeReady;

  // Keep the app portrait by default, but allow camera UI to temporarily unlock orientation.
  React.useEffect(() => {
    (async () => {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      } catch {
        // ignore
      }
    })();
  }, []);

  // (Removed) We previously tried setting global TextInput defaultProps for caret color,
  // but on Android it can be ignored/overridden. We now inject caret colors directly into
  // Amplify Authenticator fields via `components` overrides.

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const sess = await fetchAuthSession().catch(() => ({ tokens: undefined }));
        const hasToken = !!sess?.tokens?.idToken?.toString();
        if (mounted) setRootMode(hasToken ? 'app' : 'guest');
      } finally {
        if (mounted) setBooting(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Keep Android system nav bar in sync with our theme (fixes "light bar" in dark mode).
  React.useEffect(() => {
    if (Platform.OS !== 'android') return;
    const bg = isDark ? '#0b0b0f' : '#ffffff';
    const buttons = isDark ? 'light' : 'dark';
    (async () => {
      try {
        // Avoid hard dependency on `expo-navigation-bar` (dev clients / emulators can be out of sync).
        // Using an optional native module prevents a hard crash when `ExpoNavigationBar` isn't installed.
        const ExpoNavigationBar = requireOptionalNativeModule('ExpoNavigationBar') as any;
        if (!ExpoNavigationBar?.setBackgroundColorAsync || !ExpoNavigationBar?.setButtonStyleAsync) return;
        const bgNumber = processColor(bg);
        if (typeof bgNumber === 'number') {
          await ExpoNavigationBar.setBackgroundColorAsync(bgNumber);
        }
        await ExpoNavigationBar.setButtonStyleAsync(buttons);
      } catch {
        // ignore
      }
    })();
  }, [isDark]);

  // Keep the mobile browser UI bar (theme-color) in sync with in-app theme on web.
  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      const head = document.head || document.getElementsByTagName('head')[0];
      let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        head.appendChild(meta);
      }
      meta.content = isDark ? '#0b0b0f' : '#ffffff';

      // Hint to the UA about supported color schemes (helps form controls, scrollbars, etc).
      document.documentElement.style.colorScheme = 'dark light';
    } catch {
      // ignore
    }
  }, [isDark]);

  // Hide the native splash once we’re ready and the root view has laid out.
  React.useEffect(() => {
    if (!appReady || !rootLayoutDone) return;
    (async () => {
      try {
        await SplashScreen.hideAsync();
      } catch {
        // ignore
      }
    })();
  }, [appReady, rootLayoutDone]);

  // theme persistence handled by useStoredTheme

  const { amplifyTheme, authComponents } = useAmplifyAuthenticatorConfig(isDark);

  return (
    <AppSafeAreaProvider>
      {/* Apply TOP safe-area globally. Screens manage left/right/bottom insets themselves (chat input / CTAs). */}
      <SafeAreaView
        style={[styles.container, styles.appSafe, isDark && styles.appSafeDark]}
        edges={['top']}
        onLayout={() => setRootLayoutDone(true)}
      >
        <UiPromptProvider isDark={isDark}>
        <Authenticator.Provider>
          {booting ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator />
            </View>
          ) : rootMode === 'guest' ? (
            <>
              <GuestGlobalScreen onSignIn={() => setAuthModalOpen(true)} />

              <AuthModal
                open={authModalOpen}
                onClose={() => setAuthModalOpen(false)}
                isDark={isDark}
                amplifyTheme={amplifyTheme}
                authComponents={authComponents}
                onAuthed={() => {
                  setAuthModalOpen(false);
                  setRootMode('app');
                }}
              />
            </>
          ) : (
            <ThemeProvider theme={amplifyTheme} colorMode={isDark ? 'dark' : 'light'}>
              <Authenticator
                loginMechanisms={['email']}
                signUpAttributes={['preferred_username']}
                components={authComponents}
              >
                <MainAppContent onSignedOut={() => setRootMode('guest')} />
              </Authenticator>
            </ThemeProvider>
          )}
        </Authenticator.Provider>
        </UiPromptProvider>

        <StatusBar
          style={isDark ? 'light' : 'dark'}
          backgroundColor={isDark ? '#0b0b0f' : '#ffffff'}
        />
      </SafeAreaView>
    </AppSafeAreaProvider>
  );
}
