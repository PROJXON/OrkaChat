import AsyncStorage from '@react-native-async-storage/async-storage';

export type ChannelAboutSeenScope = 'member' | 'guest';

export function getChannelAboutSeenKey(scope: ChannelAboutSeenScope, channelId: string): string {
  const cid = String(channelId || '').trim();
  const prefix = scope === 'guest' ? 'ui:guestChannelAboutSeen:' : 'ui:channelAboutSeen:';
  return `${prefix}${cid}`;
}

export async function getChannelAboutSeenVersion(scope: ChannelAboutSeenScope, channelId: string): Promise<number> {
  const cid = String(channelId || '').trim();
  if (!cid) return 0;
  try {
    const raw = await AsyncStorage.getItem(getChannelAboutSeenKey(scope, cid));
    const n = typeof raw === 'string' && raw.trim() ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export async function markChannelAboutSeen(scope: ChannelAboutSeenScope, channelId: string, aboutVersion: number): Promise<void> {
  const cid = String(channelId || '').trim();
  const v = typeof aboutVersion === 'number' && Number.isFinite(aboutVersion) ? aboutVersion : 0;
  if (!cid || !v) return;
  try {
    await AsyncStorage.setItem(getChannelAboutSeenKey(scope, cid), String(v));
  } catch {
    // ignore
  }
}

