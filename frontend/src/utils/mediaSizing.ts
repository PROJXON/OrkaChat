export type CappedMediaSize = { w: number; h: number };

export function calcCappedMediaSize(opts: {
  aspect?: number | null | undefined;
  availableWidth: number;
  maxWidthFraction?: number;
  maxHeight?: number;
  minMaxWidth?: number;
  minAspect?: number;
  minW?: number;
  minH?: number;
  minHInitial?: number;
  minWWhenCapped?: number;
  rounding?: 'floor' | 'round';
}): CappedMediaSize {
  const frac =
    typeof opts.maxWidthFraction === 'number' && Number.isFinite(opts.maxWidthFraction)
      ? opts.maxWidthFraction
      : 0.86;
  const maxH =
    typeof opts.maxHeight === 'number' && Number.isFinite(opts.maxHeight) ? opts.maxHeight : 240;
  const minMaxW =
    typeof opts.minMaxWidth === 'number' && Number.isFinite(opts.minMaxWidth)
      ? opts.minMaxWidth
      : 220;
  const minAspect =
    typeof opts.minAspect === 'number' && Number.isFinite(opts.minAspect) ? opts.minAspect : 0;
  const rounding: 'floor' | 'round' = opts.rounding === 'round' ? 'round' : 'floor';

  const minW = typeof opts.minW === 'number' && Number.isFinite(opts.minW) ? opts.minW : 0;
  const minH = typeof opts.minH === 'number' && Number.isFinite(opts.minH) ? opts.minH : 0;
  const minHInitial =
    typeof opts.minHInitial === 'number' && Number.isFinite(opts.minHInitial)
      ? opts.minHInitial
      : undefined;
  const minWWhenCapped =
    typeof opts.minWWhenCapped === 'number' && Number.isFinite(opts.minWWhenCapped)
      ? opts.minWWhenCapped
      : undefined;

  const a0 =
    typeof opts.aspect === 'number' && Number.isFinite(opts.aspect) && opts.aspect > 0
      ? opts.aspect
      : 1;
  const a = Math.max(minAspect, a0);

  const aw =
    typeof opts.availableWidth === 'number' &&
    Number.isFinite(opts.availableWidth) &&
    opts.availableWidth > 0
      ? opts.availableWidth
      : 0;
  const maxW = Math.max(minMaxW, Math.floor(aw * frac));

  let w = maxW;
  let h = rounding === 'round' ? Math.round(w / a) : Math.floor(w / a);
  if (typeof minHInitial === 'number') h = Math.max(minHInitial, h);

  if (h > maxH) {
    h = maxH;
    let w2 = rounding === 'round' ? Math.round(h * a) : Math.floor(h * a);
    if (typeof minWWhenCapped === 'number') w2 = Math.max(minWWhenCapped, w2);
    w = Math.min(maxW, w2);
  }

  w = Math.max(minW, w);
  h = Math.max(minH, h);
  return { w, h };
}
