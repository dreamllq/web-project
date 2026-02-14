import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'permission';

export interface PermissionMetadata {
  resource: string;
  action: string;
}

/**
 * RequirePermission Decorator
 *
 * Marks a controller method as requiring specific permission.
 * The PermissionGuard will check if the user has the required permission.
 *
 * @param resource - The resource being accessed (e.g., 'user', 'policy', 'file')
 * @param action - The action being performed (e.g., 'read', 'write', 'delete')
 *
 * @example
 * @Get('profile')
 * @RequirePermission('user', 'read')
 * getProfile() { ... }
 *
 * @example
 * @Post()
 * @RequirePermission('policy', 'create')
 * create(@Body() dto: CreatePolicyDto) { ... }
 */
export const RequirePermission = (resource: string, action: string) =>
  SetMetadata(PERMISSION_KEY, { resource, action } as PermissionMetadata);
