import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, View } from 'react-native';

import type { ChatScreenStyles } from '../../../screens/ChatScreen.styles';
import { APP_COLORS, PALETTE } from '../../../theme/colors';
import type { PendingMediaItem } from '../attachments';

const PRESS_START_DELAY_MS = 200;
const MIN_DURATION_MS = 400;
const MAX_DURATION_MS = 3 * 60 * 1000;

function pickBestMimeType(): string | null {
  const MR: any = (globalThis as any)?.MediaRecorder;
  if (!MR) return null;
  const isSupported = (t: string) =>
    typeof MR.isTypeSupported === 'function' ? !!MR.isTypeSupported(t) : true;
  // Safari/iOS Safari typically requires audio/mp4.
  const candidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
  for (const t of candidates) if (isSupported(t)) return t;
  return null;
}

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
  const [isRecording, setIsRecording] = React.useState(false);
  const [elapsedMs, setElapsedMs] = React.useState(0);

  const pressingRef = React.useRef(false);
  const startedAtRef = React.useRef<number | null>(null);
  const startDelayRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const maxRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppingRef = React.useRef(false);

  const recorderRef = React.useRef<any>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<BlobPart[]>([]);
  const mimeTypeRef = React.useRef<string>('audio/webm');

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

  const stopTracks = React.useCallback(() => {
    const s = streamRef.current;
    streamRef.current = null;
    if (!s) return;
    try {
      for (const t of s.getTracks()) {
        try {
          t.stop();
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const stopAndAttach = React.useCallback(async () => {
    if (!recorderRef.current) return;
    if (stoppingRef.current) return;
    stoppingRef.current = true;

    clearTimers();

    const rec = recorderRef.current;
    recorderRef.current = null;

    const startedAt = startedAtRef.current;
    const durationMs = startedAt ? Math.max(0, Date.now() - startedAt) : 0;
    startedAtRef.current = null;

    const mimeType = mimeTypeRef.current || 'audio/webm';

    const url = await new Promise<string>((resolve) => {
      const finish = () => {
        try {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          chunksRef.current = [];
          resolve(URL.createObjectURL(blob));
        } catch {
          chunksRef.current = [];
          resolve('');
        }
      };

      try {
        rec.onstop = () => finish();
        // If already inactive, finish immediately.
        if (rec.state === 'inactive') finish();
        else rec.stop();
      } catch {
        finish();
      }
    });

    stopTracks();
    setIsRecording(false);
    setElapsedMs(0);
    stoppingRef.current = false;

    if (!(durationMs >= MIN_DURATION_MS)) return;
    if (!url) {
      showAlert('Recording failed', 'Could not save your voice clip.');
      return;
    }

    const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('webm') ? 'webm' : 'audio';
    const fileName = `Voice Clip.${ext}`;

    onClipReady({
      uri: url,
      kind: 'file',
      contentType: mimeType,
      fileName,
      displayName: 'Voice clip',
      durationMs,
      source: 'file',
    });
  }, [clearTimers, onClipReady, showAlert, stopTracks]);

  const startRecording = React.useCallback(async () => {
    if (disabled) return;
    if (!pressingRef.current) return;
    if (recorderRef.current || stoppingRef.current) return;

    try {
      await Promise.resolve(stopAudioPlayback());
    } catch {
      // ignore
    }

    const md = (navigator as any)?.mediaDevices;
    if (!md || typeof md.getUserMedia !== 'function') {
      showAlert('Microphone not supported', 'This browser does not support audio recording.');
      return;
    }

    const mimeType = pickBestMimeType();
    if (!mimeType) {
      showAlert('Microphone not supported', 'This browser does not support audio recording.');
      return;
    }
    mimeTypeRef.current = mimeType;

    let stream: MediaStream;
    try {
      stream = await md.getUserMedia({ audio: true });
    } catch {
      showAlert('Microphone required', 'Please enable microphone access to record a voice clip.');
      return;
    }
    // Permission prompts can cancel the press; require the user to still be holding.
    if (!pressingRef.current) {
      try {
        for (const t of stream.getTracks()) t.stop();
      } catch {
        // ignore
      }
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];

    // Stop + attach if the mic disconnects mid-record.
    try {
      for (const t of stream.getAudioTracks()) {
        t.addEventListener('ended', () => {
          void stopAndAttach();
        });
      }
    } catch {
      // ignore
    }

    let rec: any;
    try {
      rec = new (globalThis as any).MediaRecorder(stream, {
        mimeType,
        // Best-effort target around 48kbps voice.
        audioBitsPerSecond: 48_000,
      });
    } catch {
      stopTracks();
      showAlert('Recording failed', 'Could not start recording.');
      return;
    }

    recorderRef.current = rec;
    rec.ondataavailable = (e: any) => {
      if (e?.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    try {
      rec.start(250);
    } catch {
      recorderRef.current = null;
      stopTracks();
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
  }, [disabled, showAlert, stopAndAttach, stopAudioPlayback, stopTracks]);

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
    if (recorderRef.current) void stopAndAttach();
  }, [stopAndAttach]);

  // Stop + attach on focus loss / navigation / app background (web equivalents).
  React.useEffect(() => {
    const onVis = () => {
      if ((document as any)?.visibilityState !== 'visible' && recorderRef.current) {
        void stopAndAttach();
      }
    };
    const onHide = () => {
      if (recorderRef.current) void stopAndAttach();
    };
    try {
      document.addEventListener('visibilitychange', onVis);
      (globalThis as any).addEventListener?.('pagehide', onHide);
      (globalThis as any).addEventListener?.('blur', onHide);
    } catch {
      // ignore
    }
    return () => {
      try {
        document.removeEventListener('visibilitychange', onVis);
        (globalThis as any).removeEventListener?.('pagehide', onHide);
        (globalThis as any).removeEventListener?.('blur', onHide);
      } catch {
        // ignore
      }
    };
  }, [stopAndAttach]);

  // Cleanup on unmount.
  React.useEffect(() => {
    return () => {
      clearTimers();
      stopTracks();
      recorderRef.current = null;
      chunksRef.current = [];
    };
  }, [clearTimers, stopTracks]);

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
        { paddingHorizontal: 10 },
        pressed && !disabled ? { opacity: 0.9 } : null,
      ]}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={10}
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
