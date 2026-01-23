import { Linking, Platform } from 'react-native';

import { defaultFileExtensionForContentType } from './mediaKinds';

function safeFileName(name: string): string {
  return String(name || '')
    .replace(/[^\w.\-() ]+/g, '_')
    .slice(0, 140);
}

function ensureExtension(fileName: string, contentType?: string): string {
  const n = String(fileName || '').trim();
  if (!n) return '';
  const hasDot = n.includes('.') && !n.endsWith('.');
  if (hasDot) return n;
  const ext = defaultFileExtensionForContentType(contentType);
  return ext ? `${n}.${ext}` : n;
}

function guessMimeTypeFromName(fileName: string): string {
  const n = String(fileName || '')
    .trim()
    .toLowerCase();
  const dot = n.lastIndexOf('.');
  const ext = dot >= 0 ? n.slice(dot + 1) : '';
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'xls':
      return 'application/vnd.ms-excel';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'ppt':
      return 'application/vnd.ms-powerpoint';
    case 'pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case 'txt':
      return 'text/plain';
    case 'csv':
      return 'text/csv';
    case 'json':
      return 'application/json';
    case 'xml':
      return 'application/xml';
    case 'htm':
    case 'html':
      return 'text/html';
    case 'zip':
      return 'application/zip';
    case 'mp3':
      return 'audio/mpeg';
    case 'm4a':
      return 'audio/mp4';
    case 'wav':
      return 'audio/wav';
    case 'ogg':
      return 'audio/ogg';
    case 'mp4':
      return 'video/mp4';
    case 'mov':
      return 'video/quicktime';
    case 'webm':
      return 'video/webm';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    default:
      return '';
  }
}

function resolvedMimeType(opts: { contentType?: string; fileName?: string }): string {
  const ct = String(opts.contentType || '').trim();
  if (ct) return ct;
  const g = guessMimeTypeFromName(String(opts.fileName || '').trim());
  return g || 'application/octet-stream';
}

