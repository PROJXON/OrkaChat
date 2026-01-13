import { uploadData } from 'aws-amplify/storage';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { AppStyles } from '../../../../App.styles';
import { AnimatedDots } from '../../../components/AnimatedDots';
import {
  AVATAR_DEFAULT_COLORS,
  AvatarBubble,
  pickDefaultAvatarColor,
} from '../../../components/AvatarBubble';
import { WebCropModal } from '../../../components/modals/WebCropModal';
import { APP_COLORS } from '../../../theme/colors';
import type { AvatarState } from '../hooks/useMyAvatarSettings';

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
  const [webCropOpen, setWebCropOpen] = React.useState(false);
  const [webCropSrc, setWebCropSrc] = React.useState<string | null>(null);
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

            <ScrollView
              style={{ flexGrow: 0, flexShrink: 1 }}
              contentContainerStyle={{ paddingBottom: 10 }}
              showsVerticalScrollIndicator={false}
            >
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
                  <Text
                    style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null]}
                  >
                    Pick colors or upload a photo (you can zoom/crop)
                  </Text>
                </View>
              </View>

              {avatarError ? (
                <Text style={[styles.errorText, isDark && styles.errorTextDark]}>
                  {avatarError}
                </Text>
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
                      if (Platform.OS === 'web') {
                        setWebCropSrc(uri);
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
            </ScrollView>

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

      <WebCropModal
        styles={styles}
        isDark={isDark}
        visible={Platform.OS === 'web' && webCropOpen}
        title="Crop avatar"
        imageSrc={webCropSrc}
        aspect={1}
        previewObjectFit="cover"
        viewportWidth={260}
        viewportHeight={260}
        outWidth={256}
        outHeight={256}
        quality={0.9}
        onCancel={() => {
          setWebCropOpen(false);
          setWebCropSrc(null);
        }}
        onDone={({ blob }) => {
          const previewUrl = URL.createObjectURL(blob);
          revokeWebPreviewUrlIfNeeded(avatarDraftImageUri);
          webCroppedBlobRef.current = blob;
          setAvatarDraftImageUri(previewUrl);
          setWebCropOpen(false);
          setWebCropSrc(null);
        }}
      />
    </>
  );
}
