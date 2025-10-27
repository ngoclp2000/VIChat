import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import type { CipherEnvelope, StickerPayload } from '@vichat/shared';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

export interface SensitiveMessagePayload {
  body: CipherEnvelope;
  metadata?: Record<string, unknown>;
  sticker?: StickerPayload;
}

export interface EncryptedMessagePayload {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export function encryptMessagePayload(
  payload: SensitiveMessagePayload,
  key: Buffer
): EncryptedMessagePayload {
  if (key.length !== 32) {
    throw new Error('Message encryption key must be 32 bytes.');
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const serialized = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(serialized), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64')
  };
}

export function decryptMessagePayload(
  payload: EncryptedMessagePayload,
  key: Buffer
): SensitiveMessagePayload {
  if (key.length !== 32) {
    throw new Error('Message encryption key must be 32 bytes.');
  }

  const iv = Buffer.from(payload.iv, 'base64');
  const authTag = Buffer.from(payload.authTag, 'base64');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const encrypted = Buffer.from(payload.ciphertext, 'base64');
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  const parsed = JSON.parse(decrypted.toString('utf8')) as Partial<SensitiveMessagePayload>;

  if (!parsed.body) {
    throw new Error('Decrypted payload missing body');
  }

  return {
    body: parsed.body,
    metadata: parsed.metadata,
    sticker: parsed.sticker
  };
}
