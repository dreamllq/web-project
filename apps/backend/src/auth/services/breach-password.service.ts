import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

/**
 * Response from breach password check
 */
export interface BreachCheckResult {
  /** Whether the password has been compromised in a known data breach */
  compromised: boolean;
  /** Number of times the password appears in breaches (only when compromised is true) */
  count?: number;
}

/**
 * Service for checking if passwords have been compromised in known data breaches
 * using the Have I Been Pwned (HIBP) k-anonymity API.
 *
 * The k-anonymity approach ensures we never send the full password or full hash to the API:
 * 1. SHA1 hash the password
 * 2. Send only first 5 characters of the hash to the API
 * 3. API returns all hash suffixes that match the prefix
 * 4. We check locally if our full hash suffix is in the response
 */
@Injectable()
export class BreachPasswordService {
  private readonly logger = new Logger(BreachPasswordService.name);
  private readonly HIBP_API_URL = 'https://api.pwnedpasswords.com/range';
  private readonly TIMEOUT_MS = 5000; // 5 seconds timeout

  /**
   * Check if a password has been compromised in known data breaches
   *
   * @param password The plain text password to check
   * @returns BreachCheckResult indicating if password is compromised and breach count
   */
  async checkPassword(password: string): Promise<BreachCheckResult> {
    try {
      // Step 1: Hash the password with SHA1
      const hash = createHash('sha1').update(password).digest('hex').toUpperCase();

      // Step 2: Split into prefix (5 chars) and suffix (remaining 35 chars)
      const prefix = hash.substring(0, 5);
      const suffix = hash.substring(5);

      // Step 3: Query HIBP API with the prefix
      const response = await this.fetchWithTimeout(`${this.HIBP_API_URL}/${prefix}`);

      if (!response.ok) {
        this.logger.warn(`HIBP API returned status ${response.status}, skipping breach check`);
        return { compromised: false };
      }

      // Step 4: Parse response and check if our suffix exists
      const body = await response.text();
      const result = this.parseHIBPResponse(body, suffix);

      if (result.compromised) {
        this.logger.warn(`Password found in breach database with ${result.count} occurrences`);
      }

      return result;
    } catch (error) {
      // Graceful degradation: Log warning but don't fail
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`HIBP API unavailable, skipping breach check: ${errorMessage}`);
      return { compromised: false };
    }
  }

  /**
   * Fetch URL with timeout using AbortController
   */
  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'WebProject-BreachPasswordCheck/1.0',
        },
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse HIBP API response and check if the suffix exists
   *
   * Response format: "SUFFIX1:COUNT1\r\nSUFFIX2:COUNT2\r\n..."
   *
   * @param body The raw response body from HIBP API
   * @param suffix The suffix to search for (35 characters)
   * @returns BreachCheckResult with compromise status and count
   */
  private parseHIBPResponse(body: string, suffix: string): BreachCheckResult {
    // HIBP response uses CRLF line endings
    const lines = body.split(/\r?\n/);

    for (const line of lines) {
      // Each line format: "SUFFIX:COUNT"
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const lineSuffix = line.substring(0, colonIndex).toUpperCase();
      const countStr = line.substring(colonIndex + 1);

      if (lineSuffix === suffix) {
        const count = parseInt(countStr, 10);
        return {
          compromised: true,
          count: isNaN(count) ? undefined : count,
        };
      }
    }

    return { compromised: false };
  }
}
