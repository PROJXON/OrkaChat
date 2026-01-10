import { Platform } from 'react-native';

/**
 * Best-effort check for "mobile-like" web devices (phones/tablets) where wide breakpoints
 * based purely on width can misfire in landscape.
 */
export function isWebCoarsePointer(): boolean {
  if (Platform.OS !== 'web') return false;
  if (typeof window === 'undefined') return false;

  try {
    if (typeof window.matchMedia === 'function') {
      // Prefer "any-*" queries; they tend to behave better across mobile browsers / emulators.
      if (window.matchMedia('(any-pointer: coarse)').matches) return true;
      if (window.matchMedia('(pointer: coarse)').matches) return true;
      // Most touch devices report no hover capability.
      if (window.matchMedia('(any-hover: none)').matches) return true;
      if (window.matchMedia('(hover: none)').matches) return true;
    }
  } catch {
    // ignore
  }

  // Fallback: touch-capable browsers often expose maxTouchPoints.
  try {
    const nav: any = typeof navigator !== 'undefined' ? navigator : undefined;
    const maxTouchPoints = typeof nav?.maxTouchPoints === 'number' ? nav.maxTouchPoints : 0;
    if (maxTouchPoints > 0) return true;

    // Last resort: user-agent sniff (helps Android emulator / odd WebViews).
    const ua = String(nav?.userAgent || '').toLowerCase();
    if (ua.includes('android') || ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return true;
    return false;
  } catch {
    return false;
  }
}

export function computeIsWideLayout({
  width,
  height,
  wideBreakpointPx = 900,
  minHeightPx = 600,
}: {
  width: number;
  height: number;
  wideBreakpointPx?: number;
  minHeightPx?: number;
}): boolean {
  const w = Number.isFinite(width) ? width : 0;
  const h = Number.isFinite(height) ? height : 0;
  const shortHeight = h > 0 && h < minHeightPx;
  // On touch/coarse-pointer web, treat layout as "not wide" even if the width crosses the breakpoint.
  const coarse = isWebCoarsePointer();
  return w >= wideBreakpointPx && !shortHeight && !coarse;
}
