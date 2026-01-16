import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { APP_COLORS, PALETTE, withAlpha } from '../../theme/colors';
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
  // IMPORTANT (esp. web):
  // Keep this modal *unmounted* when closed.
  //
  // If we keep a hidden Modal mounted, other modals (e.g. Members list) can mount after it and
  // sit above it in the DOM stacking order. Then when the prompt becomes visible, it can appear
  // "behind" the already-open modal.
  //
  // Mounting only while open ensures the prompt portal is appended last and appears on top.
  if (!uiPrompt) return <></>;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        const p = uiPrompt;
        setUiPrompt(null);
        // Best-effort "cancel" behavior.
        try {
          if (p.kind === 'confirm') p.resolve(false);
          else if (p.kind === 'choice3') p.resolve('secondary');
          else p.resolve();
        } catch {
          // ignore
        }
      }}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, isDark ? styles.modalContentDark : null]}>
          <Text style={[styles.modalTitle, isDark ? styles.modalTitleDark : null]}>
            {uiPrompt.title || ''}
          </Text>
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
                  isDark && uiPrompt.primaryVariant === 'primary'
                    ? styles.modalButtonPrimaryDark
                    : null,
                  isDark && uiPrompt.primaryVariant === 'danger'
                    ? styles.modalButtonDangerDark
                    : null,
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
                  isDark && uiPrompt.secondaryVariant === 'primary'
                    ? styles.modalButtonPrimaryDark
                    : null,
                  isDark && uiPrompt.secondaryVariant === 'danger'
                    ? styles.modalButtonDangerDark
                    : null,
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
                  isDark && uiPrompt.tertiaryVariant === 'primary'
                    ? styles.modalButtonPrimaryDark
                    : null,
                  isDark && uiPrompt.tertiaryVariant === 'danger'
                    ? styles.modalButtonDangerDark
                    : null,
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
                  <Text
                    style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}
                  >
                    {uiPrompt.cancelText || 'Cancel'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: withAlpha(PALETTE.black, 0.5),
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    // Keep generic modals (alerts, recovery passphrase, etc.) reasonably sized on desktop web,
    // while preserving the refined native sizing.
    ...(Platform.OS === 'web'
      ? ({ width: '92%', maxWidth: 520, alignSelf: 'center' } as const)
      : ({ width: '80%' } as const)),
    backgroundColor: APP_COLORS.light.bg.app,
    padding: 20,
    borderRadius: 12,
    elevation: 6,
    position: 'relative',
  },
  modalContentDark: {
    backgroundColor: APP_COLORS.dark.bg.header,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: APP_COLORS.light.text.primary,
    marginBottom: 12,
  },
  modalTitleDark: {
    color: APP_COLORS.dark.text.primary,
  },
  modalHelperText: {
    color: APP_COLORS.light.text.secondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  modalHelperTextDark: {
    color: APP_COLORS.dark.text.secondary,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    // Keep a consistent gap above footer buttons.
    paddingTop: 6,
    gap: 8,
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    // Light mode: neutral buttons should be off-gray (modal backgrounds are white).
    backgroundColor: APP_COLORS.light.bg.surface2,
    borderWidth: 1,
    // Neutral "tool button" style (avoid blue default buttons in light mode).
    borderColor: APP_COLORS.light.border.subtle,
    // Web: avoid browser default focus ring tint (can appear green/blue on some platforms).
    ...(Platform.OS === 'web'
      ? { outlineStyle: 'solid', outlineWidth: 0, outlineColor: 'transparent', boxShadow: 'none' }
      : null),
  },
  modalButtonDark: {
    backgroundColor: APP_COLORS.dark.border.subtle,
    borderColor: 'transparent',
    borderWidth: 0,
  },
  // Primary button for generic in-app alerts/confirmations (avoid bright blue; match app theme).
  modalButtonPrimary: {
    backgroundColor: APP_COLORS.light.text.primary,
    borderColor: 'transparent',
  },
  modalButtonPrimaryDark: {
    backgroundColor: APP_COLORS.dark.border.subtle,
    borderColor: 'transparent',
  },
  modalButtonDanger: {
    backgroundColor: APP_COLORS.light.status.errorText,
    borderColor: 'transparent',
  },
  modalButtonDangerDark: {
    backgroundColor: APP_COLORS.dark.status.errorText,
    borderColor: 'transparent',
  },
  modalButtonText: {
    color: APP_COLORS.light.text.primary,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalButtonTextDark: {
    color: APP_COLORS.dark.text.primary,
  },
  modalButtonPrimaryText: {
    color: APP_COLORS.dark.text.primary,
  },
  modalButtonDangerText: {
    color: APP_COLORS.dark.text.primary,
  },
});
