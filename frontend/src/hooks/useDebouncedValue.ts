import * as React from 'react';

export function useDebouncedValue<T>(value: T, delayMs: number, enabled: boolean = true): T {
  const [debounced, setDebounced] = React.useState<T>(value);

  React.useEffect(() => {
    if (!enabled) return;
    const ms =
      typeof delayMs === 'number' && Number.isFinite(delayMs) && delayMs >= 0 ? delayMs : 0;
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, delayMs, enabled]);

  // Keep the debounced value in sync when disabled.
  React.useEffect(() => {
    if (enabled) return;
    setDebounced(value);
  }, [enabled, value]);

  return debounced;
}
