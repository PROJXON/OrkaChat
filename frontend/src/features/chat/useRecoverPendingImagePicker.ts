import * as React from 'react';
import type { PendingMediaItem } from './attachments';

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

/**
 * If Android kills the activity while the picker is open, expo-image-picker can return
 * a "pending result" on next launch. This hook recovers it and merges into pending media.
 */
export function useRecoverPendingImagePicker(opts: {
  /** Change this when attachment mode changes so we re-check. */
  trigger: unknown;
  getPendingResultAsync: () => Promise<unknown>;
  pendingMediaFromImagePickerAssets: (assets: unknown[]) => PendingMediaItem[];
  mergeRecoveredPickerItems: (items: PendingMediaItem[]) => void;
}): void {
  const { trigger, getPendingResultAsync, pendingMediaFromImagePickerAssets, mergeRecoveredPickerItems } = opts;

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pendingRaw: unknown = await getPendingResultAsync();
        if (cancelled) return;
        const pending = isRecord(pendingRaw) ? pendingRaw : {};
        if (pending.canceled === true) return;
        const assets = Array.isArray(pending.assets) ? (pending.assets as unknown[]) : [];
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

