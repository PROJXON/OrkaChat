import React from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { AnimatedDots } from '../../../components/AnimatedDots';
import { AppTextInput } from '../../../components/AppTextInput';
import {
  calcCenteredModalBottomPadding,
  useKeyboardOverlap,
} from '../../../hooks/useKeyboardOverlap';
import type { ChatScreenStyles } from '../../../screens/ChatScreen.styles';
import { APP_COLORS } from '../../../theme/colors';

export type AiHelperTurn = {
  role: 'user' | 'assistant';
  text: string;
  thinking?: boolean;
  suggestions?: string[];
};

type Props = {
  visible: boolean;
  isDark: boolean;
  styles: ChatScreenStyles;

  thread: AiHelperTurn[];
  instruction: string;
  loading: boolean;
  mode: 'ask' | 'reply';

  onChangeInstruction: (t: string) => void;
  onChangeMode: (m: 'ask' | 'reply') => void;
  onSubmit: () => void;
  onResetThread: () => void;
  onClose: () => void;
  onCopySuggestion: (s: string) => void;
  onUseSuggestion: (s: string) => void;

  scrollRef: React.MutableRefObject<ScrollView | null>;
  scrollContentRef: React.MutableRefObject<View | null>;
  lastTurnRef: React.MutableRefObject<View | null>;
  scrollViewportHRef: React.MutableRefObject<number>;
  scrollContentHRef: React.MutableRefObject<number>;
  lastAutoScrollAtRef: React.MutableRefObject<number>;
  lastAutoScrollContentHRef: React.MutableRefObject<number>;
  autoScrollRetryRef: React.MutableRefObject<{
    timer: ReturnType<typeof setTimeout> | null;
    attempts: number;
  }>;
  autoScrollIntentRef: React.MutableRefObject<null | 'thinking' | 'answer'>;
  autoScroll: () => void;
};

