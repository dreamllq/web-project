import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TotpService } from './totp.service';
import { RecoveryCodeService } from './recovery-code.service';
import { UsersService } from '../../users/users.service';
import { User } from '../../entities/user.entity';
import * as bcrypt from 'bcrypt';

export interface TwoFactorSetupResult {
  qrCodeUrl: string;
  qrCodeDataUrl: string;
  recoveryCodes: string[];
  secret: string; // Only returned during setup, must be confirmed
}

// Temporary token for 2FA verification during login
interface PendingTwoFactorLogin {
  userId: string;
  username: string;
  expiresAt: Date;
}

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);
  private readonly PENDING_TTL = 5 * 60 * 1000; // 5 minutes

  // In-memory store for pending 2FA logins (in production, use Redis)
  private pendingLogins = new Map<string, PendingTwoFactorLogin>();

  constructor(
    private readonly totpService: TotpService,
    private readonly recoveryCodeService: RecoveryCodeService,
    private readonly usersService: UsersService,
    private readonly dataSource: DataSource
  ) {}

  /**
   * Start 2FA setup - generate secret and QR code
   * Returns setup data, but 2FA is not enabled until confirmed
   */
  async enable(userId: string): Promise<TwoFactorSetupResult> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.mfaEnabled) {
      throw new BadRequestException('2FA is already enabled');
    }

    // Generate TOTP secret and QR code
    const totpSetup = await this.totpService.generateSecret(user.username);

    // Generate recovery codes
    const recoveryCodes = this.recoveryCodeService.generateCodes(10);

    return {
      qrCodeUrl: totpSetup.qrCodeUrl,
      qrCodeDataUrl: totpSetup.qrCodeDataUrl,
      recoveryCodes,
      secret: totpSetup.secret,
    };
  }

  /**
   * Confirm 2FA setup with verification code
   * This actually enables 2FA for the user
   */
  async confirmEnable(
    userId: string,
    secret: string,
    code: string,
    recoveryCodes: string[]
  ): Promise<{ success: boolean }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.mfaEnabled) {
      throw new BadRequestException('2FA is already enabled');
    }

    // Verify the TOTP code
    const isValid = await this.totpService.verifyCode(secret, code);
    if (!isValid) {
      throw new BadRequestException('Invalid verification code');
    }

    // Hash recovery codes
    const hashedCodes = await this.recoveryCodeService.hashCodes(recoveryCodes);

    // Encrypt secret before storing (simple base64 for now, production should use proper encryption)
    const encryptedSecret = Buffer.from(secret).toString('base64');

    // Update user using DataSource directly
    const userRepository = this.dataSource.getRepository(User);
    await userRepository.update(userId, {
      mfaEnabled: true,
      mfaSecret: encryptedSecret,
      recoveryCodes: hashedCodes,
    });

    this.logger.log(`2FA enabled for user ${userId}`);

    return { success: true };
  }

  /**
   * Disable 2FA - requires password verification
   */
  async disable(userId: string, password: string): Promise<{ success: boolean }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.mfaEnabled) {
      throw new BadRequestException('2FA is not enabled');
    }

    // Verify password
    if (!user.passwordHash) {
      throw new BadRequestException('Cannot disable 2FA for OAuth-only accounts');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    // Disable 2FA using DataSource directly
    const userRepository = this.dataSource.getRepository(User);
    await userRepository.update(userId, {
      mfaEnabled: false,
      mfaSecret: null,
      recoveryCodes: null,
    });

    this.logger.log(`2FA disabled for user ${userId}`);

    return { success: true };
  }

  /**
   * Verify TOTP code during login
   * Used after initial login returns require2FA: true
   */
  async verify(userId: string, code: string): Promise<boolean> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.mfaEnabled || !user.mfaSecret) {
      throw new BadRequestException('2FA is not enabled for this user');
    }

    // Decrypt secret
    const secret = Buffer.from(user.mfaSecret, 'base64').toString();

    // Verify TOTP code
    return this.totpService.verifyCode(secret, code);
  }

  /**
   * Verify recovery code (alternative to TOTP)
   * Recovery codes are single-use
   */
  async verifyRecoveryCode(
    userId: string,
    code: string
  ): Promise<{ success: boolean; remainingCodes: number }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.mfaEnabled || !user.recoveryCodes) {
      throw new BadRequestException('2FA is not enabled for this user');
    }

    // Verify recovery code
    const codeIndex = await this.recoveryCodeService.verifyCode(user.recoveryCodes, code);

    if (codeIndex < 0) {
      throw new UnauthorizedException('Invalid recovery code');
    }

    // Consume the code (remove it from the list)
    const remainingCodes = this.recoveryCodeService.consumeCode(user.recoveryCodes, codeIndex);

    // Update user with remaining codes using DataSource directly
    const userRepository = this.dataSource.getRepository(User);
    await userRepository.update(userId, {
      recoveryCodes: remainingCodes,
    });

    this.logger.log(`Recovery code used for user ${userId}, ${remainingCodes.length} remaining`);

    return {
      success: true,
      remainingCodes: remainingCodes.length,
    };
  }

  /**
   * Generate new recovery codes (requires password verification)
   */
  async regenerateRecoveryCodes(userId: string, password: string): Promise<string[]> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.mfaEnabled) {
      throw new BadRequestException('2FA is not enabled');
    }

    // Verify password
    if (!user.passwordHash) {
      throw new BadRequestException('Cannot regenerate codes for OAuth-only accounts');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    // Generate new recovery codes
    const recoveryCodes = this.recoveryCodeService.generateCodes(10);
    const hashedCodes = await this.recoveryCodeService.hashCodes(recoveryCodes);

    // Update user using DataSource directly
    const userRepository = this.dataSource.getRepository(User);
    await userRepository.update(userId, {
      recoveryCodes: hashedCodes,
    });

    this.logger.log(`Recovery codes regenerated for user ${userId}`);

    return recoveryCodes;
  }

  /**
   * Create a pending 2FA login session
   * Returns a temporary token that can be used to complete login
   */
  createPendingLogin(userId: string, username: string): string {
    const tempToken = Buffer.from(`${userId}:${username}:${Date.now()}:${Math.random()}`).toString(
      'base64'
    );

    this.pendingLogins.set(tempToken, {
      userId,
      username,
      expiresAt: new Date(Date.now() + this.PENDING_TTL),
    });

    // Clean up expired entries
    this.cleanupExpiredLogins();

    return tempToken;
  }

  /**
   * Validate a pending 2FA login token
   */
  validatePendingLogin(tempToken: string): PendingTwoFactorLogin | null {
    const pending = this.pendingLogins.get(tempToken);

    if (!pending) {
      return null;
    }

    if (pending.expiresAt < new Date()) {
      this.pendingLogins.delete(tempToken);
      return null;
    }

    return pending;
  }

  /**
   * Complete a pending 2FA login
   */
  completePendingLogin(tempToken: string): PendingTwoFactorLogin | null {
    const pending = this.validatePendingLogin(tempToken);

    if (pending) {
      this.pendingLogins.delete(tempToken);
    }

    return pending;
  }

  /**
   * Clean up expired login sessions
   */
  private cleanupExpiredLogins(): void {
    const now = new Date();
    for (const [token, login] of this.pendingLogins.entries()) {
      if (login.expiresAt < now) {
        this.pendingLogins.delete(token);
      }
    }
  }
}
