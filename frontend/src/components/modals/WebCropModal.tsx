import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import type { AppStyles } from '../../../App.styles';
import type { CropPixels } from '../../utils/webImageCrop';
import {
  centeredAspectCropPixels,
  cropToJpegBlobWeb,
  percentCropToPixelsWeb,
} from '../../utils/webImageCrop';

type WebPercentCrop = { unit: '%'; x: number; y: number; width: number; height: number };

export function WebCropModal({
  styles,
  isDark,
  visible,
  title,
  imageSrc,
  aspect,
  previewObjectFit = 'cover',
  viewportWidth,
  viewportHeight,
  viewportMaxWidth,
  viewportMaxHeight,
  outWidth,
  outHeight,
  quality,
  onCancel,
  onDone,
}: {
  styles: AppStyles;
  isDark: boolean;
  visible: boolean;
  title: string;
  imageSrc: string | null;
  aspect: number;
  previewObjectFit?: 'cover' | 'contain';
  viewportWidth?: number;
  viewportHeight?: number;
  viewportMaxWidth?: number;
  viewportMaxHeight?: number;
  outWidth: number;
  outHeight: number;
  quality: number;
  onCancel: () => void;
  onDone: (args: { blob: Blob; cropPixels: CropPixels }) => void | Promise<void>;
}): React.JSX.Element | null {
  const win = useWindowDimensions();
  const cropperModule = React.useMemo(() => {
    if (Platform.OS !== 'web') return null;
    try {
      try {
        require('react-image-crop/dist/ReactCrop.css');
      } catch {
        // ignore
      }
      return require('react-image-crop') as {
        ReactCrop: React.ComponentType<Record<string, unknown>>;
        centerCrop?: (
          crop: Record<string, unknown>,
          mediaWidth: number,
          mediaHeight: number,
        ) => Record<string, unknown>;
        makeAspectCrop?: (
          crop: Record<string, unknown>,
          aspect: number,
          mediaWidth: number,
          mediaHeight: number,
        ) => Record<string, unknown>;
      };
    } catch {
      return null;
    }
  }, []);
  const WebCropper = cropperModule?.ReactCrop ?? null;
  const WebCropperComp = WebCropper as React.ComponentType<Record<string, unknown>> | null;

  const [crop, setCrop] = React.useState<WebPercentCrop>({
    unit: '%',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  });
  const cropPixelsRef = React.useRef<CropPixels | null>(null);
  const imgRef = React.useRef<HTMLImageElement | null>(null);

  React.useEffect(() => {
    if (!visible) return;
    setCrop({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
    cropPixelsRef.current = null;
  }, [visible, imageSrc]);

  const computedViewport = React.useMemo(() => {
    // If caller provided explicit sizes, use them.
    if (typeof viewportWidth === 'number' && typeof viewportHeight === 'number') {
      return { width: viewportWidth, height: viewportHeight };
    }

    // Otherwise, compute a responsive viewport that preserves aspect ratio and fits the screen.
    // Leave room for title + helper text + buttons (so don't consume full height).
    const maxW = Math.max(240, Math.min(viewportMaxWidth ?? 440, win.width * 0.86));
    // Our cards cap at ~70% height; reserve space for non-viewport UI so buttons don't "fall out".
    const cardMaxH = win.height * 0.7;
    const reserved = 180; // title + helper + buttons + padding
    const availableH = Math.max(200, cardMaxH - reserved);
    const maxH = Math.min(viewportMaxHeight ?? availableH, availableH, win.height * 0.56);

    // Ideal height from width, then clamp to maxH; if clamped, recompute width from height.
    let w = maxW;
    let h = w / Math.max(0.0001, aspect);
    if (h > maxH) {
      h = maxH;
      w = h * Math.max(0.0001, aspect);
    }

    return { width: Math.floor(w), height: Math.floor(h) };
  }, [
    aspect,
    viewportHeight,
    viewportMaxHeight,
    viewportMaxWidth,
    viewportWidth,
    win.height,
    win.width,
  ]);

  if (Platform.OS !== 'web') return null;
  if (!WebCropperComp) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={[styles.profileCard, isDark ? styles.profileCardDark : null]}>
          <View style={styles.chatsTopRow}>
            <Text style={[styles.modalTitle, isDark ? styles.modalTitleDark : null]}>{title}</Text>
          </View>

          <View
            style={{
              width: computedViewport.width,
              height: computedViewport.height,
              alignSelf: 'center',
              marginTop: 6,
            }}
          >
            {imageSrc ? (
              <WebCropperComp
                crop={crop}
                aspect={aspect}
                keepSelection
                onChange={(_c1: unknown, c2?: unknown) => {
                  // react-image-crop calls onChange(crop, percentCrop)
                  const raw = (c2 ?? _c1) as Partial<WebPercentCrop> | undefined;
                  const x = Number(raw?.x ?? 0);
                  const y = Number(raw?.y ?? 0);
                  const width = Number(raw?.width ?? 0);
                  const height = Number(raw?.height ?? 0);
                  if (![x, y, width, height].every((n) => Number.isFinite(n))) return;
                  setCrop({ unit: '%', x, y, width, height });
                }}
                onComplete={(_c1: unknown, c2?: unknown) => {
                  const img = imgRef.current;
                  const raw = (c2 ?? _c1) as Partial<WebPercentCrop> | undefined;
                  if (!img || !raw) return;
                  const pct = {
                    x: Number(raw.x ?? 0),
                    y: Number(raw.y ?? 0),
                    width: Number(raw.width ?? 0),
                    height: Number(raw.height ?? 0),
                  };
                  if (![pct.x, pct.y, pct.width, pct.height].every((n) => Number.isFinite(n)))
                    return;
                  const px = percentCropToPixelsWeb({
                    img,
                    percentCrop: pct,
                    objectFit: previewObjectFit,
                  });
                  if (px) cropPixelsRef.current = px;
                }}
              >
                <img
                  ref={imgRef}
                  src={imageSrc}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: previewObjectFit,
                    display: 'block',
                    borderRadius: 12,
                  }}
                  alt={title}
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    try {
                      const mod = cropperModule;
                      if (mod?.centerCrop && mod?.makeAspectCrop) {
                        const mw = Math.max(1, img.naturalWidth);
                        const mh = Math.max(1, img.naturalHeight);
                        const next = mod.centerCrop(
                          mod.makeAspectCrop({ unit: '%', width: 90 }, aspect, mw, mh),
                          mw,
                          mh,
                        ) as Partial<WebPercentCrop>;
                        if (
                          next &&
                          next.unit === '%' &&
                          typeof next.x === 'number' &&
                          typeof next.y === 'number' &&
                          typeof next.width === 'number' &&
                          typeof next.height === 'number'
                        ) {
                          setCrop({
                            unit: '%',
                            x: next.x,
                            y: next.y,
                            width: next.width,
                            height: next.height,
                          });
                        }
                      }
                    } catch {
                      // ignore
                    }
                    cropPixelsRef.current = centeredAspectCropPixels({ img, aspect });
                  }}
                />
              </WebCropperComp>
            ) : null}
          </View>

          <Text
            style={[
              styles.modalHelperText,
              isDark ? styles.modalHelperTextDark : null,
              { marginTop: 10 },
            ]}
          >
            Drag the crop box handles to resize. Drag the box to reposition.
          </Text>

          <View style={[styles.modalButtons, { marginTop: 10 }]}>
            <Pressable
              style={[
                styles.modalButton,
                styles.modalButtonSmall,
                isDark ? styles.modalButtonDark : null,
              ]}
              onPress={async () => {
                if (!imageSrc) return;
                const px = cropPixelsRef.current;
                if (!px) return;
                const blob = await cropToJpegBlobWeb({
                  imageSrc,
                  cropPixels: px,
                  outWidth,
                  outHeight,
                  quality,
                });
                await onDone({ blob, cropPixels: px });
              }}
            >
              <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>
                Done
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.modalButton,
                styles.modalButtonSmall,
                isDark ? styles.modalButtonDark : null,
              ]}
              onPress={onCancel}
            >
              <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
