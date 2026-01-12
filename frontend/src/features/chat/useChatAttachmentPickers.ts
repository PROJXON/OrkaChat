import * as React from 'react';
import { Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import type { InAppCameraCapture } from '../../components/InAppCameraModal';
import type { DocumentPickerAssetLike, ImagePickerAssetLike, PendingMediaItem } from './attachments';

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message || 'Unknown error';
  if (typeof err === 'string') return err || 'Unknown error';
  if (!err) return 'Unknown error';
  try {
    const rec = err as Record<string, unknown>;
    const msg = rec?.message;
    return typeof msg === 'string' && msg ? msg : 'Unknown error';
  } catch {
    return 'Unknown error';
  }
}

export function useChatAttachmentPickers(opts: {
  showAlert: (title: string, message: string) => void;
  addPickedMediaItems: (items: PendingMediaItem[]) => void;
  pendingMediaFromImagePickerAssets: (assets: ReadonlyArray<ImagePickerAssetLike>) => PendingMediaItem[];
  pendingMediaFromDocumentPickerAssets: (assets: ReadonlyArray<DocumentPickerAssetLike>) => PendingMediaItem[];
  pendingMediaFromInAppCameraCapture: (cap: InAppCameraCapture) => PendingMediaItem;
  setCameraOpen: (open: boolean) => void;
}): {
  pickFromLibrary: () => Promise<void>;
  pickDocument: () => Promise<void>;
  openCamera: () => void;
  handleInAppCameraCaptured: (cap: InAppCameraCapture) => void;
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
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        quality: 1,
      });

      if (result.canceled) return;
      const assets = Array.isArray(result.assets) ? result.assets : [];
      if (!assets.length) return;
      const items = pendingMediaFromImagePickerAssets(assets);
      if (!items.length) return;
      addPickedMediaItems(items);
    } catch (e: unknown) {
      showAlert('Picker failed', getErrorMessage(e));
    }
  }, [showAlert, addPickedMediaItems, pendingMediaFromImagePickerAssets]);

  const openCamera = React.useCallback(() => {
    setCameraOpen(true);
  }, [setCameraOpen]);

  const handleInAppCameraCaptured = React.useCallback(
    (cap: InAppCameraCapture) => {
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
    } catch (e: unknown) {
      showAlert('File picker failed', getErrorMessage(e));
    }
  }, [showAlert, addPickedMediaItems, pendingMediaFromDocumentPickerAssets]);

  return { pickFromLibrary, pickDocument, openCamera, handleInAppCameraCaptured };
}

