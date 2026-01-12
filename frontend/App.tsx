import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

// IMPORTANT:
// Import Amplify UI from `dist/*` (compiled JS + .d.ts) so TypeScript does NOT compile Amplify's internal TS
// sources during `tsc --watch`. Keep all Amplify UI imports on the same `dist/*` path to avoid ThemeContext
// duplication/mismatches.
import { fetchAuthSession } from '@aws-amplify/auth';
import { Authenticator, ThemeProvider } from '@aws-amplify/ui-react-native/dist';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { Amplify } from 'aws-amplify';
import { requireOptionalNativeModule } from 'expo-modules-core';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, Platform, processColor, useWindowDimensions, View } from 'react-native';
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';

import { styles } from './App.styles';
import { AuthModal } from './src/components/modals/AuthModal';
import { MainAppContent } from './src/features/appShell/components/MainAppContent';
import { useAmplifyAuthenticatorConfig } from './src/features/auth/amplifyAuthenticator';
import { useStoredTheme } from './src/hooks/useStoredTheme';
import { UiPromptProvider } from './src/providers/UiPromptProvider';
import GuestGlobalScreen from './src/screens/GuestGlobalScreen';
import { getAppThemeColors } from './src/theme/colors';

// Keep the native splash visible until we explicitly hide it (prevents a brief
// "white screen + spinner" flash while JS bootstraps and we check auth session).
SplashScreen.preventAutoHideAsync().catch(() => {
  // ignore (can throw if called multiple times in dev)
});

try {
  const outputs =
    // Prefer a committed web/prod outputs file so Hosting doesn't accidentally create a new Cognito pool.
    // Falls back to local/sandbox outputs for native/dev.
    (Platform.OS === 'web' ? require('./amplify_outputs.web.json') : null) ||
    require('./amplify_outputs.json');
  Amplify.configure(outputs);
} catch {
  // amplify_outputs.json not present yet; run `npx ampx sandbox` to generate it.
}

function AppSafeAreaProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  // Web: ignore safe-area insets entirely.
  // On some mobile browsers (esp Android/Chrome), `react-native-safe-area-context` can report large left/right
  // insets (e.g. ~42px) that flip with rotation, causing visible side "gaps". We prefer consistent full-bleed
  // layout on web.
  const { width, height } = useWindowDimensions();

  if (Platform.OS === 'web') {
    return (
      <SafeAreaInsetsContext.Provider value={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <SafeAreaFrameContext.Provider value={{ x: 0, y: 0, width, height }}>
          {children}
        </SafeAreaFrameContext.Provider>
      </SafeAreaInsetsContext.Provider>
    );
  }

  return <SafeAreaProvider>{children}</SafeAreaProvider>;
}

