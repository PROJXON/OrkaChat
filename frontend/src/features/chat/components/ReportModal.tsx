import React from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import type { CdnUrlCacheApi } from '../../../hooks/useCdnUrlCache';
import { normalizeChatMediaList, parseChatEnvelope } from '../parsers';
import { previewLabelForMedia } from '../../../utils/mediaKinds';

type ReportNotice = { type: 'success' | 'error'; message: string };

function MiniToggle({
  value,
  onValueChange,
  disabled,
  isDark,
  styles,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  isDark: boolean;
  styles: Record<string, any>;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        onValueChange(!value);
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      style={({ pressed }) => [
        styles.miniToggleTrack,
        isDark ? styles.miniToggleTrackDark : null,
        value ? styles.miniToggleTrackOn : null,
        value && isDark ? styles.miniToggleTrackOnDark : null,
        disabled ? styles.miniToggleDisabled : null,
        pressed && !disabled ? styles.miniTogglePressed : null,
      ]}
    >
      <View
        style={[
          styles.miniToggleThumb,
          isDark ? styles.miniToggleThumbDark : null,
          value ? styles.miniToggleThumbOn : null,
        ]}
      />
    </Pressable>
  );
}

type Props = {
  visible: boolean;
  isDark: boolean;
  styles: Record<string, any>;
  submitting: boolean;
  notice: ReportNotice | null;
  reportKind: 'message' | 'user';
  reportCategory: string;
  reportTargetMessage: any | null;
  reportTargetUserSub: string | null | undefined;
  reportTargetUserLabel: string | null | undefined;
  reportDetails: string;
  cdnMedia: CdnUrlCacheApi;
  onClose: () => void;
  onSubmit: () => void;
  onToggleKind: (nextIsUser: boolean) => void;
  onSelectCategory: (key: string) => void;
  onChangeDetails: (t: string) => void;
};

