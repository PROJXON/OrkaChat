import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { UiPrompt } from '../../types/uiPrompt';

export function UiPromptModal({
  uiPrompt,
  setUiPrompt,
  isDark,
}: {
  uiPrompt: UiPrompt | null;
  setUiPrompt: React.Dispatch<React.SetStateAction<UiPrompt | null>>;
  isDark: boolean;
}): React.JSX.Element {
  const open = !!uiPrompt;

  return (
    <Modal visible={open} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        {/* Prevent "empty modal + OK button" flash during fade-out when uiPrompt has been cleared. */}
        {uiPrompt ? (
          <View style={[styles.modalContent, isDark ? styles.modalContentDark : null]}>
            <Text style={[styles.modalTitle, isDark ? styles.modalTitleDark : null]}>{uiPrompt.title || ''}</Text>
            <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null]}>
              {uiPrompt.message || ''}
            </Text>

            {uiPrompt.kind === 'choice3' ? (
              <View style={{ alignSelf: 'stretch', gap: 10 }}>
                <Pressable
                  style={[
                    styles.modalButton,
                    { alignSelf: 'stretch' },
                    uiPrompt.primaryVariant === 'primary' ? styles.modalButtonPrimary : null,
                    uiPrompt.primaryVariant === 'danger' ? styles.modalButtonDanger : null,
                    isDark ? styles.modalButtonDark : null,
                    isDark && uiPrompt.primaryVariant === 'primary' ? styles.modalButtonPrimaryDark : null,
                    isDark && uiPrompt.primaryVariant === 'danger' ? styles.modalButtonDangerDark : null,
                  ]}
                  onPress={() => {
                    const resolve = uiPrompt.resolve;
                    setUiPrompt(null);
                    resolve('primary');
                  }}
                >
                  <Text
                    style={[
                      styles.modalButtonText,
                      uiPrompt.primaryVariant === 'primary' ? styles.modalButtonPrimaryText : null,
                      uiPrompt.primaryVariant === 'danger' ? styles.modalButtonDangerText : null,
                      isDark ? styles.modalButtonTextDark : null,
                    ]}
                  >
                    {uiPrompt.primaryText}
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.modalButton,
                    { alignSelf: 'stretch' },
                    uiPrompt.secondaryVariant === 'primary' ? styles.modalButtonPrimary : null,
                    uiPrompt.secondaryVariant === 'danger' ? styles.modalButtonDanger : null,
                    isDark ? styles.modalButtonDark : null,
                    isDark && uiPrompt.secondaryVariant === 'primary' ? styles.modalButtonPrimaryDark : null,
                    isDark && uiPrompt.secondaryVariant === 'danger' ? styles.modalButtonDangerDark : null,
                  ]}
                  onPress={() => {
                    const resolve = uiPrompt.resolve;
                    setUiPrompt(null);
                    resolve('secondary');
                  }}
                >
                  <Text
                    style={[
                      styles.modalButtonText,
                      uiPrompt.secondaryVariant === 'primary' ? styles.modalButtonPrimaryText : null,
                      uiPrompt.secondaryVariant === 'danger' ? styles.modalButtonDangerText : null,
                      isDark ? styles.modalButtonTextDark : null,
                    ]}
                  >
                    {uiPrompt.secondaryText}
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.modalButton,
                    { alignSelf: 'stretch' },
                    uiPrompt.tertiaryVariant === 'primary' ? styles.modalButtonPrimary : null,
                    uiPrompt.tertiaryVariant === 'danger' ? styles.modalButtonDanger : null,
                    isDark ? styles.modalButtonDark : null,
                    isDark && uiPrompt.tertiaryVariant === 'primary' ? styles.modalButtonPrimaryDark : null,
                    isDark && uiPrompt.tertiaryVariant === 'danger' ? styles.modalButtonDangerDark : null,
                  ]}
                  onPress={() => {
                    const resolve = uiPrompt.resolve;
                    setUiPrompt(null);
                    resolve('tertiary');
                  }}
                >
                  <Text
                    style={[
                      styles.modalButtonText,
                      uiPrompt.tertiaryVariant === 'primary' ? styles.modalButtonPrimaryText : null,
                      uiPrompt.tertiaryVariant === 'danger' ? styles.modalButtonDangerText : null,
                      isDark ? styles.modalButtonTextDark : null,
                    ]}
                  >
                    {uiPrompt.tertiaryText}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.modalButtons}>
                <Pressable
                  style={[
                    styles.modalButton,
                    uiPrompt.kind === 'alert' ? styles.modalButtonPrimary : null,
                    uiPrompt.destructive ? styles.modalButtonDanger : null,
                    isDark ? styles.modalButtonDark : null,
                    isDark && uiPrompt.kind === 'alert' ? styles.modalButtonPrimaryDark : null,
                    isDark && uiPrompt.destructive ? styles.modalButtonDangerDark : null,
                  ]}
                  onPress={() => {
                    setUiPrompt(null);
                    if (uiPrompt.kind === 'confirm') {
                      uiPrompt.resolve(true);
                    } else {
                      uiPrompt.resolve();
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.modalButtonText,
                      uiPrompt.kind === 'alert' ? styles.modalButtonPrimaryText : null,
                      uiPrompt.destructive ? styles.modalButtonDangerText : null,
                      isDark ? styles.modalButtonTextDark : null,
                    ]}
                  >
                    {uiPrompt.confirmText || 'OK'}
                  </Text>
                </Pressable>
                {uiPrompt.kind === 'confirm' ? (
                  <Pressable
                    style={[styles.modalButton, isDark ? styles.modalButtonDark : null]}
                    onPress={() => {
                      const resolve = uiPrompt.resolve;
                      setUiPrompt(null);
                      resolve(false);
                    }}
                  >
                    <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>
                      {uiPrompt.cancelText || 'Cancel'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    // Keep generic modals (alerts, recovery passphrase, etc.) reasonably sized on desktop web,
    // while preserving the refined native sizing.
    ...(Platform.OS === 'web'
      ? ({ width: '92%', maxWidth: 520, alignSelf: 'center' } as const)
      : ({ width: '80%' } as const)),
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    elevation: 6,
    position: 'relative',
  },
  modalContentDark: {
    backgroundColor: '#1c1c22',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  modalTitleDark: {
    color: '#fff',
  },
  modalHelperText: {
    color: '#555',
    marginBottom: 12,
    lineHeight: 18,
  },
  modalHelperTextDark: {
    color: '#b7b7c2',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    // Light mode: neutral buttons should be off-gray (modal backgrounds are white).
    backgroundColor: '#f2f2f7',
    borderWidth: 1,
    // Neutral "tool button" style (avoid blue default buttons in light mode).
    borderColor: '#e3e3e3',
    // Web: avoid browser default focus ring tint (can appear green/blue on some platforms).
    ...(Platform.OS === 'web' ? { outlineStyle: 'none', boxShadow: 'none' } : null),
  },
  modalButtonDark: {
    backgroundColor: '#2a2a33',
    borderColor: 'transparent',
    borderWidth: 0,
  },
  // Primary button for generic in-app alerts/confirmations (avoid bright blue; match app theme).
  modalButtonPrimary: {
    backgroundColor: '#111',
    borderColor: 'transparent',
  },
  modalButtonPrimaryDark: {
    backgroundColor: '#2a2a33',
    borderColor: 'transparent',
  },
  modalButtonDanger: {
    backgroundColor: '#b00020',
    borderColor: 'transparent',
  },
  modalButtonDangerDark: {
    backgroundColor: '#ff6b6b',
    borderColor: 'transparent',
  },
  modalButtonText: {
    color: '#111',
    fontWeight: '800',
    textAlign: 'center',
  },
  modalButtonTextDark: {
    color: '#fff',
  },
  modalButtonPrimaryText: {
    color: '#fff',
  },
  modalButtonDangerText: {
    color: '#fff',
  },
});
