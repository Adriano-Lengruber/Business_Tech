import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { appEnv } from '../../config/env';

const PREFIX = 'v1';

function deriveKey(rawSecret: string): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(rawSecret.trim())) {
    return Buffer.from(rawSecret.trim(), 'hex');
  }
  return createHash('sha256').update(rawSecret).digest();
}

export function encryptSecret(
  plaintext: string,
  secretKey: string = appEnv.ENCRYPTION_KEY,
): string {
  const key = deriveKey(secretKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(
  payload: string,
  secretKey: string = appEnv.ENCRYPTION_KEY,
): string {
  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new Error('Formato de segredo criptografado inválido.');
  }
  const [, ivHex, tagHex, dataHex] = parts;
  const key = deriveKey(secretKey);
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivHex!, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(tagHex!, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex!, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
