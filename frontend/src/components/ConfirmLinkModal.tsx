import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { APP_COLORS, PALETTE, withAlpha } from '../theme/colors';

export function ConfirmLinkModal({
  open,
  isDark,
  url,
  domain,
  title = 'Open External Link?',
  fileName,
  hideUrl,
  onCancel,
  onOpen,
}: {
  open: boolean;
  isDark: boolean;
  url: string;
  domain: string;
  title?: string;
  fileName?: string;
  hideUrl?: boolean;
  onCancel: () => void;
  onOpen: () => void;
}): React.JSX.Element {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={[styles.card, isDark ? styles.cardDark : null]}>
          <Text style={[styles.title, isDark ? styles.titleDark : null]}>{title}</Text>
          {fileName ? (
            <Text style={[styles.fileName, isDark ? styles.fileNameDark : null]} numberOfLines={1}>
              {fileName}
            </Text>
          ) : null}
          {domain ? (
            <Text style={[styles.domain, isDark ? styles.domainDark : null]} numberOfLines={1}>
              {domain}
            </Text>
          ) : null}
          {!hideUrl ? (
            <Text style={[styles.url, isDark ? styles.urlDark : null]} numberOfLines={3}>
              {url}
            </Text>
          ) : null}

          <View style={styles.row}>
            <Pressable style={[styles.btn, isDark ? styles.btnDark : null]} onPress={onOpen}>
              <Text style={[styles.btnText, isDark ? styles.btnTextDark : null]}>Open</Text>
            </Pressable>
            <Pressable style={[styles.btn, isDark ? styles.btnDark : null]} onPress={onCancel}>
              <Text style={[styles.btnText, isDark ? styles.btnTextDark : null]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: withAlpha(PALETTE.black, 0.35),
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    padding: 14,
    backgroundColor: APP_COLORS.light.bg.app,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_COLORS.light.border.subtle,
  },
  cardDark: {
    backgroundColor: APP_COLORS.dark.bg.surface,
    borderColor: APP_COLORS.dark.border.subtle,
  },
  title: { fontSize: 18, fontWeight: '900', color: APP_COLORS.light.text.primary },
  titleDark: { color: APP_COLORS.dark.text.primary },
  fileName: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: '900',
    color: APP_COLORS.light.text.heading,
  },
  fileNameDark: { color: APP_COLORS.dark.text.primary },
  domain: { marginTop: 10, fontSize: 15, fontWeight: '900', color: APP_COLORS.light.text.body },
  domainDark: { color: APP_COLORS.dark.text.body },
  url: { marginTop: 8, fontSize: 15, color: APP_COLORS.light.text.body },
  urlDark: { color: APP_COLORS.dark.text.secondary },
  row: { marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  btn: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: APP_COLORS.light.bg.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_COLORS.light.border.subtle,
  },
  btnDark: {
    backgroundColor: APP_COLORS.dark.bg.header,
    borderColor: APP_COLORS.dark.border.subtle,
  },
  btnText: { color: APP_COLORS.light.text.primary, fontWeight: '800', fontSize: 15 },
  btnTextDark: { color: APP_COLORS.dark.text.primary },
});
