import { SetMetadata } from '@nestjs/common';

export const AUDIT_LOG_KEY = 'audit_log';

export interface AuditLogMetadata {
  action: string;
  resourceType: string;
}

/**
 * AuditLog Decorator
 *
 * Marks a controller method for audit logging.
 * The AuditLogInterceptor will automatically capture and record
 * the request/response data for decorated methods.
 *
 * @param action - The action being performed (e.g., 'create', 'update', 'delete')
 * @param resourceType - The type of resource being accessed (e.g., 'user', 'policy')
 *
 * @example
 * @Post()
 * @AuditLog('create', 'user')
 * createUser(@Body() dto: CreateUserDto) { ... }
 *
 * @example
 * @Delete(':id')
 * @AuditLog('delete', 'policy')
 * remove(@Param('id') id: string) { ... }
 */
export const AuditLog = (action: string, resourceType: string) =>
  SetMetadata(AUDIT_LOG_KEY, { action, resourceType } as AuditLogMetadata);
