/**
 * AES-256-GCM encryption for data at rest.
 *
 * Used by Prisma middleware to transparently encrypt/decrypt PII fields in the
 * database, and by the uploads system to encrypt scanned files on disk.
 *
 * The 32-byte key is derived from the ENCRYPTION_KEY env var.
 * Generate one with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;          // 96-bit IV recommended for GCM
const TAG_LEN = 16;         // 128-bit auth tag
const PREFIX = 'enc:';      // marker so we can tell encrypted from plain text

let _key = null;

/** Lazily load and validate the encryption key */
function getKey() {
  if (_key) return _key;
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
      'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  _key = Buffer.from(hex, 'hex');
  return _key;
}

/**
 * Encrypt a plaintext string → prefixed base64 blob.
 * Returns null/undefined input unchanged.
 */
export function encrypt(plaintext) {
  if (plaintext == null || plaintext === '') return plaintext;
  const text = String(plaintext);
  // Already encrypted — don't double-encrypt
  if (text.startsWith(PREFIX)) return text;

  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Combine: iv + tag + ciphertext → base64
  const blob = Buffer.concat([iv, tag, encrypted]).toString('base64');
  return `${PREFIX}${blob}`;
}

/**
 * Decrypt a prefixed base64 blob → plaintext string.
 * Returns non-encrypted input unchanged (graceful migration).
 */
export function decrypt(ciphertext) {
  if (ciphertext == null || ciphertext === '') return ciphertext;
  const text = String(ciphertext);
  if (!text.startsWith(PREFIX)) return text; // plaintext — not yet encrypted

  const key = getKey();
  const raw = Buffer.from(text.slice(PREFIX.length), 'base64');
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const encrypted = raw.subarray(IV_LEN + TAG_LEN);

  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
}

/**
 * Encrypt a JSON-serialisable value (arrays, objects).
 * Encrypts the JSON string itself so the whole blob is opaque.
 */
export function encryptJson(value) {
  if (value == null) return value;
  return encrypt(JSON.stringify(value));
}

/**
 * Decrypt a JSON blob that was encrypted with encryptJson.
 * Returns non-encrypted JSON unchanged (graceful migration).
 */
export function decryptJson(value) {
  if (value == null) return value;
  // Prisma returns parsed JSON for Json fields — if it's already an object/array, it's plaintext
  if (typeof value === 'object') return value;
  const decrypted = decrypt(String(value));
  try { return JSON.parse(decrypted); } catch { return value; }
}

// ── File encryption ─────────────────────────────────────────────────────────

/**
 * Encrypt a file buffer → Buffer with prepended IV + tag.
 */
export function encryptBuffer(buf) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(buf), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

/**
 * Decrypt a buffer that was encrypted with encryptBuffer.
 */
export function decryptBuffer(buf) {
  const key = getKey();
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const encrypted = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

/**
 * Check whether encryption is configured.
 */
export function isEncryptionEnabled() {
  const hex = process.env.ENCRYPTION_KEY;
  return !!hex && hex.length === 64;
}
