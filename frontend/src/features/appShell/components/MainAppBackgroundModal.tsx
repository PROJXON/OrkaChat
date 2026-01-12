import React from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

import type { AppStyles } from '../../../../App.styles';
import { AnimatedDots } from '../../../components/AnimatedDots';

type ChatBackgroundState =
  | { mode: 'default' }
  | { mode: 'color'; color: string }
  | { mode: 'image'; uri: string; blur?: number; opacity?: number };

export function MainAppBackgroundModal({
  styles,
  isDark,
  avatarDefaultColors,

  backgroundOpen,
  setBackgroundOpen,

  backgroundSaving,
  setBackgroundSaving,
  backgroundSavingRef,

  chatBackground,
  setChatBackground,

  backgroundDraft,
  setBackgroundDraft,
  backgroundDraftImageUri,
  setBackgroundDraftImageUri,

  backgroundError,
  setBackgroundError,

  bgEffectBlur,
  setBgEffectBlur,
  bgEffectOpacity,
  setBgEffectOpacity,
}: {
  styles: AppStyles;
  isDark: boolean;
  avatarDefaultColors: string[];

  backgroundOpen: boolean;
  setBackgroundOpen: (v: boolean) => void;

  backgroundSaving: boolean;
  setBackgroundSaving: (v: boolean) => void;
  backgroundSavingRef: React.MutableRefObject<boolean>;

  chatBackground: ChatBackgroundState;
  setChatBackground: React.Dispatch<React.SetStateAction<ChatBackgroundState>>;

  backgroundDraft: ChatBackgroundState;
  setBackgroundDraft: React.Dispatch<React.SetStateAction<ChatBackgroundState>>;
  backgroundDraftImageUri: string | null;
  setBackgroundDraftImageUri: (v: string | null) => void;

  backgroundError: string | null;
  setBackgroundError: (v: string | null) => void;

  bgEffectBlur: number;
  setBgEffectBlur: (v: number) => void;
  bgEffectOpacity: number;
  setBgEffectOpacity: (v: number) => void;
}): React.JSX.Element {
  const discardDraft = React.useCallback(() => {
    if (backgroundSavingRef.current) return;
    setBackgroundOpen(false);
    setBackgroundDraft(chatBackground);
    setBackgroundDraftImageUri(null);
    setBackgroundError(null);
  }, [
    backgroundSavingRef,
    chatBackground,
    setBackgroundDraft,
    setBackgroundDraftImageUri,
    setBackgroundError,
    setBackgroundOpen,
  ]);

  const handlePickImage = React.useCallback(async () => {
    try {
      setBackgroundError(null);
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setBackgroundError('Please allow photo library access to choose a background.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'] as unknown as never,
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.9,
      });
      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (!uri) return;
      setBackgroundDraftImageUri(uri);
      setBackgroundDraft({ mode: 'image', uri, blur: bgEffectBlur, opacity: bgEffectOpacity });
    } catch (e: unknown) {
      setBackgroundError(e instanceof Error ? e.message : 'Could not pick image.');
    }
  }, [
    bgEffectBlur,
    bgEffectOpacity,
    setBackgroundDraft,
    setBackgroundDraftImageUri,
    setBackgroundError,
  ]);

  const handleSave = React.useCallback(async () => {
    backgroundSavingRef.current = true;
    setBackgroundSaving(true);
    setBackgroundError(null);
    try {
      let effective: ChatBackgroundState;
      if (backgroundDraftImageUri) {
        effective = { mode: 'image', uri: backgroundDraftImageUri, blur: bgEffectBlur, opacity: bgEffectOpacity };
      } else if (backgroundDraft.mode === 'image') {
        effective = {
          ...backgroundDraft,
          blur: bgEffectBlur,
          opacity: bgEffectOpacity,
        };
      } else {
        effective = backgroundDraft;
      }
      setChatBackground(effective);
      await AsyncStorage.setItem('ui:chatBackground', JSON.stringify(effective));
      setBackgroundOpen(false);
    } catch (e: unknown) {
      setBackgroundError(e instanceof Error ? e.message : 'Failed to save background.');
    } finally {
      backgroundSavingRef.current = false;
      setBackgroundSaving(false);
    }
  }, [
    backgroundDraft,
    backgroundDraftImageUri,
    backgroundSavingRef,
    bgEffectBlur,
    bgEffectOpacity,
    setBackgroundError,
    setBackgroundOpen,
    setBackgroundSaving,
    setChatBackground,
  ]);

  const effectivePreview =
    backgroundDraftImageUri ? ({ mode: 'image', uri: backgroundDraftImageUri } as const) : backgroundDraft;
  const photoEnabled = !!backgroundDraftImageUri || backgroundDraft.mode === 'image';

  return (
    <Modal visible={backgroundOpen} transparent animationType="fade" onRequestClose={discardDraft}>
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} disabled={backgroundSaving} onPress={discardDraft} />
        <View style={[styles.profileCard, isDark ? styles.profileCardDark : null]}>
          <View style={styles.chatsTopRow}>
            <Text style={[styles.modalTitle, isDark ? styles.modalTitleDark : null]}>Background</Text>
          </View>

          <View style={styles.profilePreviewRow}>
            <View style={styles.bgPreviewBox}>
              {effectivePreview.mode === 'image' ? (
                <Image
                  source={{ uri: effectivePreview.uri }}
                  style={[styles.bgPreviewImage, { opacity: bgEffectOpacity }]}
                  resizeMode="cover"
                  blurRadius={bgEffectBlur}
                />
              ) : effectivePreview.mode === 'color' ? (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: effectivePreview.color }]} />
              ) : (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: isDark ? '#0b0b0f' : '#ffffff' },
                  ]}
                />
              )}
            </View>
            <View style={styles.profilePreviewMeta}>
              <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null]}>
                Choose a chat background
              </Text>
            </View>
          </View>

          {backgroundError ? (
            <Text style={[styles.errorText, isDark && styles.errorTextDark]}>{backgroundError}</Text>
          ) : null}

          {!backgroundDraftImageUri && backgroundDraft.mode !== 'image' ? (
            <>
              <Text
                style={[
                  styles.modalHelperText,
                  isDark ? styles.modalHelperTextDark : null,
                  styles.profileSectionTitle,
                ]}
              >
                Color
              </Text>
              <View style={styles.avatarPaletteRow}>
                {[
                  '#ffffff',
                  '#f2f2f7',
                  '#e9e9ee',
                  '#111111',
                  '#0b0b0f',
                  ...avatarDefaultColors,
                ].map((c) => {
                  const selected = backgroundDraft.mode === 'color' && backgroundDraft.color === c;
                  return (
                    <Pressable
                      key={`bgc:${c}`}
                      onPress={() => setBackgroundDraft({ mode: 'color', color: c })}
                      style={[
                        styles.avatarColorDot,
                        { backgroundColor: c },
                        selected
                          ? isDark
                            ? styles.avatarColorDotSelectedDark
                            : styles.avatarColorDotSelected
                          : null,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Select background color ${c}`}
                    />
                  );
                })}
              </View>
            </>
          ) : (
            <Text style={[styles.modalHelperText, isDark ? styles.modalHelperTextDark : null, { marginTop: 6 }]}>
              Photo background enabled - remove the photo to use a solid color
            </Text>
          )}

          {photoEnabled ? (
            <>
              <View style={styles.bgEffectsHeaderRow}>
                <Text
                  style={[
                    styles.modalHelperText,
                    isDark ? styles.modalHelperTextDark : null,
                    styles.profileSectionTitle,
                  ]}
                >
                  Photo effects
                </Text>
                <Pressable
                  disabled={backgroundSaving}
                  style={({ pressed }) => [styles.bgEffectsResetBtn, pressed ? { opacity: 0.85 } : null]}
                  onPress={() => {
                    setBgEffectBlur(0);
                    setBgEffectOpacity(1);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Reset background effects"
                >
                  <Text style={[styles.bgEffectsResetText, isDark ? styles.bgEffectsResetTextDark : null]}>Reset</Text>
                </Pressable>
              </View>

              <View style={styles.bgSliderSection}>
                <View style={styles.bgSliderLabelRow}>
                  <Text style={[styles.bgSliderLabel, isDark ? styles.bgSliderLabelDark : null]}>Blur</Text>
                  <Text style={[styles.bgSliderValue, isDark ? styles.bgSliderValueDark : null]}>{bgEffectBlur}</Text>
                </View>
                <Slider
                  style={styles.bgSlider}
                  minimumValue={0}
                  maximumValue={10}
                  step={1}
                  value={bgEffectBlur}
                  onValueChange={(v: number) => setBgEffectBlur(v)}
                  onSlidingComplete={(v: number) => setBgEffectBlur(Math.max(0, Math.min(10, Math.round(v))))}
                  minimumTrackTintColor={isDark ? '#fff' : '#111'}
                  maximumTrackTintColor={isDark ? '#2a2a33' : '#d6d6de'}
                  thumbTintColor={isDark ? '#fff' : '#111'}
                />
              </View>

              <View style={styles.bgSliderSection}>
                <View style={styles.bgSliderLabelRow}>
                  <Text style={[styles.bgSliderLabel, isDark ? styles.bgSliderLabelDark : null]}>Opacity</Text>
                  <Text style={[styles.bgSliderValue, isDark ? styles.bgSliderValueDark : null]}>
                    {`${Math.round(bgEffectOpacity * 100)}%`}
                  </Text>
                </View>
                <Slider
                  style={styles.bgSlider}
                  minimumValue={0.2}
                  maximumValue={1}
                  step={0.01}
                  value={bgEffectOpacity}
                  onValueChange={(v: number) => setBgEffectOpacity(Math.round(v * 100) / 100)}
                  onSlidingComplete={(v: number) =>
                    setBgEffectOpacity(Math.max(0.2, Math.min(1, Math.round(v * 100) / 100)))
                  }
                  minimumTrackTintColor={isDark ? '#fff' : '#111'}
                  maximumTrackTintColor={isDark ? '#2a2a33' : '#d6d6de'}
                  thumbTintColor={isDark ? '#fff' : '#111'}
                />
              </View>
            </>
          ) : null}

          <View style={styles.profileActionsRow}>
            <Pressable
              disabled={backgroundSaving}
              style={({ pressed }) => [
                styles.toolBtn,
                isDark && styles.toolBtnDark,
                backgroundSaving ? { opacity: 0.5 } : null,
                pressed && !backgroundSaving ? { opacity: 0.92 } : null,
              ]}
              onPress={() => void handlePickImage()}
              accessibilityRole="button"
            >
              <Text style={[styles.toolBtnText, isDark && styles.toolBtnTextDark]}>Choose image</Text>
            </Pressable>

            <Pressable
              disabled={backgroundSaving || (!backgroundDraftImageUri && backgroundDraft.mode !== 'image')}
              style={({ pressed }) => [
                styles.toolBtn,
                isDark && styles.toolBtnDark,
                backgroundSaving || (!backgroundDraftImageUri && backgroundDraft.mode !== 'image')
                  ? { opacity: 0.5 }
                  : null,
                pressed &&
                !(backgroundSaving || (!backgroundDraftImageUri && backgroundDraft.mode !== 'image'))
                  ? { opacity: 0.92 }
                  : null,
              ]}
              onPress={() => {
                setBackgroundDraftImageUri(null);
                setBackgroundDraft({ mode: 'default' });
              }}
              accessibilityRole="button"
            >
              <Text style={[styles.toolBtnText, isDark && styles.toolBtnTextDark]}>Remove image</Text>
            </Pressable>

            <Pressable
              disabled={backgroundSaving}
              style={({ pressed }) => [
                styles.toolBtn,
                isDark && styles.toolBtnDark,
                backgroundSaving ? { opacity: 0.5 } : null,
                pressed && !backgroundSaving ? { opacity: 0.92 } : null,
              ]}
              onPress={() => {
                setBackgroundDraftImageUri(null);
                setBackgroundDraft({ mode: 'default' });
              }}
              accessibilityRole="button"
            >
              <Text style={[styles.toolBtnText, isDark && styles.toolBtnTextDark]}>Default</Text>
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
              onPress={() => void handleSave()}
              disabled={backgroundSaving}
            >
              {backgroundSaving ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                  <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>Saving</Text>
                  <AnimatedDots color={isDark ? '#fff' : '#111'} size={18} />
                </View>
              ) : (
                <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>Save</Text>
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
              disabled={backgroundSaving}
            >
              <Text style={[styles.modalButtonText, isDark ? styles.modalButtonTextDark : null]}>Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

