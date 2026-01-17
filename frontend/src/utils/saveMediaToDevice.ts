import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';

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
  Paths?: { cache?: string; document?: string };
  File?: {
    new (
      root: string,
      name: string,
    ): {
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
  const safeNameWithExt = (fileName || `attachment-${Date.now()}`)
    .replace(/[^\w.\-() ]+/g, '_')
    .slice(0, 120);
  const extFromName = (() => {
    const m = safeNameWithExt.match(/\.([a-zA-Z0-9]{1,8})$/);
    return m ? m[1].toLowerCase() : '';
  })();
  const ext = extFromName || (kind === 'image' ? 'jpg' : kind === 'video' ? 'mp4' : 'bin');
  const baseName = safeNameWithExt.replace(/\.[^.]+$/, '') || `attachment-${Date.now()}`;
  const downloadName = `${baseName}.${ext}`;

  try {
    // Web: use a browser download flow (MediaLibrary/FileSystem aren't applicable).
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const clickDownload = (href: string) => {
        const a = document.createElement('a');
        a.href = href;
        a.download = downloadName;
        a.rel = 'noopener';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        a.remove();
      };

      // Data/blob URLs can be downloaded directly.
      if (url.startsWith('data:') || url.startsWith('blob:')) {
        clickDownload(url);
        onSuccess?.();
        return;
      }

      // Prefer fetching the bytes so the download gets a filename.
      // If CORS blocks fetch, fall back to a direct navigation.
      try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Download failed (${resp.status})`);
        const blob = await resp.blob();
        const objUrl = URL.createObjectURL(blob);
        clickDownload(objUrl);
        // Revoke shortly after the click has started.
        setTimeout(() => URL.revokeObjectURL(objUrl), 10_000);
        onSuccess?.();
        return;
      } catch {
        // Last resort: open the URL (may still allow the user to save via browser UI).
        try {
          clickDownload(url);
          onSuccess?.();
          return;
        } catch {
          // ignore
        }
      }

      throw new Error('Unable to download on web (blocked by browser/CORS)');
    }

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
      const fs: ExpoFileSystemLike = isRecord(fsMod) ? (fsMod as ExpoFileSystemLike) : {};
      const root = fs.Paths?.cache ?? fs.Paths?.document;
      if (!root) throw new Error('No writable cache directory');
      const File = fs.File;
      if (!File) throw new Error('File API not available');
      const dest = new File(root, downloadName);
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
    const fs: ExpoFileSystemLike = isRecord(fsMod) ? (fsMod as ExpoFileSystemLike) : {};
    const root = fs.Paths?.cache ?? fs.Paths?.document;
    if (!root) throw new Error('No writable cache directory');
    const File = fs.File;
    if (!File) throw new Error('File API not available');
    const dest = new File(root, downloadName);

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
