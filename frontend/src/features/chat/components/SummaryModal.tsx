import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { AnimatedDots } from '../../../components/AnimatedDots';
import type { ChatScreenStyles } from '../../../screens/ChatScreen.styles';
import { APP_COLORS } from '../../../theme/colors';

type Props = {
  visible: boolean;
  isDark: boolean;
  styles: ChatScreenStyles;
  loading: boolean;
  text: string;
  onClose: () => void;
};

function parseSummaryForUi(raw: string): { summary: string; takeaways: string[] } | null {
  const s = String(raw || '')
    .replace(/\r\n/g, '\n')
    .trim();
  if (!s) return null;
  const lines = s.split('\n');

  const norm = (x: string) => String(x || '').trim();
  const isSummaryHeader = (x: string) => /^summary\s*[:.]?\s*$/i.test(norm(x));
  const isKeyHeader = (x: string) => /^key\s*takeaways\s*[:.]?\s*$/i.test(norm(x));

  // Strip a standalone "Summary:" header line if present.
  let startIdx = 0;
  while (startIdx < lines.length && !norm(lines[startIdx])) startIdx += 1;
  if (startIdx < lines.length && isSummaryHeader(lines[startIdx])) startIdx += 1;

  // Find Key Takeaways header line (or fallback: "Key Takeaways:" prefix).
  let keyIdx = -1;
  for (let i = startIdx; i < lines.length; i++) {
    if (isKeyHeader(lines[i])) {
      keyIdx = i;
      break;
    }
  }

  const summaryLines =
    keyIdx >= 0 ? lines.slice(startIdx, keyIdx) : lines.slice(startIdx, lines.length);
  const takeawaysLines = keyIdx >= 0 ? lines.slice(keyIdx + 1) : [];

  const summary = summaryLines
    .join('\n')
    .trim()
    // Also handle "Summary: <text>" inline prefix
    .replace(/^summary\s*:\s*/i, '')
    .trim();

  const takeaways = takeawaysLines
    .map((l) => norm(l))
    .map((l) => l.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean);

  if (!summary && !takeaways.length) return null;
  return { summary, takeaways };
}

export function SummaryModal({ visible, isDark, styles, loading, text, onClose }: Props) {
  const parsed = React.useMemo(() => parseSummaryForUi(text), [text]);
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.summaryModal, isDark ? styles.summaryModalDark : null]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Text
              style={[
                styles.summaryTitle,
                isDark ? styles.summaryTitleDark : null,
                { marginBottom: 0 },
              ]}
            >
              {loading ? 'Summarizing' : 'Summary'}
            </Text>
            {loading ? (
              <AnimatedDots
                color={isDark ? APP_COLORS.dark.text.body : APP_COLORS.light.text.secondary}
                size={18}
              />
            ) : null}
          </View>

          <ScrollView style={styles.summaryScroll}>
            {text.length ? (
              <View style={{ gap: 12 }}>
                {parsed?.summary ? (
                  <Text style={[styles.summaryText, isDark ? styles.summaryTextDark : null]}>
                    {parsed.summary}
                  </Text>
                ) : (
                  <Text style={[styles.summaryText, isDark ? styles.summaryTextDark : null]}>
                    {text}
                  </Text>
                )}

                {parsed?.takeaways?.length ? (
                  <View style={{ gap: 8 }}>
                    <Text
                      style={[
                        styles.helperSectionTitle,
                        isDark ? styles.summaryTitleDark : null,
                        { marginBottom: 0 },
                      ]}
                    >
                      Key Takeaways
                    </Text>
                    <View style={{ gap: 6 }}>
                      {parsed.takeaways.map((t, idx) => (
                        <Text
                          key={`takeaway:${idx}`}
                          style={[styles.summaryText, isDark ? styles.summaryTextDark : null]}
                        >
                          {`\u2022 ${t}`}
                        </Text>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            ) : (
              <Text style={[styles.summaryText, isDark ? styles.summaryTextDark : null]}>
                {loading ? '' : 'No summary returned.'}
              </Text>
            )}
          </ScrollView>
          <View style={styles.summaryButtons}>
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
