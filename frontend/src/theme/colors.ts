/**
 * Centralized color tokens.
 *
 * Goal: keep hex values stable, but reference them via semantic tokens so the UI
 * reads clearly and stays consistent across the app.
 */

export type AppThemeColors = {
  /** Root background (SafeArea / app shell). */
  appBackground: string;
  /** Primary foreground on appBackground. */
  appForeground: string;
  /** Neutral foreground used for spinners on light background. */
  spinnerOnLight: string;
};

/**
 * Low-level palette (raw hexes). Prefer using `APP_COLORS` (semantic) in UI code.
 */
export const PALETTE = {
  white: '#ffffff',
  nearWhite: '#f6f6fb',
  snow: '#fafafa',
  offWhite: '#f5f5f5',
  cloud: '#f2f2f7',
  mist: '#e9e9ee',
  fog: '#e7e7ee',
  lineLight: '#e3e3e3',
  lineMedium: '#dddddd',
  lineDark: '#cccccc',

  black: '#000000',
  orkaDarkBg: '#0b0b0f',
  slate900: '#111111',
  slate880: '#222222',
  slate850: '#14141a',
  slate800: '#1c1c22',
  slate750: '#2a2a33',
  slate700: '#3a3a46',
  slate650: '#444444',
  slate600: '#555555',
  slate870: '#333333',
  slate500: '#666666',
  slate450: '#777777',
  slate400: '#8f8fa3',
  slate370: '#8a8a96',
  slate350: '#999999',
  slate300: '#a7a7b4',
  slate250: '#b7b7c2',
  slate175: '#c7c7cc',
  slate380: '#8e8e93',
  slate230: '#aeb2bb',
  slate200: '#d1d1d6',
  slate210: '#cfd2d8',
  slate190: '#d6d6de',
  slate180: '#d7d7e0',
  paper200: '#eeeeee',
  paper210: '#f1f1f1',
  paper220: '#f4f4f4',
  paper230: '#f7f7fb',
  paper240: '#f0f0f5',
  paper250: '#e9e9e9',
  paper260: '#e6e6ef',
  paper270: '#e1e1e6',
  paper280: '#e7e7ea',

  brandBlue: '#1976d2',
  linkBlueLight: '#0b62d6',
  linkBlueDark: '#9dd3ff',
  dangerRed: '#ff3b30',
  dangerRedSoft: '#ff6b6b',
  dangerRedMaterial: '#b00020',
  dangerRedDark: '#8b0000',
  dangerPink: '#cf6679',
  dangerBgMaterial50: '#ffebee',
  dangerBorderMaterial100: '#ffcdd2',
  dangerTextMaterial800: '#c62828',
  dangerBgLight: '#fff5f5',
  dangerBorderLight: '#ffd5d5',
  dangerBgDark: '#2a1518',
  dangerBgDarkAlt: '#2a1a1a',
  dangerBorderDark: '#5a2a2f',
  dangerAccentDark: '#7f0015',

  successGreen: '#7de6a5',
  successText: '#2e7d32',
  successBorder: '#0b6b2c',
  successBgDark: '#0f2317',
  successBg: '#f0fff4',
  successBgStrong: '#c7f0d0',
  successTextDark: '#1f4d33',

  // Avatar palette (user-facing defaults)
  avatarBlurple: '#5865F2',
  avatarGreen: '#57F287',
  avatarYellow: '#FEE75C',
  avatarPink: '#EB459E',
  avatarRed: '#ED4245',
  avatarBlue: '#3498DB',
  avatarPurple: '#9B59B6',
  avatarOrange: '#E67E22',
  avatarTeal: '#1ABC9C',
  avatarGray: '#95A5A6',
} as const;

function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  const s = String(hex || '').trim();
  if (!s.startsWith('#')) return null;
  const raw = s.slice(1);
  if (raw.length === 3) {
    const r = parseInt(raw[0] + raw[0], 16);
    const g = parseInt(raw[1] + raw[1], 16);
    const b = parseInt(raw[2] + raw[2], 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    return { r, g, b };
  }
  if (raw.length === 6) {
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    return { r, g, b };
  }
  return null;
}

