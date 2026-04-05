import crypto from 'node:crypto';

const ALGORITHM  = 'aes-256-gcm';
const KEY_HEX    = process.env.ENCRYPTION_KEY!;

function getKeyBuffer(): Buffer {
  if (!KEY_HEX || KEY_HEX.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  return Buffer.from(KEY_HEX, 'hex');
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns "iv:authTag:ciphertext" in hex.
 */
export function encryptKey(plaintext: string): string {
  const keyBuffer = getKeyBuffer();
  const iv        = crypto.randomBytes(16);
  const cipher    = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
  const enc       = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag       = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), enc.toString('hex')].join(':');
}

/**
 * Decrypt an AES-256-GCM encrypted string.
 * Expects "iv:authTag:ciphertext" in hex.
 */
export function decryptKey(stored: string): string {
  const keyBuffer = getKeyBuffer();
  const [ivHex, tagHex, encHex] = stored.split(':');
  const iv       = Buffer.from(ivHex,  'hex');
  const tag      = Buffer.from(tagHex, 'hex');
  const enc      = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc).toString('utf8') + decipher.final('utf8');
}
