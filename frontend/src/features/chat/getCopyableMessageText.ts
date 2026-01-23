import {
  normalizeChatMediaList,
  normalizeDmMediaItems,
  normalizeGroupMediaItems,
  parseChatEnvelope,
  parseDmMediaEnvelope,
  parseEncryptedTextEnvelope,
  parseGroupMediaEnvelope,
} from './parsers';
import type { ChatMessage } from './types';

/**
 * Returns the text that should be copied for a message, or null if there's nothing to copy.
 *
 * Rules:
 * - Text message: copy its text.
 * - Media message: copy its caption ONLY (if present). If no caption, return null.
 * - Deleted: null
 * - Encrypted but not decrypted yet: null
 */
export function getCopyableMessageText(args: { msg: ChatMessage; isDm: boolean }): string | null {
  const { msg: t, isDm } = args;

  if (!t) return null;
  if (t.deletedAt) return null;
  if ((t.encrypted || t.groupEncrypted) && !t.decryptedText) return null;

  let text = '';

  // Encrypted chats: decryptedText can be either a media envelope (caption field)
  // or plain text.
  if (t.encrypted || t.groupEncrypted) {
    const plain = String(t.decryptedText || '');
    const encEnv = parseEncryptedTextEnvelope(plain);
    if (encEnv) {
      text = String(encEnv.text || '');
    } else {
      const dmEnv = parseDmMediaEnvelope(plain);
      const dmItems = dmEnv ? normalizeDmMediaItems(dmEnv) : [];
      const gEnv = parseGroupMediaEnvelope(plain);
      const gItems = gEnv ? normalizeGroupMediaItems(gEnv) : [];
      if (dmItems.length || gItems.length) {
        text = String((dmEnv?.caption ?? gEnv?.caption) || '');
      } else {
        text = plain;
      }
    }
  } else {
    // Plain chats: channel/global can have a JSON envelope for media attachments.
    const raw = String(t.rawText ?? t.text ?? '');
    const env = !isDm ? parseChatEnvelope(raw) : null;
    const envList = env ? normalizeChatMediaList(env.media) : [];
    if (envList.length) {
      // Caption lives ONLY in env.text.
      text = String(env?.text || '');
    } else {
      text = raw;
    }
  }

  const trimmed = String(text || '').trim();
  return trimmed ? trimmed : null;
}
