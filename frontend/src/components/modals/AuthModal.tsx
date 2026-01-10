import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Authenticator, ThemeProvider, useAuthenticator } from '@aws-amplify/ui-react-native/dist';
import { styles } from '../../../App.styles';

export type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  isDark: boolean;
  amplifyTheme: any;
  authComponents: any;
  onAuthed: () => void;
};

function AuthModalGate({ onAuthed }: { onAuthed: () => void }): React.JSX.Element {
  const { user } = useAuthenticator();

  React.useEffect(() => {
    if (user) onAuthed();
  }, [user, onAuthed]);

  return <View />;
}

export function AuthModal({ open, onClose, isDark, amplifyTheme, authComponents, onAuthed }: AuthModalProps): React.JSX.Element {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.authModalOverlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.authModalOverlayInner}>
          <View style={[styles.authModalSheet, isDark && styles.authModalSheetDark]}>
            <View style={[styles.authModalTopRow, isDark && styles.authModalTopRowDark]}>
              <View style={{ width: 44 }} />
              <Text style={[styles.authModalTitle, isDark && styles.authModalTitleDark]}>Sign in</Text>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.authModalCloseCircle,
                  isDark && styles.authModalCloseCircleDark,
                  pressed && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Close sign in"
              >
                <Text style={[styles.authModalCloseX, isDark && styles.authModalCloseXDark]}>×</Text>
              </Pressable>
            </View>

            <ThemeProvider theme={amplifyTheme} colorMode={isDark ? 'dark' : 'light'}>
              <ScrollView
                style={styles.authModalBody}
                contentContainerStyle={styles.authModalBodyContent}
                keyboardShouldPersistTaps="handled"
              >
                <Authenticator loginMechanisms={['email']} signUpAttributes={['preferred_username']} components={authComponents}>
                  <AuthModalGate onAuthed={onAuthed} />
                </Authenticator>
              </ScrollView>
            </ThemeProvider>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

