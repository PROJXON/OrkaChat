import { fetchAuthSession } from '@aws-amplify/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { API_URL } from '../config/env';
import { PALETTE } from '../theme/colors';

type ExpoNotificationsModule = typeof import('expo-notifications');
type ExpoDeviceModule = typeof import('expo-device');

const STORAGE_DEVICE_ID = 'push:deviceId';
const STORAGE_EXPO_TOKEN = 'push:expoToken';
const STORAGE_PUSH_LAST_STATUS = 'push:lastStatus';

async function tryImportNotifications(): Promise<ExpoNotificationsModule | null> {
  try {
    return require('expo-notifications');
  } catch {
    return null;
  }
}

async function tryImportDevice(): Promise<ExpoDeviceModule | null> {
  try {
    return require('expo-device');
  } catch {
    return null;
  }
}

async function getOrCreateDeviceId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(STORAGE_DEVICE_ID);
    if (existing && existing.length >= 8) return existing;
  } catch {
    // ignore
  }

  let id = '';
  try {
    const CryptoMod = require('expo-crypto');
    const Crypto = CryptoMod?.default || CryptoMod;
    if (Crypto?.randomUUID) id = String(Crypto.randomUUID());
  } catch {
    // ignore
  }

  if (!id) id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    await AsyncStorage.setItem(STORAGE_DEVICE_ID, id);
  } catch {
    // ignore
  }
  return id;
}

async function setStoredExpoToken(token: string): Promise<void> {
  try {
    if (token) await AsyncStorage.setItem(STORAGE_EXPO_TOKEN, token);
    else await AsyncStorage.removeItem(STORAGE_EXPO_TOKEN);
  } catch {
    // ignore
  }
}

async function getStoredExpoToken(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(STORAGE_EXPO_TOKEN)) || '';
  } catch {
    return '';
  }
}

export async function getPushDebugStatus(): Promise<{
  deviceId: string;
  storedExpoToken: string;
  lastStatus: string;
  apiUrl: string;
}> {
  const [deviceId, storedExpoToken, lastStatus] = await Promise.all([
    getOrCreateDeviceId(),
    getStoredExpoToken(),
    AsyncStorage.getItem(STORAGE_PUSH_LAST_STATUS).catch(() => ''),
  ]);
  return {
    deviceId,
    storedExpoToken,
    lastStatus: String(lastStatus || ''),
    apiUrl: String(API_URL || ''),
  };
}

async function setPushLastStatus(status: string): Promise<void> {
  try {
    const s = String(status || '');
    if (s) await AsyncStorage.setItem(STORAGE_PUSH_LAST_STATUS, s);
    else await AsyncStorage.removeItem(STORAGE_PUSH_LAST_STATUS);
  } catch {
    // ignore
  }
}

async function getIdTokenWithRetry(opts?: {
  maxAttempts?: number;
  delayMs?: number;
}): Promise<string | null> {
  const maxAttempts = Math.max(1, Math.min(20, Number(opts?.maxAttempts ?? 8)));
  const delayMs = Math.max(0, Math.min(5_000, Number(opts?.delayMs ?? 250)));
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const idToken = (await fetchAuthSession()).tokens?.idToken?.toString();
      if (idToken && idToken.trim()) return idToken.trim();
    } catch {
      // ignore and retry
    }
    if (i < maxAttempts - 1 && delayMs > 0) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return null;
}

export async function ensureDmNotificationChannel(): Promise<void> {
  const Notifications = await tryImportNotifications();
  if (!Notifications) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('dm', {
      name: 'Direct messages',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: PALETTE.brandBlue,
    });
  }
}

export async function ensureChannelsNotificationChannel(): Promise<void> {
  const Notifications = await tryImportNotifications();
  if (!Notifications) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('channels', {
      name: 'Channels',
      // Default to HIGH for mentions/replies; users can mute the channel in OS settings.
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250],
      lightColor: PALETTE.brandBlue,
    });
  }
}

