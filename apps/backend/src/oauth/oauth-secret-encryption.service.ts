import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class OAuthSecretEncryptionService implements OnModuleInit {
  private readonly logger = new Logger(OAuthSecretEncryptionService.name);
  private encryptionKey: Buffer;

  onModuleInit() {
    const keyHex = process.env.OAUTH_SECRET_ENCRYPTION_KEY;

    if (!keyHex) {
      const errorMsg = 'OAUTH_SECRET_ENCRYPTION_KEY environment variable is not set';
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    if (!/^[0-9a-f]{64}$/i.test(keyHex)) {
      const errorMsg = 'OAUTH_SECRET_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)';
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    this.encryptionKey = Buffer.from(keyHex, 'hex');
    this.logger.log('OAuth secret encryption service initialized successfully');
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${encrypted.toString('hex')}:${authTag.toString('hex')}`;
  }

  decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');

    if (parts.length !== 3) {
      throw new Error('Invalid ciphertext format: expected iv:ciphertext:auth_tag format');
    }

    const [ivHex, encryptedHex, authTagHex] = parts;

    if (ivHex === undefined || encryptedHex === undefined || authTagHex === undefined) {
      throw new Error('Invalid ciphertext format: all parts must be present');
    }

    if (!/^[0-9a-f]+$/i.test(ivHex)) {
      throw new Error('Invalid IV: must be a hex string');
    }

    if (encryptedHex !== '' && !/^[0-9a-f]+$/i.test(encryptedHex)) {
      throw new Error('Invalid ciphertext: must be a hex string');
    }

    if (!/^[0-9a-f]+$/i.test(authTagHex)) {
      throw new Error('Invalid auth tag: must be a hex string');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    try {
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return decrypted.toString('utf8');
    } catch (_error) {
      throw new Error('Decryption failed: authentication tag mismatch or invalid data');
    }
  }
}
