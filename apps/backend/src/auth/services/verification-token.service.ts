import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { VerificationToken, VerificationTokenType } from '../../entities/verification-token.entity';

/**
 * Token expiration times in milliseconds
 */
const TOKEN_EXPIRATION = {
  [VerificationTokenType.EMAIL_VERIFICATION]: 24 * 60 * 60 * 1000, // 24 hours
  [VerificationTokenType.PASSWORD_RESET]: 30 * 60 * 1000, // 30 minutes
};

@Injectable()
export class VerificationTokenService {
  private readonly logger = new Logger(VerificationTokenService.name);

  constructor(
    @InjectRepository(VerificationToken)
    private readonly tokenRepository: Repository<VerificationToken>
  ) {}

  /**
   * Generate a new verification token for a user
   * @param userId The user ID to associate with the token
   * @param type The type of verification token
   * @returns The generated token string
   */
  async generateToken(userId: string, type: VerificationTokenType): Promise<string> {
    // Generate a random 32-byte token and convert to hex string
    const token = randomBytes(32).toString('hex');

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRATION[type]);

    // Create and save the token record
    const verificationToken = this.tokenRepository.create({
      id: crypto.randomUUID(),
      userId,
      token,
      type,
      expiresAt,
      usedAt: null,
    });

    await this.tokenRepository.save(verificationToken);

    this.logger.log(`Generated ${type} token for user ${userId}`);

    return token;
  }

  /**
   * Validate a verification token
   * @param token The token string to validate
   * @param type The expected type of the token
   * @returns The VerificationToken entity if valid, null otherwise
   */
  async validateToken(
    token: string,
    type: VerificationTokenType
  ): Promise<VerificationToken | null> {
    const verificationToken = await this.tokenRepository.findOne({
      where: { token, type },
    });

    // Token not found
    if (!verificationToken) {
      this.logger.warn(`Token not found or type mismatch for token: ${token.substring(0, 8)}...`);
      return null;
    }

    // Token already used
    if (verificationToken.usedAt !== null) {
      this.logger.warn(`Token already used: ${token.substring(0, 8)}...`);
      return null;
    }

    // Token expired
    if (verificationToken.expiresAt < new Date()) {
      this.logger.warn(`Token expired: ${token.substring(0, 8)}...`);
      return null;
    }

    return verificationToken;
  }

  /**
   * Mark a token as used (single-use enforcement)
   * @param tokenId The ID of the token to mark as used
   */
  async markAsUsed(tokenId: string): Promise<void> {
    await this.tokenRepository.update(tokenId, {
      usedAt: new Date(),
    });

    this.logger.log(`Token ${tokenId} marked as used`);
  }

  /**
   * Invalidate all tokens of a specific type for a user
   * This is useful when generating a new token to ensure only one active token exists
   * @param userId The user ID
   * @param type The type of tokens to invalidate
   */
  async invalidateUserTokens(userId: string, type: VerificationTokenType): Promise<void> {
    const result = await this.tokenRepository.update(
      {
        userId,
        type,
        usedAt: null as unknown as Date, // Only update unused tokens
      },
      {
        usedAt: new Date(),
      }
    );

    this.logger.log(`Invalidated ${result.affected || 0} ${type} tokens for user ${userId}`);
  }

  /**
   * Find an active (unused and not expired) token for a user
   * @param userId The user ID
   * @param type The type of token
   * @returns The active token or null
   */
  async findActiveToken(
    userId: string,
    type: VerificationTokenType
  ): Promise<VerificationToken | null> {
    const now = new Date();

    const token = await this.tokenRepository.findOne({
      where: {
        userId,
        type,
        usedAt: null as unknown as Date,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    // Check if token is not expired
    if (token && token.expiresAt > now) {
      return token;
    }

    return null;
  }

  /**
   * Delete expired tokens from the database (cleanup operation)
   * @returns Number of deleted tokens
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.tokenRepository
      .createQueryBuilder()
      .delete()
      .where('expiresAt < :now', { now: new Date() })
      .execute();

    const deletedCount = result.affected || 0;
    this.logger.log(`Cleaned up ${deletedCount} expired tokens`);

    return deletedCount;
  }
}
