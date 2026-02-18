import { Injectable, Logger } from '@nestjs/common';
import { generateSecret, generateURI, verify, generateSync } from 'otplib';
import * as QRCode from 'qrcode';
import { ConfigService } from '@nestjs/config';

export interface TotpSetupResult {
  secret: string;
  qrCodeUrl: string;
  qrCodeDataUrl: string;
}

@Injectable()
export class TotpService {
  private readonly logger = new Logger(TotpService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Generate a new TOTP secret for a user
   * @param username The user's username (used in QR code label)
   * @returns The secret and QR code information
   */
  async generateSecret(username: string): Promise<TotpSetupResult> {
    // Generate secret
    const secret = generateSecret();

    // Get app name from config
    const appName = this.configService.get<string>('app.name') || 'WebApp';

    // Generate OTP auth URL
    const otpauthUrl = generateURI({
      issuer: appName,
      label: username,
      secret,
      strategy: 'totp',
      digits: 6,
      period: 30,
    });

    // Generate QR code as data URL
    let qrCodeDataUrl: string;
    try {
      qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
        errorCorrectionLevel: 'M',
        width: 300,
      });
    } catch {
      // Fallback to just the URL if QR generation fails
      qrCodeDataUrl = '';
      this.logger.warn('Failed to generate QR code image, returning URL only');
    }

    return {
      secret,
      qrCodeUrl: otpauthUrl,
      qrCodeDataUrl,
    };
  }

  /**
   * Verify a TOTP code against a secret
   * @param secret The user's TOTP secret
   * @param code The code to verify
   * @returns true if the code is valid
   */
  async verifyCode(secret: string, code: string): Promise<boolean> {
    try {
      const result = await verify({
        secret,
        token: code,
        strategy: 'totp',
        epochTolerance: 1, // Allow ±1 time window for clock drift
      });
      return result.valid;
    } catch (error) {
      this.logger.error('Error verifying TOTP code', error);
      return false;
    }
  }

  /**
   * Generate a QR code URL for an existing secret
   * @param secret The TOTP secret
   * @param username The user's username
   * @returns The OTP auth URL
   */
  generateQrCodeUrl(secret: string, username: string): string {
    const appName = this.configService.get<string>('app.name') || 'WebApp';
    return generateURI({
      issuer: appName,
      label: username,
      secret,
      strategy: 'totp',
      digits: 6,
      period: 30,
    });
  }

  /**
   * Generate a TOTP code synchronously (for testing purposes)
   * @param secret The TOTP secret
   * @returns The current TOTP code
   */
  generateCodeSync(secret: string): string {
    return generateSync({ secret, strategy: 'totp' });
  }
}