export async function registerForDmPushNotifications(): Promise<{
  ok: boolean;
  reason?: string;
  expoPushToken?: string;
}> {
  if (!API_URL) {
    await setPushLastStatus(`[${new Date().toISOString()}] register: fail Missing API_URL`);
    return { ok: false, reason: 'Missing API_URL' };
  }

  const Notifications = await tryImportNotifications();
  if (!Notifications)
    return { ok: false, reason: 'expo-notifications not installed (rebuild dev client)' };

  const Device = await tryImportDevice();
  // Expo push token generation can still work without expo-device, but we use it to skip simulators.
  if (Device && Device.isDevice === false) {
    await setPushLastStatus(`[${new Date().toISOString()}] register: skip not a physical device`);
    return { ok: false, reason: 'Push tokens require a physical device' };
  }

  await ensureDmNotificationChannel();
  await ensureChannelsNotificationChannel();

  const perm = await Notifications.getPermissionsAsync();
  let status = perm.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') {
    await setPushLastStatus(`[${new Date().toISOString()}] register: fail permission not granted`);
    return { ok: false, reason: 'Notification permission not granted' };
  }

  // Note: in modern Expo, providing projectId is recommended for dev-client/EAS builds,
  // but this app doesn't currently track it explicitly in app.json. We'll best-effort detect it.
  let expoPushToken = '';
  try {
    let projectId: string | undefined;
    try {
      const ConstantsMod = require('expo-constants');
      const Constants = ConstantsMod?.default || ConstantsMod;
      projectId =
        Constants?.easConfig?.projectId ||
        Constants?.expoConfig?.extra?.eas?.projectId ||
        Constants?.expoConfig?.extra?.projectId;
    } catch {
      // ignore
    }

    const tok = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    expoPushToken = tok?.data ? String(tok.data) : '';
  } catch (err) {
    await setPushLastStatus(
      `[${new Date().toISOString()}] register: fail getExpoPushToken: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return {
      ok: false,
      reason: `Failed to get Expo push token: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!expoPushToken) {
    await setPushLastStatus(`[${new Date().toISOString()}] register: fail empty Expo push token`);
    return { ok: false, reason: 'Empty Expo push token' };
  }

  const idToken = await getIdTokenWithRetry({ maxAttempts: 10, delayMs: 250 });
  if (!idToken) {
    await setPushLastStatus(`[${new Date().toISOString()}] register: fail Missing auth token`);
    return { ok: false, reason: 'Missing auth token' };
  }

  const deviceId = await getOrCreateDeviceId();

  const resp = await fetch(`${API_URL.replace(/\/$/, '')}/push/token`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      expoPushToken,
      platform: Platform.OS,
      deviceId,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    await setPushLastStatus(
      `[${new Date().toISOString()}] register: fail backend ${resp.status}: ${text || 'unknown'}`,
    );
    return {
      ok: false,
      reason: `Backend register push token failed (${resp.status}): ${text || 'unknown'}`,
    };
  }

  await setStoredExpoToken(expoPushToken);
  await setPushLastStatus(`[${new Date().toISOString()}] register: ok`);
  return { ok: true, expoPushToken };
}

export async function unregisterDmPushNotifications(): Promise<void> {
  if (!API_URL) return;
  const token = await getStoredExpoToken();
  const deviceId = await getOrCreateDeviceId();
  if (!token && !deviceId) return;

  const idToken = (await fetchAuthSession()).tokens?.idToken?.toString();
  if (!idToken) return;

  await fetch(`${API_URL.replace(/\/$/, '')}/push/token/delete`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      expoPushToken: token || undefined,
      deviceId: deviceId || undefined,
    }),
  }).catch(() => undefined);

  await setStoredExpoToken('');
}

export async function setForegroundNotificationPolicy(): Promise<void> {
  const Notifications = await tryImportNotifications();
  if (!Notifications) return;

  // In-app chat already shows incoming messages; keep notifications quiet while foregrounded.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: false,
      // Newer expo-notifications NotificationBehavior requires these fields.
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}
