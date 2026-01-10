export function throttleByRef(opts: {
  lastAtRef: { current: number };
  minIntervalMs: number;
  now?: number;
  run: () => void;
}): void {
  const minIntervalMs = Number.isFinite(opts.minIntervalMs) ? Math.max(0, Math.floor(opts.minIntervalMs)) : 0;
  const now = typeof opts.now === 'number' && Number.isFinite(opts.now) ? opts.now : Date.now();
  const prev = opts.lastAtRef.current || 0;
  if (now - prev > minIntervalMs) {
    opts.lastAtRef.current = now;
    opts.run();
  }
}

