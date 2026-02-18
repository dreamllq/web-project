import { SetMetadata } from '@nestjs/common';

export const ROLE_KEY = 'roles';

/**
 * Decorator to require specific roles for a route
 *
 * @example
 * @RequireRole('admin')
 * @Get('admin-only')
 * adminOnly() { ... }
 *
 * @example
 * @RequireRole('admin', 'editor')
 * @Get('manage')
 * manage() { ... }
 */
export const RequireRole = (...roles: string[]) => SetMetadata(ROLE_KEY, roles);
