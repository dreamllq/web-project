import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';
import { PolicyEvaluatorService } from '../policy-evaluator.service';
import { PermissionCacheService } from '../services/permission-cache.service';
import { RoleService } from '../../rbac/role.service';
import { PERMISSION_KEY, PermissionMetadata } from '../decorators/require-permission.decorator';
import { User } from '../../entities/user.entity';

/**
 * Permission Guard - RBAC + ABAC AND Logic
 *
 * Guards routes that require specific permissions.
 * Works with @RequirePermission decorator to check permissions.
 *
 * Permission check flow (AND logic):
 * 1. Check user.isSuperuser → true = bypass all checks
 * 2. RBAC check: user has resource:action permission?
 * 3. RBAC fail → 403 Forbidden (stop here, no ABAC)
 * 4. Write operation: ABAC data-level check
 * 5. ABAC fail → 403 Forbidden
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly policyEvaluator: PolicyEvaluatorService,
    private readonly permissionCache: PermissionCacheService,
    @Inject(forwardRef(() => RoleService))
    private readonly roleService: RoleService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get permission metadata from handler
    const permission = this.reflector.getAllAndOverride<PermissionMetadata>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no permission is required, allow access
    if (!permission) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as User | undefined;

    // If no authenticated user, deny access
    if (!user) {
      this.logger.warn(
        `Permission denied: No authenticated user for ${permission.resource}:${permission.action}`
      );
      throw new ForbiddenException('Authentication required');
    }

    // Step 1: Superuser bypass
    if (user.isSuperuser) {
      this.logger.debug(
        `Superuser bypass: User ${user.username} can ${permission.action} on ${permission.resource}`
      );
      return true;
    }

    // Step 2: RBAC check - get cached permissions
    let userPermissions = await this.permissionCache.getUserPermissions(user.id);
    if (!userPermissions) {
      // Cache miss - recover by fetching from database and caching
      this.logger.debug(`Permission cache miss for user ${user.username}. Fetching from database...`);
      userPermissions = await this.roleService.getUserPermissions(user.id);
      await this.permissionCache.setUserPermissions(user.id, userPermissions);
      this.logger.debug(`Permission cache recovered for user ${user.username}: ${userPermissions.length} permissions`);
    }

    // Check for RBAC permission
    const hasRbacPermission = this.checkRbacPermission(
      userPermissions,
      permission.resource,
      permission.action
    );

    if (!hasRbacPermission) {
      // RBAC fail → 403 (no ABAC check)
      this.logger.warn(
        `RBAC denied: User ${user.username} cannot ${permission.action} on ${permission.resource}`
      );
      throw new ForbiddenException({
        message: `You do not have permission to ${permission.action} on ${permission.resource}`,
        details: {
          resource: permission.resource,
          action: permission.action,
          reason: 'rbac_denied',
          suggestion: `Contact administrator to get '${permission.resource}:${permission.action}' permission`,
        },
      });
    }

    // Step 3: RBAC passed - for write operations, check ABAC
    const isWriteOperation = ['create', 'update', 'delete', 'write'].includes(permission.action);

    if (isWriteOperation) {
      // Get dataId from params if available
      const dataId = request.params?.id;

      if (dataId) {
        const canAccess = await this.policyEvaluator.canAccessData(
          user,
          permission.resource,
          permission.action,
          dataId
        );

        if (!canAccess) {
          this.logger.warn(
            `ABAC denied: User ${user.username} cannot ${permission.action} on ${permission.resource}:${dataId}`
          );
          throw new ForbiddenException({
            message: `You do not have permission to ${permission.action} on this ${permission.resource}`,
            details: {
              resource: permission.resource,
              action: permission.action,
              dataId,
              reason: 'abac_denied',
            },
          });
        }
      }
    }

    // All checks passed
    this.logger.debug(
      `Permission granted: User ${user.username} can ${permission.action} on ${permission.resource}`
    );
    return true;
  }

  /**
   * Check RBAC permissions against cached permission list
   */
  private checkRbacPermission(permissions: string[], resource: string, action: string): boolean {
    // Check for exact permission: "resource:action"
    const exactPermission = `${resource}:${action}`;
    if (permissions.includes(exactPermission)) {
      return true;
    }

    // Check for wildcard permissions
    const resourceWildcard = `${resource}:*`;
    const actionWildcard = `*:${action}`;
    const fullWildcard = '*:*';

    return permissions.some(
      (p) => p === resourceWildcard || p === actionWildcard || p === fullWildcard
    );
  }
}
