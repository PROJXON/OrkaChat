import { setAudioModeAsync } from 'expo-audio';

/**
 * Centralized audio-mode presets used by chat playback + voice recording.
 *
 * Keeping these in one place avoids drift between playback and recording flows.
 */
export const CHAT_PLAYBACK_AUDIO_MODE = {
  playsInSilentMode: true,
  shouldPlayInBackground: true,
  interruptionMode: 'duckOthers',
  allowsRecording: false,
  shouldRouteThroughEarpiece: false,
} as const;

export const CHAT_RECORDING_AUDIO_MODE = {
  playsInSilentMode: true,
  shouldPlayInBackground: false,
  interruptionMode: 'duckOthers',
  allowsRecording: true,
  shouldRouteThroughEarpiece: false,
} as const;

export async function setChatPlaybackAudioModeAsync(): Promise<void> {
  await setAudioModeAsync(CHAT_PLAYBACK_AUDIO_MODE).catch(() => {});
}

export async function setChatRecordingAudioModeAsync(): Promise<void> {
  await setAudioModeAsync(CHAT_RECORDING_AUDIO_MODE).catch(() => {});
}
