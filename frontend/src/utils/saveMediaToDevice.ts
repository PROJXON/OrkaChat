import * as MediaLibrary from 'expo-media-library';

export type SaveMediaKind = 'image' | 'video' | 'file';

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

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

type ExpoFileSystemLike = {
  Paths?: { cache?: unknown; document?: unknown };
  File?: {
    new (root: unknown, name: string): {
      uri: string;
      write?: (data: string, opts: { encoding: 'base64' }) => Promise<void>;
      downloadFileAsync?: (url: string) => Promise<void>;
    };
    downloadFileAsync?: (url: string, dest: { uri: string }) => Promise<void>;
  };
};

export async function saveMediaUrlToDevice({
  url,
  kind,
  fileName,
  onPermissionDenied,
  onSuccess,
  onError,
}: {
  url: string;
  kind: SaveMediaKind;
  fileName?: string;
  onPermissionDenied?: () => void;
  onSuccess?: () => void;
  onError?: (message: string) => void;
}): Promise<void> {
  const safeNameWithExt = (fileName || `attachment-${Date.now()}`).replace(/[^\w.\-() ]+/g, '_').slice(0, 120);
  const extFromName = (() => {
    const m = safeNameWithExt.match(/\.([a-zA-Z0-9]{1,8})$/);
    return m ? m[1].toLowerCase() : '';
  })();
  const ext = extFromName || (kind === 'image' ? 'jpg' : kind === 'video' ? 'mp4' : 'bin');
  const baseName = safeNameWithExt.replace(/\.[^.]+$/, '') || `attachment-${Date.now()}`;

  try {
    const perm = await MediaLibrary.requestPermissionsAsync();
    if (!perm.granted) {
      onPermissionDenied?.();
      return;
    }

    // Handle data URIs.
    if (url.startsWith('data:')) {
      const comma = url.indexOf(',');
      if (comma < 0) throw new Error('Invalid data URI');
      const header = url.slice(0, comma);
      const b64 = url.slice(comma + 1);
      const isBase64 = /;base64/i.test(header);
      if (!isBase64) throw new Error('Unsupported data URI encoding');

      const fsMod: unknown = require('expo-file-system');
      const fs = (isRecord(fsMod) ? (fsMod as ExpoFileSystemLike) : {}) as ExpoFileSystemLike;
      const root = fs.Paths?.cache ?? fs.Paths?.document;
      if (!root) throw new Error('No writable cache directory');
      const File = fs.File;
      if (!File) throw new Error('File API not available');
      const dest = new File(root, `${baseName}.${ext}`);
      if (typeof dest.write !== 'function') throw new Error('File write API not available');
      await dest.write(b64, { encoding: 'base64' });
      await MediaLibrary.saveToLibraryAsync(dest.uri);
      onSuccess?.();
      return;
    }

    // If it's already a local file, save it directly.
    if (url.startsWith('file:')) {
      await MediaLibrary.saveToLibraryAsync(url);
      onSuccess?.();
      return;
    }

    // Modern Expo FileSystem API (SDK 54+).
    const fsMod: unknown = require('expo-file-system');
    const fs = (isRecord(fsMod) ? (fsMod as ExpoFileSystemLike) : {}) as ExpoFileSystemLike;
    const root = fs.Paths?.cache ?? fs.Paths?.document;
    if (!root) throw new Error('No writable cache directory');
    const File = fs.File;
    if (!File) throw new Error('File API not available');
    const dest = new File(root, `${baseName}.${ext}`);

    // The docs support either instance or static download; support both for safety.
    if (typeof dest?.downloadFileAsync === 'function') {
      await dest.downloadFileAsync(url);
    } else if (typeof File?.downloadFileAsync === 'function') {
      await File.downloadFileAsync(url, dest);
    } else {
      throw new Error('File download API not available');
    }

    await MediaLibrary.saveToLibraryAsync(dest.uri);
    onSuccess?.();
  } catch (e: unknown) {
    onError?.(getErrorMessage(e) || 'Could not save attachment');
  }
}

