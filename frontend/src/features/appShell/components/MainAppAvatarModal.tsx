import { uploadData } from 'aws-amplify/storage';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppStyles } from '../../../../App.styles';
import { AnimatedDots } from '../../../components/AnimatedDots';
import {
  AVATAR_DEFAULT_COLORS,
  AvatarBubble,
  pickDefaultAvatarColor,
} from '../../../components/AvatarBubble';
import { APP_COLORS } from '../../../theme/colors';
import type { AvatarState } from '../hooks/useMyAvatarSettings';

type CropPixels = { x: number; y: number; width: number; height: number };
type WebCrop = { unit: '%'; x: number; y: number; width: number; height: number };

async function loadImage(src: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    // For public CDN URLs this avoids tainting the canvas; for local file/blob URLs it’s harmless.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

async function cropToSquareJpegBlobWeb(args: {
  imageSrc: string;
  cropPixels: CropPixels;
  size: number;
  quality: number;
}): Promise<Blob> {
  const img = await loadImage(args.imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = args.size;
  canvas.height = args.size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  const c = args.cropPixels;
  ctx.drawImage(img, c.x, c.y, c.width, c.height, 0, 0, args.size, args.size);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to create image blob'))),
      'image/jpeg',
      args.quality,
    );
  });
  return blob;
}