export default function App(): React.JSX.Element {
  const [booting, setBooting] = React.useState<boolean>(true);
  const [iconFontsReady, setIconFontsReady] = React.useState<boolean>(false);
  const [rootMode, setRootMode] = React.useState<'guest' | 'app'>('guest');
  const [authModalOpen, setAuthModalOpen] = React.useState<boolean>(false);
  const [rootLayoutDone, setRootLayoutDone] = React.useState<boolean>(false);
  const { isDark, ready: themeReady } = useStoredTheme({
    storageKey: 'ui:theme',
    defaultTheme: 'light',
    // Re-read theme when opening the auth modal in case the user toggled it on the guest screen.
    reloadDeps: [authModalOpen ? 1 : 0],
  });
  const appReady = !booting && themeReady && iconFontsReady;
  const appColors = getAppThemeColors(isDark);

  // Keep the app portrait by default, but allow camera UI to temporarily unlock orientation.
  React.useEffect(() => {
    (async () => {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      } catch {
        // ignore
      }
    })();
  }, []);

  // (Removed) We previously tried setting global TextInput defaultProps for caret color,
  // but on Android it can be ignored/overridden. We now inject caret colors directly into
  // Amplify Authenticator fields via `components` overrides.

  // Web (esp. mobile browsers): ensure icon fonts are loaded before first paint.
  // If the icon font isn't available yet, glyphs can render as "random" symbols from a fallback font.
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await Promise.all([Feather.loadFont(), MaterialIcons.loadFont()]);
      } catch {
        // ignore (icons will still render once fonts are available)
      } finally {
        if (mounted) setIconFontsReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const sess = await fetchAuthSession().catch(() => ({ tokens: undefined }));
        const hasToken = !!sess?.tokens?.idToken?.toString();
        if (mounted) setRootMode(hasToken ? 'app' : 'guest');
      } finally {
        if (mounted) setBooting(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Keep Android system nav bar in sync with our theme (fixes "light bar" in dark mode).
  React.useEffect(() => {
    if (Platform.OS !== 'android') return;
    const bg = appColors.appBackground;
    const buttons = isDark ? 'light' : 'dark';
    (async () => {
      try {
        // Avoid hard dependency on `expo-navigation-bar` (dev clients / emulators can be out of sync).
        // Using an optional native module prevents a hard crash when `ExpoNavigationBar` isn't installed.
        type ExpoNavigationBarModule = {
          setBackgroundColorAsync: (color: number) => Promise<void>;
          setButtonStyleAsync: (style: 'light' | 'dark') => Promise<void>;
        };
        const maybeModule = requireOptionalNativeModule('ExpoNavigationBar') as unknown;
        const ExpoNavigationBar: ExpoNavigationBarModule | null =
          typeof maybeModule === 'object' &&
          maybeModule != null &&
          'setBackgroundColorAsync' in maybeModule &&
          'setButtonStyleAsync' in maybeModule &&
          typeof (maybeModule as Record<string, unknown>).setBackgroundColorAsync === 'function' &&
          typeof (maybeModule as Record<string, unknown>).setButtonStyleAsync === 'function'
            ? (maybeModule as ExpoNavigationBarModule)
            : null;
        if (!ExpoNavigationBar) return;
        const bgNumber = processColor(bg);
        if (typeof bgNumber === 'number') {
          await ExpoNavigationBar.setBackgroundColorAsync(bgNumber);
        }
        await ExpoNavigationBar.setButtonStyleAsync(buttons);
      } catch {
        // ignore
      }
    })();
  }, [appColors.appBackground, isDark]);

  // Keep the mobile browser UI bar (theme-color) in sync with in-app theme on web.
  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      const head = document.head || document.getElementsByTagName('head')[0];
      let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        head.appendChild(meta);
      }
      meta.content = appColors.appBackground;

      // Hint to the UA about supported color schemes (helps form controls, scrollbars, etc).
      document.documentElement.style.colorScheme = 'dark light';
    } catch {
      // ignore
    }
  }, [appColors.appBackground, isDark]);

  // Hide the native splash once we’re ready and the root view has laid out.
  React.useEffect(() => {
    if (!appReady || !rootLayoutDone) return;
    (async () => {
      try {
        await SplashScreen.hideAsync();
      } catch {
        // ignore
      }
    })();
  }, [appReady, rootLayoutDone]);

  // theme persistence handled by useStoredTheme

  const { amplifyTheme, authComponents } = useAmplifyAuthenticatorConfig(isDark);

  return (
    <AppSafeAreaProvider>
      {/* Apply TOP safe-area globally. Screens manage left/right/bottom insets themselves (chat input / CTAs). */}
      <SafeAreaView
        style={[styles.container, styles.appSafe, isDark && styles.appSafeDark]}
        edges={['top']}
        onLayout={() => setRootLayoutDone(true)}
      >
        <UiPromptProvider isDark={isDark}>
          <Authenticator.Provider>
            {booting ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator />
              </View>
            ) : rootMode === 'guest' ? (
              <>
                <GuestGlobalScreen onSignIn={() => setAuthModalOpen(true)} />

                <AuthModal
                  open={authModalOpen}
                  onClose={() => setAuthModalOpen(false)}
                  isDark={isDark}
                  amplifyTheme={amplifyTheme}
                  authComponents={authComponents}
                  onAuthed={() => {
                    setAuthModalOpen(false);
                    setRootMode('app');
                  }}
                />
              </>
            ) : (
              <ThemeProvider theme={amplifyTheme} colorMode={isDark ? 'dark' : 'light'}>
                <Authenticator
                  loginMechanisms={['email']}
                  signUpAttributes={['preferred_username']}
                  components={authComponents}
                >
                  <MainAppContent onSignedOut={() => setRootMode('guest')} />
                </Authenticator>
              </ThemeProvider>
            )}
          </Authenticator.Provider>
        </UiPromptProvider>

        <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={appColors.appBackground} />
      </SafeAreaView>
    </AppSafeAreaProvider>
  );
}