export function AiHelperModal({
  visible,
  isDark,
  styles,
  thread,
  instruction,
  loading,
  mode,
  onChangeInstruction,
  onChangeMode,
  onSubmit,
  onResetThread,
  onClose,
  onCopySuggestion,
  onUseSuggestion,
  scrollRef,
  scrollContentRef,
  lastTurnRef,
  scrollViewportHRef,
  scrollContentHRef,
  lastAutoScrollAtRef,
  lastAutoScrollContentHRef,
  autoScrollRetryRef,
  autoScrollIntentRef,
  autoScroll,
}: Props) {
  const kb = useKeyboardOverlap({ enabled: visible });
  const [sheetHeight, setSheetHeight] = React.useState<number>(0);
  const bottomPad = React.useMemo(
    () =>
      calcCenteredModalBottomPadding(
        {
          keyboardVisible: kb.keyboardVisible,
          remainingOverlap: kb.remainingOverlap,
          windowHeight: kb.windowHeight,
        },
        sheetHeight,
        12,
      ),
    [kb.keyboardVisible, kb.remainingOverlap, kb.windowHeight, sheetHeight],
  );
  const hasAnyOutput = thread.length > 0;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View
        style={[
          styles.modalOverlay,
          Platform.OS !== 'web' && bottomPad > 0 ? { paddingBottom: bottomPad } : null,
        ]}
      >
        <View
          style={[
            styles.summaryModal,
            isDark ? styles.summaryModalDark : null,
            Platform.OS !== 'web' && kb.keyboardVisible
              ? { maxHeight: kb.availableHeightAboveKeyboard, minHeight: 0 }
              : null,
          ]}
          onLayout={(e) => {
            const h = e?.nativeEvent?.layout?.height;
            if (typeof h === 'number' && Number.isFinite(h) && h > 0) setSheetHeight(h);
          }}
        >
          <Text style={[styles.summaryTitle, isDark ? styles.summaryTitleDark : null]}>
            AI Helper
          </Text>

          {hasAnyOutput ? (
            <ScrollView
              ref={scrollRef}
              style={styles.summaryScroll}
              onLayout={(e) => {
                scrollViewportHRef.current = e.nativeEvent.layout.height;
                setTimeout(() => autoScroll(), 0);
              }}
              onContentSizeChange={(_w, h) => {
                scrollContentHRef.current = h;
                // RN-web can adjust content height after a programmatic scroll due to font/layout ticks.
                // If we just auto-scrolled, keep the intent alive briefly so we "follow" the newest AI output.
                const lastAt = lastAutoScrollAtRef.current || 0;
                const lastH = lastAutoScrollContentHRef.current || 0;
                if (!autoScrollIntentRef.current && thread.length) {
                  const ageMs = Date.now() - lastAt;
                  if (ageMs >= 0 && ageMs < 700 && Math.abs(h - lastH) > 2) {
                    autoScrollRetryRef.current.attempts = 0;
                    autoScrollIntentRef.current = 'answer';
                  }
                }
                setTimeout(() => autoScroll(), 0);
              }}
            >
              <View ref={scrollContentRef} collapsable={false}>
                {thread.length ? (
                  <View style={styles.helperBlock}>
                    <Text
                      style={[styles.helperSectionTitle, isDark ? styles.summaryTitleDark : null]}
                    >
                      Conversation
                    </Text>
                    <View style={{ gap: 8 }}>
                      {(() => {
                        // IMPORTANT: we want to measure/scroll to the latest *assistant* bubble,
                        // not necessarily the last thread element (which can be a user turn).
                        let lastAssistantIdx = -1;
                        for (let i = thread.length - 1; i >= 0; i--) {
                          if (thread[i]?.role === 'assistant') {
                            lastAssistantIdx = i;
                            break;
                          }
                        }
                        return thread.map((t, idx) => (
                          <View
                            key={`turn:${idx}`}
                            collapsable={false}
                            ref={(r) => {
                              if (idx === lastAssistantIdx) lastTurnRef.current = r;
                            }}
                            onLayout={(_e) => {
                              if (idx !== lastAssistantIdx) return;
                              // Ensure we re-run scroll logic after the newest assistant bubble lays out.
                              setTimeout(() => autoScroll(), 0);
                            }}
                          >
                            <View
                              style={[
                                styles.helperTurnBubble,
                                t.role === 'user'
                                  ? styles.helperTurnBubbleUser
                                  : styles.helperTurnBubbleAssistant,
                                isDark ? styles.helperTurnBubbleDark : null,
                                isDark && t.role === 'user'
                                  ? styles.helperTurnBubbleUserDark
                                  : null,
                                isDark && t.role === 'assistant'
                                  ? styles.helperTurnBubbleAssistantDark
                                  : null,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.helperTurnLabel,
                                  isDark ? styles.summaryTextDark : null,
                                ]}
                              >
                                {t.role === 'user' ? 'You' : 'AI'}
                              </Text>
                              {t.thinking ? (
                                <View
                                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                                >
                                  <Text
                                    style={[
                                      styles.summaryText,
                                      isDark ? styles.summaryTextDark : null,
                                    ]}
                                  >
                                    Thinking
                                  </Text>
                                  <AnimatedDots
                                    color={
                                      isDark
                                        ? APP_COLORS.dark.text.body
                                        : APP_COLORS.light.text.secondary
                                    }
                                    size={18}
                                  />
                                </View>
                              ) : (
                                <>
                                  {t.text ? (
                                    <Text
                                      style={[
                                        styles.summaryText,
                                        isDark ? styles.summaryTextDark : null,
                                      ]}
                                    >
                                      {t.text}
                                    </Text>
                                  ) : null}

                                  {t.role === 'assistant' && t.suggestions?.length ? (
                                    <View style={{ marginTop: t.text ? 10 : 0 }}>
                                      <Text
                                        style={[
                                          styles.helperSectionTitle,
                                          isDark ? styles.summaryTitleDark : null,
                                          { marginBottom: 8 },
                                        ]}
                                      >
                                        Reply options
                                      </Text>
                                      <View style={{ gap: 10 }}>
                                        {t.suggestions.map((s, sIdx) => (
                                          <View
                                            key={`turn:${idx}:sugg:${sIdx}`}
                                            style={[
                                              styles.helperSuggestionBubble,
                                              isDark ? styles.helperSuggestionBubbleDark : null,
                                            ]}
                                          >
                                            <Text
                                              style={[
                                                styles.helperSuggestionText,
                                                isDark ? styles.summaryTextDark : null,
                                              ]}
                                            >
                                              {s}
                                            </Text>
                                            <View style={styles.helperSuggestionActions}>
                                              <Pressable
                                                style={[
                                                  styles.toolBtn,
                                                  isDark ? styles.toolBtnDark : null,
                                                ]}
                                                onPress={() => onCopySuggestion(s)}
                                              >
                                                <Text
                                                  style={[
                                                    styles.toolBtnText,
                                                    isDark ? styles.toolBtnTextDark : null,
                                                  ]}
                                                >
                                                  Copy
                                                </Text>
                                              </Pressable>
                                              <Pressable
                                                style={[
                                                  styles.toolBtn,
                                                  isDark ? styles.toolBtnDark : null,
                                                ]}
                                                onPress={() => onUseSuggestion(s)}
                                              >
                                                <Text
                                                  style={[
                                                    styles.toolBtnText,
                                                    isDark ? styles.toolBtnTextDark : null,
                                                  ]}
                                                >
                                                  Use
                                                </Text>
                                              </Pressable>
                                            </View>
                                          </View>
                                        ))}
                                      </View>
                                    </View>
                                  ) : null}
                                </>
                              )}
                            </View>
                          </View>
                        ));
                      })()}
                    </View>
                  </View>
                ) : null}
              </View>
            </ScrollView>
          ) : null}

          <AppTextInput
            isDark={isDark}
            value={instruction}
            onChangeText={onChangeInstruction}
            placeholder={
              hasAnyOutput ? 'Ask a follow-up…' : 'How do you want to respond to this message?'
            }
            style={[
              styles.helperInput,
              isDark ? styles.helperInputDark : null,
              hasAnyOutput ? styles.helperInputFollowUp : null,
            ]}
            editable={!loading}
            multiline
          />

          <View style={styles.helperModeRow}>
            <View style={[styles.helperModeSegment, isDark ? styles.helperModeSegmentDark : null]}>
              <Pressable
                style={[
                  styles.helperModeBtn,
                  mode === 'ask' ? styles.helperModeBtnActive : null,
                  mode === 'ask' && isDark ? styles.helperModeBtnActiveDark : null,
                ]}
                onPress={() => onChangeMode('ask')}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.helperModeBtnText,
                    isDark ? styles.helperModeBtnTextDark : null,
                    mode === 'ask' ? styles.helperModeBtnTextActive : null,
                    mode === 'ask' && isDark ? styles.helperModeBtnTextActiveDark : null,
                  ]}
                >
                  Ask
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.helperModeBtn,
                  mode === 'reply' ? styles.helperModeBtnActive : null,
                  mode === 'reply' && isDark ? styles.helperModeBtnActiveDark : null,
                ]}
                onPress={() => onChangeMode('reply')}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.helperModeBtnText,
                    isDark ? styles.helperModeBtnTextDark : null,
                    mode === 'reply' ? styles.helperModeBtnTextActive : null,
                    mode === 'reply' && isDark ? styles.helperModeBtnTextActiveDark : null,
                  ]}
                >
                  Draft replies
                </Text>
              </Pressable>
            </View>

            <Text style={[styles.helperHint, isDark ? styles.helperHintDark : null]}>
              {mode === 'reply'
                ? 'Draft short, sendable replies based on the chat'
                : 'Ask a question about the chat, or anything!'}
            </Text>
          </View>

          <View style={styles.summaryButtons}>
            <Pressable
              style={[
                styles.toolBtn,
                isDark ? styles.toolBtnDark : null,
                loading ? (isDark ? styles.btnDisabledDark : styles.btnDisabled) : null,
              ]}
              disabled={loading}
              onPress={onSubmit}
            >
              {loading ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.toolBtnText, isDark ? styles.toolBtnTextDark : null]}>
                    Thinking
                  </Text>
                  <AnimatedDots
                    color={isDark ? APP_COLORS.dark.text.body : APP_COLORS.light.text.secondary}
                    size={18}
                  />
                </View>
              ) : (
                <Text style={[styles.toolBtnText, isDark ? styles.toolBtnTextDark : null]}>
                  {mode === 'reply' ? 'Draft replies' : 'Ask'}
                </Text>
              )}
            </Pressable>

            <Pressable
              style={[styles.toolBtn, isDark ? styles.toolBtnDark : null]}
              disabled={loading}
              onPress={onResetThread}
            >
              <Text style={[styles.toolBtnText, isDark ? styles.toolBtnTextDark : null]}>
                New thread
              </Text>
            </Pressable>

            <Pressable
              style={[styles.toolBtn, isDark ? styles.toolBtnDark : null]}
              onPress={onClose}
            >
              <Text style={[styles.toolBtnText, isDark ? styles.toolBtnTextDark : null]}>
                Close
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
