// Shared helpers for Channels feature (plaintext, app-wide rooms).
//
// Required env vars (used by HTTP/WS handlers):
// - CHANNELS_TABLE: PK channelId
//     attrs: name, nameLower, isPublic, hasPassword, passwordHash, createdBySub, createdAt, updatedAt,
//            activeMemberCount (number), deletedAt? (number)
//     GSI (recommended): byNameLower (PK nameLower, SK channelId) for exact lookup by nameLower.
// - CHANNEL_MEMBERS_TABLE: PK channelId, SK memberSub
//     attrs: status ("active"|"left"|"banned"), isAdmin (bool), joinedAt, leftAt, bannedAt, updatedAt
//     GSI (recommended): byMemberSub (PK memberSub, SK channelId or joinedAt) for "my channels".
//
// Notes:
// - Global is a special system channel: conversationId="global". It is NOT stored in CHANNELS_TABLE.
// - Channel messages use conversationId="ch#<channelId>" and are stored in MESSAGES_TABLE alongside DMs/GDMs.
const crypto = require('crypto');
 
const CHANNEL_PREFIX = 'ch#';
 
const safeString = (v) => (typeof v === 'string' ? String(v).trim() : '');
 
// Channel naming rules:
// - display name: letters/numbers with single separators (space, '-', '_')
// - canonical key (stored in nameLower): lowercased, separators normalized to single '-'
// This ensures "Fun Times", "fun-times", and "FUN   TIMES" all map to the same key: "fun-times".
function normalizeChannelKey(name) {
  const raw = safeString(name);
  if (!raw) return '';
  // Keep only ASCII letters/numbers/spaces/_/-, then normalize separators.
  const cleaned = raw.replace(/[^a-zA-Z0-9 _-]/g, '');
  return cleaned.toLowerCase().replace(/[ _-]+/g, '-').replace(/-+/g, '-').trim().replace(/^-+|-+$/g, '');
}

function validateChannelName(name) {
  const trimmed = safeString(name);
  if (!trimmed) return { ok: false, message: 'name is required' };
  if (trimmed.length > 64) return { ok: false, message: 'name too long (max 64)' };

  // Reject confusing / code-denying characters rather than silently stripping them.
  if (/[^a-zA-Z0-9 _-]/.test(trimmed)) {
    return { ok: false, message: 'Invalid name (letters, numbers, spaces, "-" and "_" only)' };
  }

  // Prevent leading/trailing separators and multiple separators in a row (including double spaces).
  if (/^[ _-]|[ _-]$/.test(trimmed)) {
    return { ok: false, message: 'Invalid name (cannot start or end with space, "-" or "_")' };
  }
  if (/[ _-]{2,}/.test(trimmed)) {
    return { ok: false, message: 'Invalid name (use single spaces or single "-" / "_")' };
  }

  const key = normalizeChannelKey(trimmed);
  if (!key) return { ok: false, message: 'Invalid name' };
  if (key === 'global') return { ok: false, message: 'Reserved channel name' };

  return { ok: true, name: trimmed, nameLower: key };
}

function parseChannelConversationId(conversationId) {
  const c = safeString(conversationId);
  if (!c.startsWith(CHANNEL_PREFIX)) return null;
  const channelId = c.slice(CHANNEL_PREFIX.length).trim();
  if (!channelId) return null;
  return { channelId, conversationId: `${CHANNEL_PREFIX}${channelId}` };
}
 
function toChannelConversationId(channelId) {
  const id = safeString(channelId);
  if (!id) return null;
  return `${CHANNEL_PREFIX}${id}`;
}
 
// Password storage: scrypt with per-channel random salt (no external deps).
// Format: "scrypt$<N>$<r>$<p>$<saltHex>$<hashHex>"
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 32;
 
function hashPassword(password) {
  const pw = safeString(password);
  if (!pw) return null;
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('hex')}$${hash.toString('hex')}`;
}
 
function verifyPassword(password, stored) {
  const pw = safeString(password);
  const s = safeString(stored);
  if (!pw || !s) return false;
  const parts = s.split('$');
  // ["scrypt", N, r, p, saltHex, hashHex]
  if (parts.length !== 6) return false;
  if (parts[0] !== 'scrypt') return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const saltHex = parts[4];
  const hashHex = parts[5];
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;
  if (!saltHex || !hashHex) return false;
  let salt;
  let expected;
  try {
    salt = Buffer.from(saltHex, 'hex');
    expected = Buffer.from(hashHex, 'hex');
  } catch {
    return false;
  }
  if (!salt.length || !expected.length) return false;
  let actual;
  try {
    actual = crypto.scryptSync(pw, salt, expected.length, { N, r, p });
  } catch {
    return false;
  }
  try {
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
 
module.exports = {
  CHANNEL_PREFIX,
  parseChannelConversationId,
  toChannelConversationId,
  hashPassword,
  verifyPassword,
  normalizeChannelKey,
  validateChannelName,
};