/**
 * Helper for consistent translucent colors while keeping the "base" color in hex.
 * Example: `withAlpha(PALETTE.black, 0.35)` → `'rgba(0,0,0,0.35)'`
 */
export function withAlpha(hex: string, alpha: number): string {
  const rgb = parseHexColor(hex);
  if (!rgb) throw new Error(`withAlpha(): expected hex color, got "${String(hex)}"`);
  const a = Math.max(0, Math.min(1, Number(alpha)));
  // Preserve a short-ish decimal representation (avoid long floats).
  const aStr = Number.isFinite(a) ? String(Math.round(a * 1000) / 1000) : '1';
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${aStr})`;
}

export type SemanticAppColors = {
  bg: {
    app: string;
    header: string;
    surface: string;
    surface2: string;
  };
  text: {
    /** Headings (titles) on the app background. */
    heading: string;
    primary: string;
    /** Default body text (often slightly lighter than primary in light mode). */
    body: string;
    secondary: string;
    muted: string;
    inverse: string;
  };
  border: {
    subtle: string;
    default: string;
  };
  brand: { primary: string; link: string };
  status: {
    /** Default "error" text/icon color for inline error labels. */
    errorText: string;
    danger: string;
    dangerSoft: string;
    success: string;
    successBg: string;
  };
};

/**
 * Semantic tokens (what UI code should reference).
 * Keep these mapped to the existing hex values already used across the app.
 */
export const APP_COLORS: Record<'light' | 'dark', SemanticAppColors> = {
  light: {
    bg: {
      app: PALETTE.white,
      header: PALETTE.snow,
      surface: PALETTE.offWhite,
      surface2: PALETTE.cloud,
    },
    text: {
      heading: PALETTE.slate880,
      primary: PALETTE.slate900,
      body: PALETTE.slate650,
      secondary: PALETTE.slate600,
      muted: PALETTE.slate500,
      inverse: PALETTE.white,
    },
    border: {
      subtle: PALETTE.lineLight,
      default: PALETTE.slate200,
    },
    brand: { primary: PALETTE.brandBlue, link: PALETTE.linkBlueLight },
    status: {
      errorText: PALETTE.dangerRedMaterial,
      danger: PALETTE.dangerRed,
      dangerSoft: PALETTE.dangerRedSoft,
      success: PALETTE.successGreen,
      successBg: PALETTE.successBg,
    },
  },
  dark: {
    bg: {
      // Canonical "OrkaChat dark background" used in app shell + bars.
      app: PALETTE.orkaDarkBg,
      header: PALETTE.slate800,
      surface: PALETTE.slate850,
      surface2: PALETTE.slate800,
    },
    text: {
      heading: PALETTE.white,
      primary: PALETTE.white,
      body: PALETTE.slate180,
      // Common "secondary text on dark" used across the app (e.g. helper labels).
      secondary: PALETTE.slate250,
      muted: PALETTE.slate300,
      inverse: PALETTE.slate900,
    },
    border: {
      subtle: PALETTE.slate750,
      default: PALETTE.slate700,
    },
    brand: { primary: PALETTE.brandBlue, link: PALETTE.linkBlueDark },
    status: {
      errorText: PALETTE.dangerRedSoft,
      danger: PALETTE.dangerRed,
      dangerSoft: PALETTE.dangerRedSoft,
      success: PALETTE.successGreen,
      successBg: PALETTE.successBg,
    },
  },
};

export const APP_THEME_COLORS: Record<'light' | 'dark', AppThemeColors> = {
  light: {
    appBackground: APP_COLORS.light.bg.app,
    appForeground: APP_COLORS.light.text.primary,
    spinnerOnLight: APP_COLORS.light.text.primary,
  },
  dark: {
    appBackground: APP_COLORS.dark.bg.app,
    appForeground: APP_COLORS.dark.text.primary,
    spinnerOnLight: APP_COLORS.dark.text.primary,
  },
};

export function getAppThemeColors(isDark: boolean): AppThemeColors {
  return isDark ? APP_THEME_COLORS.dark : APP_THEME_COLORS.light;
}

export function getAppColors(isDark: boolean): SemanticAppColors {
  return isDark ? APP_COLORS.dark : APP_COLORS.light;
}
