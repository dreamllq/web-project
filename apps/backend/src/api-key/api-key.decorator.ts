import { SetMetadata } from '@nestjs/common';

export const API_KEY_KEY = 'apiKey';

/**
 * API Key decorator
 *
 * Marks a route as accepting API key authentication.
 * The ApiKeyGuard will validate the X-API-Key header and authenticate the request.
 *
 * @example
 * @ApiKey()
 * @Get('data')
 * getData(@CurrentUser() user: User) { ... }
 */
export const ApiKey = () => SetMetadata(API_KEY_KEY, true);