export function MainAppAvatarModal({
  styles,
  isDark,
  myUserSub,
  displayName,
  // Open/close
  avatarOpen,
  setAvatarOpen,
  // Saving
  avatarSaving,
  setAvatarSaving,
  avatarSavingRef,
  // Errors
  avatarError,
  setAvatarError,
  // Persisted avatar + draft state
  myAvatar,
  setMyAvatar,
  avatarDraft,
  setAvatarDraft,
  avatarDraftImageUri,
  setAvatarDraftImageUri,
  avatarDraftRemoveImage,
  setAvatarDraftRemoveImage,
  // Persist to storage/server
  saveAvatarToStorageAndServer,
}: {
  styles: AppStyles;
  isDark: boolean;
  myUserSub: string | null | undefined;
  displayName: string;

  avatarOpen: boolean;
  setAvatarOpen: (v: boolean) => void;

  avatarSaving: boolean;
  setAvatarSaving: (v: boolean) => void;
  avatarSavingRef: React.MutableRefObject<boolean>;

  avatarError: string | null;
  setAvatarError: (v: string | null) => void;

  myAvatar: AvatarState;
  setMyAvatar: React.Dispatch<React.SetStateAction<AvatarState>>;
  avatarDraft: AvatarState;
  setAvatarDraft: React.Dispatch<React.SetStateAction<AvatarState>>;
  avatarDraftImageUri: string | null;
  setAvatarDraftImageUri: (v: string | null) => void;
  avatarDraftRemoveImage: boolean;
  setAvatarDraftRemoveImage: (v: boolean) => void;

  saveAvatarToStorageAndServer: (next: {
    bgColor?: string;
    textColor?: string;
    imagePath?: string;
  }) => Promise<void>;
}): React.JSX.Element {
  const cropperModule = React.useMemo(() => {
    if (Platform.OS !== 'web') return null;
    try {
      // Lazy require so native builds never load DOM-dependent code.
      // Also load the cropper CSS (required for resize handles).
      try {
        require('react-image-crop/dist/ReactCrop.css');
      } catch {
        // If CSS import isn't supported by the bundler, the cropper will still render but may look plain.
      }

      return require('react-image-crop') as {
        ReactCrop: React.ComponentType<Record<string, unknown>>;
      };
    } catch {
      return null;
    }
  }, []);
  const WebCropper = cropperModule?.ReactCrop ?? null;

  const [webCropOpen, setWebCropOpen] = React.useState(false);
  const [webCropSrc, setWebCropSrc] = React.useState<string | null>(null);
  const [webCrop, setWebCrop] = React.useState<WebCrop>({
    unit: '%',
    x: 10,
    y: 10,
    width: 80,
    height: 80,
  });
  const webCropPixelsRef = React.useRef<CropPixels | null>(null);
  const webCropImgRef = React.useRef<HTMLImageElement | null>(null);
  const webCroppedBlobRef = React.useRef<Blob | null>(null);

  const revokeWebPreviewUrlIfNeeded = React.useCallback((uri: string | null) => {
    if (Platform.OS !== 'web') return;
    const u = String(uri || '').trim();
    if (u.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(u);
      } catch {
        // ignore
      }
    }
  }, []);

  const discardDraft = React.useCallback(() => {
    if (avatarSavingRef.current) return;
    // Discard draft changes unless saved.
    setAvatarOpen(false);
    setAvatarDraft(myAvatar);
    revokeWebPreviewUrlIfNeeded(avatarDraftImageUri);
    setAvatarDraftImageUri(null);
    setAvatarDraftRemoveImage(false);
    setWebCropOpen(false);
    setWebCropSrc(null);
    webCropPixelsRef.current = null;
    webCroppedBlobRef.current = null;
  }, [
    avatarSavingRef,
    avatarDraftImageUri,
    myAvatar,
    setAvatarDraft,
    setAvatarDraftImageUri,
    setAvatarDraftRemoveImage,
    setAvatarOpen,
    revokeWebPreviewUrlIfNeeded,
  ]);

  const WebCropperComp = WebCropper as React.ComponentType<Record<string, unknown>> | null;

  return (
    <>
      <Modal visible={avatarOpen} transparent animationType="fade" onRequestClose={discardDraft}>
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            disabled={avatarSaving}
            onPress={discardDraft}
          />
          <View style={[styles.profileCard, isDark ? styles.profileCardDark : null]}>
            <View style={styles.chatsTopRow}>
              <Text style={[styles.modalTitle, isDark ? styles.modalTitleDark : null]}>Avatar</Text>
            </View>

            <View style={styles.profilePreviewRow}>
              <AvatarBubble
                seed={String(myUserSub || displayName)}
                label={displayName}
                size={44}
                backgroundColor={
                  avatarDraft.bgColor || pickDefaultAvatarColor(String(myUserSub || displayName))
                }
                textColor={avatarDraft.textColor || '#fff'}
                imageUri={avatarDraftImageUri || avatarDraft.imageUri}
                imageBgColor={isDark ? APP_COLORS.dark.bg.header : APP_COLORS.light.bg.surface2}
              />
              <View style={styles.profilePreviewMeta}>
                <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null]}>
                  Pick colors or upload a photo (you can zoom/crop)
                </Text>
              </View>
            </View>

            {avatarError ? (
              <Text style={[styles.errorText, isDark && styles.errorTextDark]}>{avatarError}</Text>
            ) : null}

            {avatarDraftImageUri || avatarDraft.imageUri ? (
              <Text
                style={[
                  styles.modalHelperText,
                  isDark ? styles.modalHelperTextDark : null,
                  { marginTop: 6 },
                ]}
              >
                Photo avatar enabled - remove the photo to edit bubble/text colors
              </Text>
            ) : (
              <>
                <Text
                  style={[
                    styles.modalHelperText,
                    isDark ? styles.modalHelperTextDark : null,
                    styles.profileSectionTitle,
                  ]}
                >
                  Bubble color
                </Text>
                <View style={styles.avatarPaletteRow}>
                  {AVATAR_DEFAULT_COLORS.map((c) => {
                    const selected = (avatarDraft.bgColor || '') === c;
                    return (
                      <Pressable
                        key={`bg:${c}`}
                        onPress={() => setAvatarDraft((prev) => ({ ...prev, bgColor: c }))}
                        style={[
                          styles.avatarColorDot,
                          { backgroundColor: c },
                          selected
                            ? isDark
                              ? styles.avatarColorDotSelectedDark
                              : styles.avatarColorDotSelected
                            : null,
                        ]}
                      />
                    );
                  })}
                </View>

                <Text
                  style={[
                    styles.modalHelperText,
                    isDark ? styles.modalHelperTextDark : null,
                    styles.profileSectionTitle,
                  ]}
                >
                  Text color
                </Text>
                <View style={styles.avatarTextColorRow}>
                  <Pressable
                    onPress={() => setAvatarDraft((prev) => ({ ...prev, textColor: '#fff' }))}
                    style={[
                      styles.avatarTextColorBtn,
                      isDark ? styles.avatarTextColorBtnDark : null,
                      (avatarDraft.textColor || '#fff') === '#fff'
                        ? isDark
                          ? styles.avatarTextColorBtnSelectedDark
                          : styles.avatarTextColorBtnSelected
                        : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.avatarTextColorLabel,
                        isDark ? styles.avatarTextColorLabelDark : null,
                      ]}
                    >
                      White
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setAvatarDraft((prev) => ({ ...prev, textColor: '#111' }))}
                    style={[
                      styles.avatarTextColorBtn,
                      isDark ? styles.avatarTextColorBtnDark : null,
                      (avatarDraft.textColor || '#fff') === '#111'
                        ? isDark
                          ? styles.avatarTextColorBtnSelectedDark
                          : styles.avatarTextColorBtnSelected
                        : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.avatarTextColorLabel,
                        isDark ? styles.avatarTextColorLabelDark : null,
                      ]}
                    >
                      Black
                    </Text>
                  </Pressable>
                </View>
              </>
            )}

            <View style={styles.profileActionsRow}>
              <Pressable
                disabled={avatarSaving}
                style={({ pressed }) => [
                  styles.toolBtn,
                  isDark && styles.toolBtnDark,
                  avatarSaving ? { opacity: 0.5 } : null,
                  pressed && !avatarSaving ? { opacity: 0.92 } : null,
                ]}
                onPress={async () => {
                  try {
                    setAvatarError(null);
                    setAvatarDraftRemoveImage(false);
                    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (!perm.granted) {
                      setAvatarError('Please allow photo library access to choose an avatar.');
                      return;
                    }
                    const result = await ImagePicker.launchImageLibraryAsync({
                      // Avoid deprecated MediaTypeOptions while staying compatible with older typings.
                      mediaTypes: ImagePicker.MediaTypeOptions.Images,
                      // Native: use built-in crop UI. Web: we'll show our own cropper.
                      allowsEditing: Platform.OS !== 'web',
                      aspect: [1, 1],
                      quality: 0.9,
                    });
                    if (result.canceled) return;
                    const uri = result.assets?.[0]?.uri;
                    if (!uri) return;
                    // Web: show crop/zoom step (matches native UX).
                    if (Platform.OS === 'web' && WebCropper) {
                      setWebCropSrc(uri);
                      // Start centered and full-size so it feels “zoomed in” even for tiny images.
                      setWebCrop({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
                      webCropPixelsRef.current = null;
                      setWebCropOpen(true);
                      return;
                    }
                    revokeWebPreviewUrlIfNeeded(avatarDraftImageUri);
                    setAvatarDraftImageUri(uri);
                  } catch (e: unknown) {
                    setAvatarError(e instanceof Error ? e.message : 'Could not pick image.');
                  }
                }}
                accessibilityRole="button"
                accessibilityState={{ disabled: avatarSaving }}
              >
                <Text style={[styles.toolBtnText, isDark && styles.toolBtnTextDark]}>
                  Upload photo
                </Text>
              </Pressable>

              {/* Disable "Remove photo" when there's nothing to remove, and while saving. */}
              <Pressable
                disabled={avatarSaving || (!avatarDraftImageUri && !avatarDraft.imageUri)}
                style={({ pressed }) => [
                  styles.toolBtn,
                  isDark && styles.toolBtnDark,
                  avatarSaving || (!avatarDraftImageUri && !avatarDraft.imageUri)
                    ? { opacity: 0.5 }
                    : null,
                  pressed && !(avatarSaving || (!avatarDraftImageUri && !avatarDraft.imageUri))
                    ? { opacity: 0.92 }
                    : null,
                ]}
                onPress={() => {
                  revokeWebPreviewUrlIfNeeded(avatarDraftImageUri);
                  setAvatarDraftImageUri(null);
                  webCroppedBlobRef.current = null;
                  setAvatarDraftRemoveImage(true);
                  // Only change draft state; commit happens on Save.
                  setAvatarDraft((prev) => ({
                    ...prev,
                    imagePath: undefined,
                    imageUri: undefined,
                  }));
                }}
                accessibilityRole="button"
                accessibilityState={{
                  disabled: avatarSaving || (!avatarDraftImageUri && !avatarDraft.imageUri),
                }}
              >
                <Text style={[styles.toolBtnText, isDark && styles.toolBtnTextDark]}>
                  Remove photo
                </Text>
              </Pressable>
            </View>

            <View style={[styles.modalButtons, { marginTop: 10 }]}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalButtonSmall,
                  isDark ? styles.modalButtonDark : null,
                  pressed ? { opacity: 0.92 } : null,
                ]}
                onPress={async () => {
                  const sub = String(myUserSub || '').trim();
                  if (!sub) return;
                  avatarSavingRef.current = true;
                  setAvatarSaving(true);
                  setAvatarError(null);
                  try {
                    let nextImagePath = avatarDraft.imagePath;

                    if (avatarDraftImageUri) {
                      const blob = await (async () => {
                        // Web: if we already cropped, we can upload the blob directly.
                        if (Platform.OS === 'web' && webCroppedBlobRef.current) {
                          return webCroppedBlobRef.current;
                        }
                        // Native: normalize to a square JPEG (256x256) after user crop.
                        const normalized = await ImageManipulator.manipulateAsync(
                          avatarDraftImageUri,
                          [{ resize: { width: 256, height: 256 } }],
                          { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
                        );
                        return await (await fetch(normalized.uri)).blob();
                      })();
                      // Store avatars under uploads/public/avatars/* so both authenticated users and guests can resolve them.
                      const path = `uploads/public/avatars/${sub}/${Date.now()}.jpg`;
                      await uploadData({ path, data: blob, options: { contentType: 'image/jpeg' } })
                        .result;
                      nextImagePath = path;
                      webCroppedBlobRef.current = null;
                      setAvatarDraftImageUri(null);
                      setAvatarDraftRemoveImage(false);
                    }

                    const next = {
                      bgColor: avatarDraft.bgColor,
                      textColor: avatarDraft.textColor || '#fff',
                      // undefined => omit key (no change), '' => explicit clear
                      imagePath: avatarDraftRemoveImage ? '' : nextImagePath,
                    };

                    // Update local state first so UI feels instant.
                    setMyAvatar((prev) => ({ ...prev, ...next, imageUri: undefined }));
                    await saveAvatarToStorageAndServer(next);
                    setAvatarOpen(false);
                  } catch (e: unknown) {
                    setAvatarError(e instanceof Error ? e.message : 'Failed to save avatar.');
                  } finally {
                    avatarSavingRef.current = false;
                    setAvatarSaving(false);
                  }
                }}
                disabled={avatarSaving}
              >
                {avatarSaving ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 2,
                    }}
                  >
                    <Text
                      style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}
                    >
                      Saving
                    </Text>
                    <AnimatedDots
                      color={isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary}
                      size={18}
                    />
                  </View>
                ) : (
                  <Text
                    style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}
                  >
                    Save
                  </Text>
                )}
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalButtonSmall,
                  isDark ? styles.modalButtonDark : null,
                  pressed ? { opacity: 0.92 } : null,
                ]}
                onPress={discardDraft}
                disabled={avatarSaving}
              >
                <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>
                  Close
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Web-only cropper (native uses ImagePicker allowsEditing) */}
      {Platform.OS === 'web' && WebCropperComp ? (
        <Modal
          visible={webCropOpen}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setWebCropOpen(false);
            setWebCropSrc(null);
            webCropPixelsRef.current = null;
          }}
        >
          <View style={styles.modalOverlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => {
                setWebCropOpen(false);
                setWebCropSrc(null);
                webCropPixelsRef.current = null;
              }}
            />
            <View style={[styles.profileCard, isDark ? styles.profileCardDark : null]}>
              <View style={styles.chatsTopRow}>
                <Text style={[styles.modalTitle, isDark ? styles.modalTitleDark : null]}>
                  Crop avatar
                </Text>
              </View>

              {/* Use a square crop viewport so the initial selection feels consistent. */}
              <View style={{ width: 260, height: 260, alignSelf: 'center' }}>
                {webCropSrc ? (
                  <WebCropperComp
                    crop={webCrop}
                    aspect={1}
                    keepSelection
                    onChange={(_c1: unknown, c2?: unknown) => {
                      // react-image-crop calls onChange(crop, percentCrop)
                      const raw = (c2 ?? _c1) as Partial<WebCrop> | undefined;
                      const x = Number(raw?.x ?? 0);
                      const y = Number(raw?.y ?? 0);
                      const width = Number(raw?.width ?? 0);
                      const height = Number(raw?.height ?? 0);
                      if (![x, y, width, height].every((n) => Number.isFinite(n))) return;
                      // Force % units so we can keep it responsive.
                      setWebCrop({ unit: '%', x, y, width, height });
                    }}
                    onComplete={(_c1: unknown, c2?: unknown) => {
                      const img = webCropImgRef.current;
                      const c = (c2 ?? _c1) as Partial<WebCrop> | undefined;
                      const cropObj = c && typeof c === 'object' ? c : null;
                      if (!img || !cropObj || cropObj.unit !== '%') return;
                      // Convert % crop (viewport coords) to natural pixel crop, accounting for object-fit: cover.
                      const xPct = Number(cropObj.x ?? 0);
                      const yPct = Number(cropObj.y ?? 0);
                      const wPct = Number(cropObj.width ?? 0);
                      const hPct = Number(cropObj.height ?? 0);
                      if (![xPct, yPct, wPct, hPct].every((n) => Number.isFinite(n))) return;

                      const rect = img.getBoundingClientRect();
                      const viewW = Math.max(1, rect.width);
                      const viewH = Math.max(1, rect.height);
                      const natW = Math.max(1, img.naturalWidth);
                      const natH = Math.max(1, img.naturalHeight);

                      // For cover, the scaled image may overflow the viewport and is centered.
                      const scale = Math.max(viewW / natW, viewH / natH);
                      const scaledW = natW * scale;
                      const scaledH = natH * scale;
                      const offsetX = Math.max(0, (scaledW - viewW) / 2);
                      const offsetY = Math.max(0, (scaledH - viewH) / 2);

                      const xView = (xPct / 100) * viewW;
                      const yView = (yPct / 100) * viewH;
                      const wView = (wPct / 100) * viewW;
                      const hView = (hPct / 100) * viewH;

                      const xNat = (xView + offsetX) / scale;
                      const yNat = (yView + offsetY) / scale;
                      const wNat = wView / scale;
                      const hNat = hView / scale;

                      webCropPixelsRef.current = {
                        x: Math.max(0, Math.floor(xNat)),
                        y: Math.max(0, Math.floor(yNat)),
                        width: Math.max(1, Math.floor(Math.min(wNat, natW - xNat))),
                        height: Math.max(1, Math.floor(Math.min(hNat, natH - yNat))),
                      };
                    }}
                  >
                    <img
                      ref={webCropImgRef}
                      src={webCropSrc}
                      // Fill the square viewport without letterboxing so the crop can’t include “empty space”.
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                        borderRadius: 12,
                      }}
                      alt="Crop avatar"
                      onLoad={(e) => {
                        // Ensure "Done" works immediately without forcing the user to drag first.
                        const img = e.currentTarget;
                        const natW = Math.max(1, img.naturalWidth);
                        const natH = Math.max(1, img.naturalHeight);
                        const size = Math.min(natW, natH);
                        webCropPixelsRef.current = {
                          x: Math.floor((natW - size) / 2),
                          y: Math.floor((natH - size) / 2),
                          width: Math.max(1, Math.floor(size)),
                          height: Math.max(1, Math.floor(size)),
                        };
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
                    try {
                      if (!webCropSrc) return;
                      const px = webCropPixelsRef.current;
                      if (!px) return;
                      const blob = await cropToSquareJpegBlobWeb({
                        imageSrc: webCropSrc,
                        cropPixels: px,
                        size: 256,
                        quality: 0.9,
                      });
                      const previewUrl = URL.createObjectURL(blob);
                      revokeWebPreviewUrlIfNeeded(avatarDraftImageUri);
                      webCroppedBlobRef.current = blob;
                      setAvatarDraftImageUri(previewUrl);
                      setWebCropOpen(false);
                      setWebCropSrc(null);
                      webCropPixelsRef.current = null;
                    } catch (e: unknown) {
                      setAvatarError(e instanceof Error ? e.message : 'Crop failed');
                      setWebCropOpen(false);
                      setWebCropSrc(null);
                      webCropPixelsRef.current = null;
                    }
                  }}
                >
                  <Text
                    style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}
                  >
                    Done
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.modalButton,
                    styles.modalButtonSmall,
                    isDark ? styles.modalButtonDark : null,
                  ]}
                  onPress={() => {
                    setWebCropOpen(false);
                    setWebCropSrc(null);
                    webCropPixelsRef.current = null;
                  }}
                >
                  <Text
                    style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}
                  >
                    Cancel
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}
