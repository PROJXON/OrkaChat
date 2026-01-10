import * as React from 'react';

/**
 * If Android kills the activity while the picker is open, expo-image-picker can return
 * a "pending result" on next launch. This hook recovers it and merges into pending media.
 */
export function useRecoverPendingImagePicker(opts: {
  /** Change this when attachment mode changes so we re-check. */
  trigger: unknown;
  getPendingResultAsync: () => Promise<unknown>;
  pendingMediaFromImagePickerAssets: (assets: unknown[]) => any[];
  mergeRecoveredPickerItems: (items: any[]) => void;
}): void {
  const { trigger, getPendingResultAsync, pendingMediaFromImagePickerAssets, mergeRecoveredPickerItems } = opts;

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pending: any = await getPendingResultAsync();
        if (cancelled) return;
        if (!pending || pending.canceled) return;
        const assets = Array.isArray(pending.assets) ? pending.assets : [];
        if (!assets.length) return;
        const items = pendingMediaFromImagePickerAssets(assets);
        if (!items.length) return;
        mergeRecoveredPickerItems(items);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trigger, getPendingResultAsync, pendingMediaFromImagePickerAssets, mergeRecoveredPickerItems]);
}

