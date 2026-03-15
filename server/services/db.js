import { PrismaClient } from '@prisma/client';
import { encrypt, decrypt, encryptJson, decryptJson, isEncryptionEnabled } from './crypto.js';

const prisma = new PrismaClient();

// ── Field-level encryption middleware ────────────────────────────────────────
// Transparently encrypts PII fields before writing and decrypts after reading.
// Gracefully passes through plaintext for records written before encryption
// was enabled (the decrypt function detects the 'enc:' prefix).

/** String fields to encrypt/decrypt */
const ENCRYPTED_STRING_FIELDS = [
  'extractedText', 'summary', 'sender', 'receiver',
  'amountDue', 'dueDate', 'actionNote',
];

/** Json fields to encrypt/decrypt (stored as encrypted string in DB) */
const ENCRYPTED_JSON_FIELDS = [
  'keyDetails', 'actionableInfo', 'paymentDetails', 'suggestedActions',
];

/** All encrypted fields for quick lookup */
const ALL_ENCRYPTED = new Set([...ENCRYPTED_STRING_FIELDS, ...ENCRYPTED_JSON_FIELDS]);

/** Encrypt fields in a data object before write */
function encryptFields(data) {
  if (!data || !isEncryptionEnabled()) return data;
  const out = { ...data };
  for (const f of ENCRYPTED_STRING_FIELDS) {
    if (f in out && out[f] != null) out[f] = encrypt(out[f]);
  }
  for (const f of ENCRYPTED_JSON_FIELDS) {
    if (f in out && out[f] != null) out[f] = encryptJson(out[f]);
  }
  return out;
}

/** Decrypt fields in a result record after read */
function decryptRecord(record) {
  if (!record || typeof record !== 'object') return record;
  // Only decrypt if encryption is enabled (otherwise data is already plain)
  for (const f of ENCRYPTED_STRING_FIELDS) {
    if (f in record && record[f] != null) record[f] = decrypt(record[f]);
  }
  for (const f of ENCRYPTED_JSON_FIELDS) {
    if (f in record && record[f] != null) record[f] = decryptJson(record[f]);
  }
  return record;
}

/** Decrypt a result (single record, array, or count) */
function decryptResult(result) {
  if (result == null) return result;
  if (Array.isArray(result)) return result.map(decryptRecord);
  if (typeof result === 'object' && result.id) return decryptRecord(result);
  return result;
}

// Models that have encrypted fields
const ENCRYPTED_MODELS = new Set(['Mail']);

// Write operations that contain data to encrypt
const WRITE_ACTIONS = new Set(['create', 'update', 'upsert', 'createMany', 'updateMany']);

// Read operations whose results need decryption
const READ_ACTIONS = new Set([
  'findFirst', 'findUnique', 'findMany',
  'create', 'update', 'upsert', 'delete',
]);

prisma.$use(async (params, next) => {
  if (!ENCRYPTED_MODELS.has(params.model)) return next(params);

  // ── Encrypt on write ──────────────────────────────────────────────────
  if (WRITE_ACTIONS.has(params.action)) {
    if (params.args.data) {
      params.args.data = encryptFields(params.args.data);
    }
    // upsert has separate create/update objects
    if (params.action === 'upsert') {
      if (params.args.create) params.args.create = encryptFields(params.args.create);
      if (params.args.update) params.args.update = encryptFields(params.args.update);
    }
  }

  const result = await next(params);

  // ── Decrypt on read ───────────────────────────────────────────────────
  if (READ_ACTIONS.has(params.action)) {
    return decryptResult(result);
  }

  return result;
});

export default prisma;
