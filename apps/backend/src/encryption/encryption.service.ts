import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 16;
const AUTH_TAG_BYTES = 16;
const KEY_BYTES = 32;

/**
 * EncryptionService — AES-256-GCM symmetric encryption for sensitive fields.
 *
 * Requires `ENCRYPTION_KEY` env var: 64 hex characters (32 bytes).
 * Generate one with: openssl rand -hex 32
 *
 * Ciphertext format stored in DB:  base64(iv) : base64(authTag) : base64(ciphertext)
 * The auth tag provides integrity verification — tampered ciphertexts throw on decrypt.
 *
 * In development without ENCRYPTION_KEY set, a deterministic dev-only key is derived
 * from the JWT_SECRET so existing dev databases work without reconfiguration.
 * Production deployments MUST set a real ENCRYPTION_KEY.
 */
@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);
  private key!: Buffer;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const raw = this.config.get<string>('ENCRYPTION_KEY');
    if (raw) {
      if (raw.length !== 64) {
        throw new Error(
          `ENCRYPTION_KEY must be 64 hex characters (32 bytes). Got length ${raw.length}. Generate one with: openssl rand -hex 32`,
        );
      }
      this.key = Buffer.from(raw, 'hex');
      this.logger.log('EncryptionService: using configured ENCRYPTION_KEY');
    } else {
      // Dev fallback — derive from JWT_SECRET so it's stable across restarts.
      // Warn loudly so this is never accidentally used in prod.
      const fallback = this.config.get<string>('JWT_SECRET') ?? 'dev-fallback-secret';
      this.key = createHash('sha256').update(fallback).digest().subarray(0, KEY_BYTES);
      this.logger.warn(
        'EncryptionService: ENCRYPTION_KEY not set — using dev fallback derived from JWT_SECRET. ' +
          'Set ENCRYPTION_KEY in production! Generate: openssl rand -hex 32',
      );
    }
  }

  /**
   * Encrypt a plaintext string. Returns a compact string safe to store in the DB.
   * Format: `base64iv:base64authTag:base64ciphertext`
   */
  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return [
      iv.toString('base64'),
      authTag.toString('base64'),
      encrypted.toString('base64'),
    ].join(':');
  }

  /**
   * Decrypt a string produced by `encrypt()`. Throws if tampered or invalid.
   */
  decrypt(encryptedStr: string): string {
    const parts = encryptedStr.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted value format');
    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const ciphertext = Buffer.from(parts[2], 'base64');

    if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
      throw new Error('Invalid encrypted value: wrong IV or auth tag length');
    }

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);
    return (
      decipher.update(ciphertext).toString('utf8') +
      decipher.final('utf8')
    );
  }

  /**
   * Mask an API key for safe display on the frontend.
   * Shows first 12 characters then bullets.
   */
  maskApiKey(plaintext: string): string {
    if (plaintext.length <= 12) return '••••••••••••';
    return plaintext.slice(0, 12) + '••••••••';
  }
}