export async function openExternalFile(opts: {
  url: string;
  fileName?: string;
  contentType?: string;
  /**
   * Web-only: show a confirmation modal before opening (prevents surprise downloads).
   */
  requestOpenFile?: (args: { url: string; fileName?: string }) => void;
}): Promise<void> {
  const url = String(opts.url || '').trim();
  if (!url) return;

  if (Platform.OS === 'web') {
    // Web: use the confirmation modal when available so UX matches plaintext chats.
    // (The modal's "Open" handler must support blob/data/file URLs too.)
    if (opts.requestOpenFile) {
      opts.requestOpenFile({ url, fileName: opts.fileName });
      return;
    }
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // ignore
    }
    return;
  }

  const mimeType = resolvedMimeType({ contentType: opts.contentType, fileName: opts.fileName });

  // If we already have a local URI (DM decrypt cache, etc), open it directly.
  if (url.startsWith('file:') || url.startsWith('content:')) {
    // Android: prefer a proper VIEW intent so the OS shows the right viewer/chooser.
    if (Platform.OS === 'android') {
      try {
        // Convert file:// -> content:// when possible so external apps can read it.
        let data = url;
        try {
          const legacy = require('expo-file-system/legacy') as Record<string, unknown>;
          const getContentUriAsync = (legacy as any).getContentUriAsync as
            | ((fileUri: string) => Promise<string>)
            | undefined;
          if (typeof getContentUriAsync === 'function' && url.startsWith('file:')) {
            const c = await getContentUriAsync(url);
            if (c) data = c;
          }
        } catch {
          // ignore
        }
        const IntentLauncher = require('expo-intent-launcher') as Record<string, unknown>;
        const startActivityAsync = (IntentLauncher as any).startActivityAsync as
          | ((action: string, params: Record<string, unknown>) => Promise<void>)
          | undefined;
        if (typeof startActivityAsync === 'function') {
          const ActivityAction = (IntentLauncher as any).ActivityAction;
          const IntentFlags = (IntentLauncher as any).IntentFlags;
          const action = ActivityAction?.VIEW || 'android.intent.action.VIEW';
          const flags = IntentFlags?.GRANT_READ_URI_PERMISSION || 1;
          await startActivityAsync(action, { data, flags, type: mimeType });
          return;
        }
      } catch {
        // fall back to Linking
      }
    }
    // iOS/Android fallback: share/open sheet (often closer to Signal UX than raw Linking).
    try {
      const Sharing = require('expo-sharing') as Record<string, unknown>;
      const shareAsync = (Sharing as any).shareAsync as
        | ((uri: string, opts?: Record<string, unknown>) => Promise<void>)
        | undefined;
      if (typeof shareAsync === 'function') {
        await shareAsync(url, { mimeType, dialogTitle: 'Open attachment', UTI: undefined });
        return;
      }
    } catch {
      // ignore
    }

    await Linking.openURL(url).catch(() => {});
    return;
  }

  // Native: download to cache then hand off to the OS viewer.
  try {
    const FS = require('expo-file-system') as Record<string, unknown>;
    const Paths = (FS as any).Paths as { cache?: unknown; document?: unknown };
    const File = (FS as any).File as {
      downloadFileAsync?: (
        remoteUrl: string,
        destination: unknown,
        options?: Record<string, unknown>,
      ) => Promise<{ uri?: string }>;
      new (...uris: unknown[]): { uri?: string };
    };
    if (!Paths || !File || typeof (File as any).downloadFileAsync !== 'function') {
      throw new Error('expo-file-system new API not available');
    }

    const base =
      safeFileName(String(opts.fileName || '').trim()) ||
      safeFileName(`attachment-${Date.now()}`) ||
      `attachment-${Date.now()}`;
    const outName = ensureExtension(base, opts.contentType);
    const leaf = `${Date.now()}-${outName}`;

    // Prefer cache; fall back to documents.
    let dest: { uri?: string } | null = null;
    try {
      dest = new (File as any)(Paths.cache, leaf);
    } catch {
      dest = new (File as any)(Paths.document, leaf);
    }

    const downloaded = await (File as any).downloadFileAsync(url, dest, { idempotent: true });
    const local = String(downloaded?.uri || dest?.uri || '').trim();
    if (!local) throw new Error('downloadFileAsync returned empty uri');

    if (Platform.OS === 'android') {
      // Try VIEW intent with content:// uri (best UX).
      try {
        let data = local;
        try {
          const legacy = require('expo-file-system/legacy') as Record<string, unknown>;
          const getContentUriAsync = (legacy as any).getContentUriAsync as
            | ((fileUri: string) => Promise<string>)
            | undefined;
          if (typeof getContentUriAsync === 'function')
            data = (await getContentUriAsync(local)) || local;
        } catch {
          // ignore
        }
        const IntentLauncher = require('expo-intent-launcher') as Record<string, unknown>;
        const startActivityAsync = (IntentLauncher as any).startActivityAsync as
          | ((action: string, params: Record<string, unknown>) => Promise<void>)
          | undefined;
        if (typeof startActivityAsync === 'function') {
          const ActivityAction = (IntentLauncher as any).ActivityAction;
          const IntentFlags = (IntentLauncher as any).IntentFlags;
          const action = ActivityAction?.VIEW || 'android.intent.action.VIEW';
          const flags = IntentFlags?.GRANT_READ_URI_PERMISSION || 1;
          await startActivityAsync(action, { data, flags, type: mimeType });
          return;
        }
      } catch {
        // ignore and fall back to share sheet below
      }
    }

    // Cross-platform fallback: share/open sheet.
    try {
      const Sharing = require('expo-sharing') as Record<string, unknown>;
      const shareAsync = (Sharing as any).shareAsync as
        | ((uri: string, opts?: Record<string, unknown>) => Promise<void>)
        | undefined;
      if (typeof shareAsync === 'function') {
        await shareAsync(local, { mimeType, dialogTitle: 'Open attachment', UTI: undefined });
        return;
      }
    } catch {
      // ignore
    }

    await Linking.openURL(local).catch(() => {});
    return;
  } catch {
    // If we can't download/open locally for any reason, fall back to opening the remote URL.
    await Linking.openURL(url).catch(() => {});
  }
}
