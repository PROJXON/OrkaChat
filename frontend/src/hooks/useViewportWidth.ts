import * as React from 'react';

export function useViewportWidth(windowWidth: number, opts?: { wideBreakpointPx?: number; maxContentWidthPx?: number }): {
  isWide: boolean;
  viewportWidth: number;
  wideBreakpointPx: number;
  maxContentWidthPx: number;
} {
  const wideBreakpointPx = typeof opts?.wideBreakpointPx === 'number' ? opts.wideBreakpointPx : 900;
  const maxContentWidthPx = typeof opts?.maxContentWidthPx === 'number' ? opts.maxContentWidthPx : 1040;
  const isWide = windowWidth >= wideBreakpointPx;
  const viewportWidth = isWide ? Math.min(windowWidth, maxContentWidthPx) : windowWidth;

  return React.useMemo(
    () => ({ isWide, viewportWidth, wideBreakpointPx, maxContentWidthPx }),
    [isWide, viewportWidth, wideBreakpointPx, maxContentWidthPx],
  );
}

