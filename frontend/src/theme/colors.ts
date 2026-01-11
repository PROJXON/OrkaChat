export type AppThemeColors = {
  /** Root background (SafeArea / app shell). */
  appBackground: string;
  /** Primary foreground on appBackground. */
  appForeground: string;
  /** Neutral foreground used for spinners on light background. */
  spinnerOnLight: string;
};

export const APP_THEME_COLORS: Record<'light' | 'dark', AppThemeColors> = {
  light: {
    appBackground: '#ffffff',
    appForeground: '#111111',
    spinnerOnLight: '#111111',
  },
  dark: {
    // This is our canonical "OrkaChat dark background" used in AppSafeArea + status/nav bars.
    appBackground: '#0b0b0f',
    appForeground: '#ffffff',
    spinnerOnLight: '#ffffff',
  },
};

export function getAppThemeColors(isDark: boolean): AppThemeColors {
  return isDark ? APP_THEME_COLORS.dark : APP_THEME_COLORS.light;
}