export function ReportModal({
  visible,
  isDark,
  styles,
  submitting,
  notice,
  reportKind,
  reportCategory,
  reportTargetMessage,
  reportTargetUserSub,
  reportTargetUserLabel,
  reportDetails,
  cdnMedia,
  onClose,
  onSubmit,
  onToggleKind,
  onSelectCategory,
  onChangeDetails,
}: Props) {
  const ensureThumbUrl = cdnMedia.ensure;

  // Prefetch thumb URLs so we don't call cdnMedia.resolve() during render (which would set state).
  React.useEffect(() => {
    if (!visible) return;
    if (reportKind !== 'message') return;
    try {
      const t = reportTargetMessage;
      if (!t || t.deletedAt) return;

      const rawText =
        typeof t.decryptedText === 'string' && t.decryptedText.trim()
          ? t.decryptedText.trim()
          : typeof t.text === 'string' && t.text.trim()
            ? t.text.trim()
            : '';

      // Only attempt to parse plaintext/global messages for thumbs; encrypted attachments are .enc and not CDN-previewable here.
      const env = !t.encrypted && !t.groupEncrypted ? parseChatEnvelope(rawText) : null;
      const envMediaList = env ? normalizeChatMediaList(env.media) : [];
      const fallbackList = Array.isArray(t.mediaList) && t.mediaList.length ? t.mediaList : t.media ? [t.media] : [];
      const previewMediaList = (envMediaList.length ? envMediaList : fallbackList) as any[];
      const media = (previewMediaList.length ? previewMediaList[0] : null) as any;
      const thumbPath = String(media?.thumbPath || media?.path || '').trim();
      if (!thumbPath) return;
      if (thumbPath.includes('.enc')) return;

      ensureThumbUrl([thumbPath]);
    } catch {
      // ignore prefetch errors
    }
  }, [ensureThumbUrl, reportKind, reportTargetMessage, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} disabled={submitting} />
        <View style={[styles.summaryModal, isDark ? styles.summaryModalDark : null]}>
          <Text style={[styles.summaryTitle, isDark ? styles.summaryTitleDark : null]}>Report</Text>
          <View style={{ flexGrow: 1, flexShrink: 1, minHeight: 0 }}>
            <ScrollView style={styles.summaryScroll} contentContainerStyle={{ paddingBottom: 8 }}>
              <Text style={[styles.summaryText, isDark ? styles.summaryTextDark : null]}>
                Reports are sent to the developer for review. Add an optional note to help us understand the issue.
              </Text>

              {notice ? (
                <View
                  style={[
                    styles.reportNoticeBox,
                    notice.type === 'success' ? styles.reportNoticeBoxSuccess : styles.reportNoticeBoxError,
                    isDark ? styles.reportNoticeBoxDark : null,
                    notice.type === 'success'
                      ? isDark
                        ? styles.reportNoticeBoxSuccessDark
                        : null
                      : isDark
                        ? styles.reportNoticeBoxErrorDark
                        : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.reportNoticeText,
                      notice.type === 'success' ? styles.reportNoticeTextSuccess : styles.reportNoticeTextError,
                      isDark ? styles.reportNoticeTextDark : null,
                      notice.type === 'success'
                        ? isDark
                          ? styles.reportNoticeTextSuccessDark
                          : null
                        : isDark
                          ? styles.reportNoticeTextErrorDark
                          : null,
                    ]}
                  >
                    {notice.message}
                  </Text>
                </View>
              ) : null}

              <View style={styles.reportTargetSwitchWrap}>
                <Text style={[styles.reportTargetToggleLabel, isDark ? styles.reportTargetToggleLabelDark : null]}>
                  Message
                </Text>
                {Platform.OS === 'web' ? (
                  <MiniToggle
                    value={reportKind === 'user'}
                    disabled={submitting}
                    isDark={isDark}
                    styles={styles}
                    onValueChange={onToggleKind}
                  />
                ) : (
                  <Switch
                    value={reportKind === 'user'}
                    disabled={submitting}
                    onValueChange={onToggleKind}
                    trackColor={{ false: '#d1d1d6', true: '#d1d1d6' }}
                    thumbColor={isDark ? '#2a2a33' : '#ffffff'}
                  />
                )}
                <Text style={[styles.reportTargetToggleLabel, isDark ? styles.reportTargetToggleLabelDark : null]}>
                  User
                </Text>
              </View>

              <View style={styles.reportCategoryWrap}>
                {[
                  { key: 'spam', label: 'Spam' },
                  { key: 'harassment', label: 'Harassment' },
                  { key: 'hate', label: 'Hate' },
                  { key: 'impersonation', label: 'Impersonation' },
                  { key: 'illegal', label: 'Illegal' },
                  { key: 'other', label: 'Other' },
                ].map((c) => {
                  const active = reportCategory === c.key;
                  return (
                    <Pressable
                      key={c.key}
                      disabled={submitting}
                      onPress={() => onSelectCategory(c.key)}
                      style={({ pressed }) => [
                        styles.reportChip,
                        isDark ? styles.reportChipDark : null,
                        active ? styles.reportChipActive : null,
                        active && isDark ? styles.reportChipActiveDark : null,
                        pressed ? { opacity: 0.9 } : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.reportChipText,
                          isDark ? styles.reportChipTextDark : null,
                          active ? (isDark ? styles.reportChipTextActiveDark : styles.reportChipTextActive) : null,
                        ]}
                      >
                        {c.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {reportKind === 'message' ? (
                <View style={[styles.reportPreviewBox, isDark ? styles.reportPreviewBoxDark : null]}>
                  <Text style={[styles.reportPreviewLabel, isDark ? styles.reportPreviewLabelDark : null]}>
                    Message Preview
                  </Text>
                  {(() => {
                    const t = reportTargetMessage;
                    if (!t) {
                      return (
                        <Text style={[styles.reportPreviewText, isDark ? styles.reportPreviewTextDark : null]}>
                          (no message selected)
                        </Text>
                      );
                    }
                    if (t.deletedAt) {
                      return (
                        <Text style={[styles.reportPreviewText, isDark ? styles.reportPreviewTextDark : null]}>
                          (deleted)
                        </Text>
                      );
                    }

                    const rawText =
                      typeof t.decryptedText === 'string' && t.decryptedText.trim()
                        ? t.decryptedText.trim()
                        : typeof t.text === 'string' && t.text.trim()
                          ? t.text.trim()
                          : '';

                    // Global/channel media messages often store a JSON chat envelope in `text`.
                    // If we render that raw string, the report preview becomes unreadable.
                    const env = !t.encrypted && !t.groupEncrypted ? parseChatEnvelope(rawText) : null;
                    const envMediaList = env ? normalizeChatMediaList(env.media) : [];
                    const fallbackList =
                      Array.isArray(t.mediaList) && t.mediaList.length ? t.mediaList : t.media ? [t.media] : [];
                    const previewMediaList = (envMediaList.length ? envMediaList : fallbackList) as any[];
                    const media = (previewMediaList.length ? previewMediaList[0] : null) as any;
                    const mediaCount = previewMediaList.length;
                    const mediaFileNames = (() => {
                      const names = previewMediaList
                        .map((m) =>
                          m && typeof (m as any).fileName === 'string' ? String((m as any).fileName).trim() : '',
                        )
                        .filter(Boolean);
                      // Keep order, de-dupe.
                      const seen = new Set<string>();
                      const uniq: string[] = [];
                      for (const n of names) {
                        if (seen.has(n)) continue;
                        seen.add(n);
                        uniq.push(n);
                      }
                      return uniq;
                    })();
                    const mediaFileNamesLines = (() => {
                      if (!mediaFileNames.length) return '';
                      const max = 4;
                      const shown = mediaFileNames.slice(0, max);
                      const extra = mediaFileNames.length - shown.length;
                      return shown.join('\n') + (extra > 0 ? `\n+${extra} more` : '');
                    })();

                    const mediaLabel = (() => {
                      return previewLabelForMedia({
                        kind: media?.kind === 'image' || media?.kind === 'video' || media?.kind === 'file' ? media.kind : 'file',
                        contentType: typeof media?.contentType === 'string' ? media.contentType : undefined,
                      });
                    })();
                    const mediaMetaLabel =
                      mediaCount > 1 ? `${mediaLabel} · ${mediaCount} attachments` : mediaCount === 1 ? mediaLabel : '';

                    const text = (() => {
                      const msgText = env?.text && typeof env.text === 'string' ? env.text.trim() : '';
                      if (msgText) return msgText;
                      // Fall back to the raw text ONLY if it doesn't look like a chat envelope.
                      if (rawText.startsWith('{') && rawText.includes('"type"') && rawText.includes('"chat"'))
                        return '';
                      return rawText;
                    })();

                    const thumbPath = media?.thumbPath || media?.path || '';
                    const isEnc = typeof thumbPath === 'string' && thumbPath.includes('.enc');
                    const thumbUrl = !isEnc && thumbPath ? cdnMedia.get(thumbPath) : '';

                    if (thumbUrl) {
                      return (
                        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                          <Image
                            source={{ uri: thumbUrl }}
                            style={{
                              width: 56,
                              height: 56,
                              borderRadius: 10,
                              backgroundColor: isDark ? '#1c1c22' : '#e9e9ee',
                            }}
                            resizeMode="cover"
                          />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            {mediaMetaLabel ? (
                              <Text
                                style={[
                                  styles.reportPreviewText,
                                  isDark ? styles.reportPreviewTextDark : null,
                                  { opacity: 0.75, marginBottom: 2 },
                                ]}
                                numberOfLines={1}
                              >
                                {mediaMetaLabel}
                              </Text>
                            ) : null}
                            {text ? (
                              <Text
                                style={[styles.reportPreviewText, isDark ? styles.reportPreviewTextDark : null]}
                                numberOfLines={3}
                              >
                                {text.slice(0, 200)}
                              </Text>
                            ) : null}
                            {mediaFileNames.length ? (
                              <Text
                                style={[
                                  styles.reportPreviewText,
                                  isDark ? styles.reportPreviewTextDark : null,
                                  { opacity: 0.75, marginTop: 4 },
                                ]}
                                numberOfLines={4}
                              >
                                {mediaFileNamesLines}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      );
                    }

                    if (media?.path) {
                      const line1 =
                        `${mediaMetaLabel || ''}${text ? `${mediaMetaLabel ? ': ' : ''}${text.slice(0, 200)}` : ''}${isEnc ? ' (encrypted attachment)' : ''}`.trim();
                      return (
                        <Text style={[styles.reportPreviewText, isDark ? styles.reportPreviewTextDark : null]}>
                          {line1 || (isEnc ? '(encrypted attachment)' : '')}
                          {mediaFileNamesLines ? `\n${mediaFileNamesLines}` : ''}
                        </Text>
                      );
                    }

                    return (
                      <Text style={[styles.reportPreviewText, isDark ? styles.reportPreviewTextDark : null]}>
                        {text ? text.slice(0, 200) : '(no text)'}
                      </Text>
                    );
                  })()}
                </View>
              ) : (
                <View style={[styles.reportPreviewBox, isDark ? styles.reportPreviewBoxDark : null]}>
                  <Text style={[styles.reportPreviewLabel, isDark ? styles.reportPreviewLabelDark : null]}>
                    Reporting User
                  </Text>
                  <Text style={[styles.reportPreviewText, isDark ? styles.reportPreviewTextDark : null]}>
                    {(() => {
                      const label = String(reportTargetUserLabel || '').trim();
                      if (label) return label.slice(0, 120);
                      const sub = String(reportTargetUserSub || '').trim();
                      return sub ? `User ID: ${sub}` : '(unknown user)';
                    })()}
                  </Text>
                </View>
              )}

              <TextInput
                value={reportDetails}
                onChangeText={onChangeDetails}
                placeholder="Optional note (e.g. harassment, spam, impersonation)…"
                placeholderTextColor={isDark ? '#8f8fa3' : '#8a8a96'}
                multiline
                style={[styles.reportInput, isDark ? styles.reportInputDark : null]}
                editable={!submitting}
                maxLength={900}
              />
            </ScrollView>
          </View>

          <View style={styles.summaryButtons}>
            <Pressable
              style={[
                styles.reportBtnDanger,
                isDark ? styles.reportBtnDangerDark : null,
                submitting ? (isDark ? styles.btnDisabledDark : styles.btnDisabled) : null,
              ]}
              disabled={submitting}
              onPress={onSubmit}
            >
              <Text style={[styles.reportBtnDangerText]}>{submitting ? 'Reporting…' : 'Report'}</Text>
            </Pressable>
            <Pressable
              style={[styles.toolBtn, isDark ? styles.toolBtnDark : null]}
              disabled={submitting}
              onPress={onClose}
            >
              <Text style={[styles.toolBtnText, isDark ? styles.toolBtnTextDark : null]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
