import * as React from 'react';
import { Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

export function useChatAttachmentPickers(opts: {
  showAlert: (title: string, message: string) => void;
  addPickedMediaItems: (items: any[]) => void;
  pendingMediaFromImagePickerAssets: (assets: unknown[]) => any[];
  pendingMediaFromDocumentPickerAssets: (assets: unknown[]) => any[];
  pendingMediaFromInAppCameraCapture: (cap: { uri: string; mode: 'photo' | 'video' }) => any;
  setCameraOpen: (open: boolean) => void;
}): {
  pickFromLibrary: () => Promise<void>;
  pickDocument: () => Promise<void>;
  openCamera: () => void;
  handleInAppCameraCaptured: (cap: { uri: string; mode: 'photo' | 'video' }) => void;
} {
  const {
    showAlert,
    addPickedMediaItems,
    pendingMediaFromImagePickerAssets,
    pendingMediaFromDocumentPickerAssets,
    pendingMediaFromInAppCameraCapture,
    setCameraOpen,
  } = opts;

  const pickFromLibrary = React.useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        // Keep permission prompts as a native system alert (more appropriate than themed modals).
        Alert.alert(
          'Permission needed',
          'Please allow photo library access to pick media.\n\nIf you previously denied this permission, enable it in Settings.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        // Use the string union to stay compatible across expo-image-picker typings.
        mediaTypes: ['images', 'videos'] as any,
        allowsMultipleSelection: true,
        quality: 1,
      });

      if (result.canceled) return;
      const assets = Array.isArray(result.assets) ? result.assets : [];
      if (!assets.length) return;
      const items = pendingMediaFromImagePickerAssets(assets);
      if (!items.length) return;
      addPickedMediaItems(items);
    } catch (e: any) {
      showAlert('Picker failed', e?.message ?? 'Unknown error');
    }
  }, [showAlert, addPickedMediaItems, pendingMediaFromImagePickerAssets]);

  const openCamera = React.useCallback(() => {
    setCameraOpen(true);
  }, [setCameraOpen]);

  const handleInAppCameraCaptured = React.useCallback(
    (cap: { uri: string; mode: 'photo' | 'video' }) => {
      const item = pendingMediaFromInAppCameraCapture(cap);
      addPickedMediaItems([item]);
    },
    [addPickedMediaItems, pendingMediaFromInAppCameraCapture],
  );

  const pickDocument = React.useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (result.canceled) return;
      const assets = Array.isArray(result.assets) ? result.assets : [];
      if (!assets.length) return;
      const items = pendingMediaFromDocumentPickerAssets(assets);
      if (!items.length) return;
      addPickedMediaItems(items);
    } catch (e: any) {
      showAlert('File picker failed', e?.message ?? 'Unknown error');
    }
  }, [showAlert, addPickedMediaItems, pendingMediaFromDocumentPickerAssets]);

  return { pickFromLibrary, pickDocument, openCamera, handleInAppCameraCaptured };
}

