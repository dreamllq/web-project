import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyService } from './api-key.service';
import { API_KEY_KEY } from './api-key.decorator';

/**
 * API Key Authentication Guard
 *
 * Authenticates requests using API keys from the X-API-Key header.
 * Validates the key, checks expiration and revocation status,
 * updates last used timestamp, and injects the user into the request.
 *
 * Usage:
 * @ApiKey()
 * @UseGuards(ApiKeyGuard)
 * @Get('data')
 * getData(@CurrentUser() user: User) { ... }
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeyService: ApiKeyService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const shouldUseApiKey = this.reflector.getAllAndOverride<boolean>(API_KEY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!shouldUseApiKey) {
      return false;
    }

    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('API key is missing');
    }

    try {
      const keyRecord = await this.apiKeyService.findByKey(apiKey);

      if (!keyRecord) {
        throw new UnauthorizedException('Invalid API key');
      }

      if (keyRecord.revokedAt) {
        throw new UnauthorizedException('API key has been revoked');
      }

      if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
        throw new UnauthorizedException('API key has expired');
      }

      if (!keyRecord.user) {
        throw new UnauthorizedException('User associated with API key not found');
      }

      // Fire-and-forget update to avoid blocking request (non-critical operation)
      this.apiKeyService.updateLastUsed(keyRecord.id).catch((error) => {
        this.logger.error(`Failed to update lastUsedAt for API key ${keyRecord.id}:`, error);
      });

      request.user = keyRecord.user;

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.error('API key validation failed:', error);
      throw new UnauthorizedException('API key validation failed');
    }
  }
}
