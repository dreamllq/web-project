import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class RecoveryCodeService {
  private readonly logger = new Logger(RecoveryCodeService.name);
  private readonly SALT_ROUNDS = 10;

  /**
   * Generate recovery codes
   * Format: XXXX-XXXX (8 uppercase alphanumeric characters)
   * @param count Number of codes to generate (default: 10)
   */
  generateCodes(count: number = 10): string[] {
    const codes: string[] = [];

    for (let i = 0; i < count; i++) {
      const code = this.generateSingleCode();
      codes.push(code);
    }

    this.logger.log(`Generated ${count} recovery codes`);
    return codes;
  }

  /**
   * Generate a single recovery code
   * Format: XXXX-XXXX
   */
  private generateSingleCode(): string {
    // Generate random bytes and convert to uppercase alphanumeric
    const bytes = randomBytes(4); // 4 bytes = 8 hex chars
    const part1 = bytes.toString('hex').toUpperCase().slice(0, 4);
    const part2 = bytes.toString('hex').toUpperCase().slice(4, 8);
    return `${part1}-${part2}`;
  }

  /**
   * Hash recovery codes for storage
   * @param codes Plain text codes to hash
   * @returns Array of hashed codes
   */
  async hashCodes(codes: string[]): Promise<string[]> {
    const hashedCodes: string[] = [];

    for (const code of codes) {
      const hashed = await bcrypt.hash(code, this.SALT_ROUNDS);
      hashedCodes.push(hashed);
    }

    this.logger.log(`Hashed ${hashedCodes.length} recovery codes`);
    return hashedCodes;
  }

  /**
   * Verify a recovery code against hashed codes
   * @param hashedCodes Array of hashed codes
   * @param inputCode The code to verify
   * @returns Index of the matching code, or -1 if not found/already used
   */
  async verifyCode(hashedCodes: string[], inputCode: string): Promise<number> {
    // Normalize input code format (remove dashes, uppercase)
    const normalizedInput = inputCode.toUpperCase().replace(/-/g, '');

    // Reconstruct the expected format: XXXX-XXXX
    const formattedInput = `${normalizedInput.slice(0, 4)}-${normalizedInput.slice(4, 8)}`;

    for (let i = 0; i < hashedCodes.length; i++) {
      const hashedCode = hashedCodes[i];
      if (!hashedCode) continue;

      const isValid = await bcrypt.compare(formattedInput, hashedCode);

      if (isValid) {
        this.logger.log(`Recovery code verified at index ${i}`);
        return i;
      }
    }

    this.logger.warn('Recovery code verification failed: no matching code found');
    return -1;
  }

  /**
   * Remove a used code from the array
   * @param hashedCodes Array of hashed codes
   * @param index Index of code to consume
   * @returns New array without the consumed code
   */
  consumeCode(hashedCodes: string[], index: number): string[] {
    if (index < 0 || index >= hashedCodes.length) {
      this.logger.warn(`Invalid code index: ${index}`);
      return hashedCodes;
    }

    // Remove the code at the specified index
    const newCodes = [...hashedCodes];
    newCodes.splice(index, 1);

    this.logger.log(`Recovery code consumed at index ${index}, ${newCodes.length} remaining`);

    return newCodes;
  }

  /**
   * Count remaining recovery codes
   */
  countRemaining(hashedCodes: string[]): number {
    return hashedCodes.length;
  }
}
