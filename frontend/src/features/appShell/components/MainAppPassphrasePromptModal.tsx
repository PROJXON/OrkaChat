import React from 'react';
import { Image, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { icons } from '@aws-amplify/ui-react-native/dist/assets';

import type { AppStyles } from '../../../../App.styles';
import { AnimatedDots } from '../../../components/AnimatedDots';
import { APP_COLORS, PALETTE } from '../../../theme/colors';

type PassphrasePromptMode = 'setup' | 'restore' | 'change' | 'reset';

export function MainAppPassphrasePromptModal({
  styles,
  isDark,
  visible,
  label,
  mode,

  passphraseVisible,
  setPassphraseVisible,
  passphraseInput,
  setPassphraseInput,
  passphraseConfirmInput,
  setPassphraseConfirmInput,
  passphraseError,
  setPassphraseError,

  processing,
  onSubmit,
  onCancel,
}: {
  styles: AppStyles;
  isDark: boolean;
  visible: boolean;
  label: string;
  mode: PassphrasePromptMode | null | undefined;

  passphraseVisible: boolean;
  setPassphraseVisible: React.Dispatch<React.SetStateAction<boolean>>;
  passphraseInput: string;
  setPassphraseInput: (v: string) => void;
  passphraseConfirmInput: string;
  setPassphraseConfirmInput: (v: string) => void;
  passphraseError: string | null;
  setPassphraseError: (v: string | null) => void;

  processing: boolean;
  onSubmit: () => void;
  onCancel: () => void | Promise<void>;
}): React.JSX.Element {
  const requiresConfirm = mode === 'setup' || mode === 'change' || mode === 'reset';
  const submitDisabled =
    processing || !passphraseInput.trim() || (requiresConfirm && !passphraseConfirmInput.trim());

  const helperText =
    mode === 'setup'
      ? 'Make sure you remember your passphrase for future device recovery - we do not store it.'
      : mode === 'change'
        ? 'Choose a new passphrase you’ll remember - we do not store it'
        : mode === 'reset'
          ? 'Set a new recovery passphrase for your account - we do not store it'
          : null;

  const busyLabel =
    mode === 'restore'
      ? 'Decrypting'
      : mode === 'change'
        ? 'Updating backup'
        : mode === 'reset'
          ? 'Resetting recovery'
          : 'Encrypting backup';

  const content = (
    <View style={[styles.modalContent, isDark ? styles.modalContentDark : null]}>
      <Text style={[styles.modalTitle, isDark ? styles.modalTitleDark : null]}>{label}</Text>
      {helperText ? (
        <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null]}>{helperText}</Text>
      ) : null}

      <View style={styles.passphraseFieldWrapper}>
        <TextInput
          style={[
            styles.modalInput,
            styles.passphraseInput,
            isDark ? styles.modalInputDark : styles.modalInputLight,
            processing ? styles.modalInputDisabled : null,
            isDark && processing ? styles.modalInputDisabledDark : null,
          ]}
          secureTextEntry={!passphraseVisible}
          value={passphraseInput}
          onChangeText={(t) => {
            setPassphraseInput(t);
            if (passphraseError) setPassphraseError(null);
          }}
          placeholder="Passphrase"
          placeholderTextColor={isDark ? PALETTE.slate400 : PALETTE.slate350}
          selectionColor={isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary}
          cursorColor={isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary}
          autoFocus
          editable={!processing}
        />
        <Pressable
          style={[styles.passphraseEyeBtn, processing && { opacity: 0.5 }]}
          onPress={() => setPassphraseVisible((v) => !v)}
          disabled={processing}
          accessibilityRole="button"
          accessibilityLabel={passphraseVisible ? 'Hide passphrase' : 'Show passphrase'}
        >
          <Image
            source={passphraseVisible ? icons.visibilityOn : icons.visibilityOff}
            tintColor={isDark ? PALETTE.slate400 : PALETTE.slate450}
            style={{
              width: 18,
              height: 18,
            }}
          />
        </Pressable>
      </View>

      {requiresConfirm ? (
        <View style={styles.passphraseFieldWrapper}>
          <TextInput
            style={[
              styles.modalInput,
              styles.passphraseInput,
              isDark ? styles.modalInputDark : styles.modalInputLight,
              processing ? styles.modalInputDisabled : null,
              isDark && processing ? styles.modalInputDisabledDark : null,
            ]}
            secureTextEntry={!passphraseVisible}
            value={passphraseConfirmInput}
            onChangeText={(t) => {
              setPassphraseConfirmInput(t);
              if (passphraseError) setPassphraseError(null);
            }}
            placeholder="Confirm Passphrase"
            placeholderTextColor={isDark ? PALETTE.slate400 : PALETTE.slate350}
            selectionColor={isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary}
            cursorColor={isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary}
            editable={!processing}
          />
          <Pressable
            style={[styles.passphraseEyeBtn, processing && { opacity: 0.5 }]}
            onPress={() => setPassphraseVisible((v) => !v)}
            disabled={processing}
            accessibilityRole="button"
            accessibilityLabel={passphraseVisible ? 'Hide passphrase' : 'Show passphrase'}
          >
            <Image
              source={passphraseVisible ? icons.visibilityOn : icons.visibilityOff}
              tintColor={isDark ? PALETTE.slate400 : PALETTE.slate450}
              style={{
                width: 18,
                height: 18,
              }}
            />
          </Pressable>
        </View>
      ) : null}

      {passphraseError ? (
        <Text style={[styles.passphraseErrorText, isDark ? styles.passphraseErrorTextDark : null]}>{passphraseError}</Text>
      ) : null}

      <View style={styles.modalButtons}>
        <Pressable
          style={[
            styles.modalButton,
            styles.modalButtonCta,
            isDark ? styles.modalButtonCtaDark : null,
            submitDisabled && { opacity: 0.45 },
          ]}
          onPress={onSubmit}
          disabled={submitDisabled}
        >
          {processing ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <Text style={[styles.modalButtonText, styles.modalButtonCtaText]}>{busyLabel}</Text>
              <AnimatedDots color={APP_COLORS.dark.text.primary} size={18} />
            </View>
          ) : (
            <Text style={[styles.modalButtonText, styles.modalButtonCtaText]}>Submit</Text>
          )}
        </Pressable>

        <Pressable
          style={[styles.modalButton, isDark ? styles.modalButtonDark : null, processing && { opacity: 0.45 }]}
          onPress={() => void Promise.resolve(onCancel())}
          disabled={processing}
        >
          <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        {Platform.OS === 'web' ? (
          // Web: keep password inputs inside a <form> to satisfy browser heuristics.
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
            // Center the modal content within the overlay.
            style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
          >
            {content}
          </form>
        ) : (
          content
        )}
      </View>
    </Modal>
  );
}

