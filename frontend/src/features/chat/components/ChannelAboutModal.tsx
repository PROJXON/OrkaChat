import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { RichText } from '../../../components/RichText';

import type { ChatScreenStyles } from '../../../screens/ChatScreen.styles';

type Props = {
  visible: boolean;
  isDark: boolean;
  styles: ChatScreenStyles;
  title: string;

  edit: boolean;
  draft: string;
  busy: boolean;
  canEdit: boolean;

  onChangeDraft: (next: string) => void;
  onOpenUrl: (url: string) => void;

  onRequestClose: () => void;
  onBackdropPress: () => void;

  onPreview: () => void;
  onSave: () => void | Promise<void>;
  onCancelEdit: () => void;
  onGotIt: () => void | Promise<void>;
  onEdit: () => void;
};

export function ChannelAboutModal({
  visible,
  isDark,
  styles,
  title,
  edit,
  draft,
  busy,
  canEdit,
  onChangeDraft,
  onOpenUrl,
  onRequestClose,
  onBackdropPress,
  onPreview,
  onSave,
  onCancelEdit,
  onGotIt,
  onEdit,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onBackdropPress} />
        <View style={[styles.summaryModal, isDark ? styles.summaryModalDark : null]}>
          <Text style={[styles.summaryTitle, isDark ? styles.summaryTitleDark : null]}>{title}</Text>

          {edit ? (
            <>
              <Text style={[styles.summaryText, isDark ? styles.summaryTextDark : null, { marginBottom: 8 }]}>
                Supports **bold**, *italics*, and links. Max 4000 chars.
              </Text>
              <TextInput
                value={draft}
                onChangeText={onChangeDraft}
                placeholder="Write channel info / rules…"
                placeholderTextColor={isDark ? '#8f8fa3' : '#999'}
                selectionColor={isDark ? '#ffffff' : '#111'}
                cursorColor={isDark ? '#ffffff' : '#111'}
                multiline
                autoFocus
                // Android: multiline TextInput defaults to vertically-centered text; force top-left like a real editor.
                textAlignVertical="top"
                style={{
                  width: '100%',
                  minHeight: 160,
                  maxHeight: 320,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderWidth: 1,
                  borderRadius: 10,
                  backgroundColor: isDark ? '#1c1c22' : '#f2f2f7',
                  borderColor: isDark ? '#3a3a46' : '#e3e3e3',
                  color: isDark ? '#ffffff' : '#111',
                  fontSize: 15,
                }}
              />
              <Text style={[styles.summaryText, isDark ? styles.summaryTextDark : null, { marginTop: 6 }]}>
                {`${String(draft || '').length}/4000`}
              </Text>
            </>
          ) : (
            <ScrollView style={styles.summaryScroll}>
              {String(draft || '').trim() ? (
                <RichText
                  text={String(draft || '')}
                  isDark={isDark}
                  style={[styles.summaryText, ...(isDark ? [styles.summaryTextDark] : [])]}
                  enableMentions={false}
                  variant="neutral"
                  onOpenUrl={onOpenUrl}
                />
              ) : (
                <Text style={[styles.summaryText, isDark ? styles.summaryTextDark : null]}>
                  (No channel about set.)
                </Text>
              )}
            </ScrollView>
          )}

          <View style={styles.summaryButtons}>
            {edit ? (
              <>
                <Pressable
                  style={[
                    styles.toolBtn,
                    isDark ? styles.toolBtnDark : null,
                    busy ? { opacity: 0.6 } : null,
                    { marginRight: 'auto' },
                  ]}
                  disabled={busy}
                  onPress={onPreview}
                >
                  <Text style={[styles.toolBtnText, isDark ? styles.toolBtnTextDark : null]}>Preview</Text>
                </Pressable>
                <Pressable
                  style={[styles.toolBtn, isDark ? styles.toolBtnDark : null, busy ? { opacity: 0.6 } : null]}
                  disabled={busy}
                  onPress={() => void Promise.resolve(onSave())}
                >
                  <Text style={[styles.toolBtnText, isDark ? styles.toolBtnTextDark : null]}>Save</Text>
                </Pressable>
                <Pressable
                  style={[styles.toolBtn, isDark ? styles.toolBtnDark : null]}
                  disabled={busy}
                  onPress={onCancelEdit}
                >
                  <Text style={[styles.toolBtnText, isDark ? styles.toolBtnTextDark : null]}>Cancel</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  style={[styles.toolBtn, isDark ? styles.toolBtnDark : null]}
                  onPress={() => void Promise.resolve(onGotIt())}
                >
                  <Text style={[styles.toolBtnText, isDark ? styles.toolBtnTextDark : null]}>Got it</Text>
                </Pressable>
                {canEdit ? (
                  <Pressable style={[styles.toolBtn, isDark ? styles.toolBtnDark : null]} onPress={onEdit}>
                    <Text style={[styles.toolBtnText, isDark ? styles.toolBtnTextDark : null]}>Edit</Text>
                  </Pressable>
                ) : null}
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
