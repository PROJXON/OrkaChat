import { MaterialIcons } from '@expo/vector-icons';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import React from 'react';
import { AppState, Pressable, View } from 'react-native';

import type { ChatScreenStyles } from '../../../screens/ChatScreen.styles';
import { APP_COLORS, PALETTE } from '../../../theme/colors';
import type { PendingMediaItem } from '../attachments';

const PRESS_START_DELAY_MS = 200;
const MIN_DURATION_MS = 400;
const MAX_DURATION_MS = 3 * 60 * 1000;

export const VoiceClipMicButton = React.memo(function VoiceClipMicButton({
  styles,
  isDark,
  disabled,
  showAlert,
  stopAudioPlayback,
  onClipReady,
  onRecordingUiState,
}: {
  styles: ChatScreenStyles;
  isDark: boolean;
  disabled: boolean;
  showAlert: (title: string, message: string) => void;
  stopAudioPlayback: () => void | Promise<void>;
  onClipReady: (clip: PendingMediaItem) => void;
  onRecordingUiState?: (v: { isRecording: boolean; elapsedMs: number }) => void;
}): React.JSX.Element {
  // IMPORTANT:
  // `LOW_QUALITY` often records AMR in a 3GP container on Android, which many browsers can't decode.
  // Use a browser-friendly AAC-in-MP4/M4A style preset so voice clips are playable on web too.
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const [isRecording, setIsRecording] = React.useState(false);
  const [elapsedMs, setElapsedMs] = React.useState(0);

  const pressingRef = React.useRef(false);
  const startedAtRef = React.useRef<number | null>(null);
  const startDelayRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const maxRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppingRef = React.useRef(false);
  const isRecordingRef = React.useRef(false);
  isRecordingRef.current = isRecording;

  React.useEffect(() => {
    if (!onRecordingUiState) return;
    onRecordingUiState({ isRecording, elapsedMs });
  }, [elapsedMs, isRecording, onRecordingUiState]);

  const clearTimers = React.useCallback(() => {
    if (startDelayRef.current) {
      clearTimeout(startDelayRef.current);
      startDelayRef.current = null;
    }
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (maxRef.current) {
      clearTimeout(maxRef.current);
      maxRef.current = null;
    }
  }, []);

  const restoreNonRecordingAudioMode = React.useCallback(async () => {
    // Match `useChatAudioPlayback` defaults so playback resumes normally.
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'duckOthers',
      allowsRecording: false,
      shouldRouteThroughEarpiece: false,
    }).catch(() => {});
  }, []);

  const setRecordingAudioMode = React.useCallback(async () => {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'duckOthers',
      allowsRecording: true,
      shouldRouteThroughEarpiece: false,
    }).catch(() => {});
  }, []);

  const stopAndAttach = React.useCallback(async () => {
    if (!isRecordingRef.current) return;
    if (stoppingRef.current) return;
    stoppingRef.current = true;

    clearTimers();

    let uri = '';
    try {
      await recorder.stop();
      uri =
        typeof (recorder as any)?.getUri === 'function'
          ? String((recorder as any).getUri() || '')
          : String((recorder as any)?.uri || '');
    } catch {
      // ignore
    }

    const startedAt = startedAtRef.current;
    const durationMs = startedAt ? Math.max(0, Date.now() - startedAt) : 0;
    startedAtRef.current = null;

    setIsRecording(false);
    setElapsedMs(0);

    await restoreNonRecordingAudioMode();

    stoppingRef.current = false;

    if (!(durationMs >= MIN_DURATION_MS)) return;
    if (!uri) {
      showAlert('Recording failed', 'Could not save your voice clip.');
      return;
    }

    const extMatch = uri.match(/\.([a-z0-9]{1,6})(?:\?|$)/i);
    const ext = (extMatch?.[1] || 'm4a').toLowerCase();
    const contentType =
      ext === '3gp' || ext === '3gpp'
        ? 'audio/3gpp'
        : ext === 'mp4' || ext === 'm4a' || ext === 'aac'
          ? 'audio/mp4'
          : 'audio/mp4';
    const fileName = `Voice Clip.${ext}`;
    onClipReady({
      uri,
      kind: 'file',
      contentType,
      fileName,
      displayName: 'Voice clip',
      durationMs,
      source: 'file',
    });
  }, [clearTimers, onClipReady, recorder, restoreNonRecordingAudioMode, showAlert]);

  const startRecording = React.useCallback(async () => {
    if (disabled) return;
    if (!pressingRef.current) return;
    if (isRecordingRef.current || stoppingRef.current) return;

    try {
      // Stop any currently playing inline audio to avoid overlap/feedback.
      await Promise.resolve(stopAudioPlayback());
    } catch {
      // ignore
    }

    const perm = await (AudioModule as any)?.requestRecordingPermissionsAsync?.();
    const granted = !!perm?.granted;
    if (!granted) {
      showAlert('Microphone required', 'Please enable microphone access to record a voice clip.');
      return;
    }
    // Permission prompts can cancel the press; require the user to still be holding.
    if (!pressingRef.current) return;

    await setRecordingAudioMode();
    if (!pressingRef.current) {
      await restoreNonRecordingAudioMode();
      return;
    }

    try {
      await recorder.prepareToRecordAsync();
      if (!pressingRef.current) {
        await restoreNonRecordingAudioMode();
        return;
      }
      recorder.record();
    } catch {
      await restoreNonRecordingAudioMode();
      showAlert('Recording failed', 'Could not start recording.');
      return;
    }

    const startedAt = Date.now();
    startedAtRef.current = startedAt;
    setIsRecording(true);
    setElapsedMs(0);

    tickRef.current = setInterval(() => {
      const s = startedAtRef.current;
      if (!s) return;
      setElapsedMs(Math.max(0, Date.now() - s));
    }, 200);

    maxRef.current = setTimeout(() => {
      void stopAndAttach();
    }, MAX_DURATION_MS);
  }, [
    disabled,
    recorder,
    restoreNonRecordingAudioMode,
    setRecordingAudioMode,
    showAlert,
    stopAndAttach,
    stopAudioPlayback,
  ]);

  const onPressIn = React.useCallback(() => {
    if (disabled) return;
    pressingRef.current = true;
    if (startDelayRef.current) clearTimeout(startDelayRef.current);
    startDelayRef.current = setTimeout(() => {
      void startRecording();
    }, PRESS_START_DELAY_MS);
  }, [disabled, startRecording]);

  const onPressOut = React.useCallback(() => {
    pressingRef.current = false;
    if (startDelayRef.current) {
      clearTimeout(startDelayRef.current);
      startDelayRef.current = null;
    }
    if (isRecordingRef.current) void stopAndAttach();
  }, [stopAndAttach]);

  // Stop and attach on background/lock/interruption.
  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active' && isRecordingRef.current) void stopAndAttach();
    });
    return () => {
      try {
        sub.remove();
      } catch {
        // ignore
      }
    };
  }, [stopAndAttach]);

  // Cleanup on unmount (best-effort: attach what we have).
  React.useEffect(() => {
    return () => {
      clearTimers();
      if (isRecordingRef.current) void stopAndAttach();
    };
  }, [clearTimers, stopAndAttach]);

  const iconColor = isRecording
    ? PALETTE.dangerRed
    : isDark
      ? APP_COLORS.dark.text.primary
      : APP_COLORS.light.text.primary;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.sendBtn,
        isDark ? styles.sendBtnDark : null,
        disabled ? (isDark ? styles.btnDisabledDark : styles.btnDisabled) : null,
        // Make the mic button slightly tighter than "Send".
        { paddingHorizontal: 10 },
        pressed && !disabled ? { opacity: 0.9 } : null,
      ]}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={10}
      // Keep recording even if the finger drifts off the button slightly.
      pressRetentionOffset={{ top: 200, bottom: 200, left: 200, right: 200 }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={isRecording ? 'Recording voice clip' : 'Hold to record voice clip'}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <MaterialIcons name="keyboard-voice" size={22} color={iconColor} />
        {/* Timer is rendered on the attach (+) button so it isn't obscured by the finger. */}
      </View>
    </Pressable>
  );
});
