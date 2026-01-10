import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export function ConfirmLinkModal({
  open,
  isDark,
  url,
  domain,
  onCancel,
  onOpen,
}: {
  open: boolean;
  isDark: boolean;
  url: string;
  domain: string;
  onCancel: () => void;
  onOpen: () => void;
}): React.JSX.Element {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={[styles.card, isDark ? styles.cardDark : null]}>
          <Text style={[styles.title, isDark ? styles.titleDark : null]}>Open External Link?</Text>
          {domain ? (
            <Text style={[styles.domain, isDark ? styles.domainDark : null]} numberOfLines={1}>
              {domain}
            </Text>
          ) : null}
          <Text style={[styles.url, isDark ? styles.urlDark : null]} numberOfLines={3}>
            {url}
          </Text>

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
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#ffffff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e3e3e3',
  },
  cardDark: {
    backgroundColor: '#14141a',
    borderColor: '#2a2a33',
  },
  title: { fontSize: 18, fontWeight: '900', color: '#111' },
  titleDark: { color: '#fff' },
  domain: { marginTop: 10, fontSize: 15, fontWeight: '900', color: '#444' },
  domainDark: { color: '#d7d7e0' },
  url: { marginTop: 8, fontSize: 15, color: '#444' },
  urlDark: { color: '#b7b7c2' },
  row: { marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  btn: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#f2f2f7',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e3e3e3',
  },
  btnDark: {
    backgroundColor: '#1c1c22',
    borderColor: '#2a2a33',
  },
  btnText: { color: '#111', fontWeight: '800', fontSize: 15 },
  btnTextDark: { color: '#fff' },
});
