import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PolicyEvaluatorService } from '../policy-evaluator.service';
import { RoleService } from '../../rbac/role.service';
import { PERMISSION_KEY, PermissionMetadata } from '../decorators/require-permission.decorator';
import { User } from '../../entities/user.entity';

/**
 * Permission Guard
 *
 * Guards routes that require specific permissions.
 * Works with @RequirePermission decorator to check if the user
 * has the required permission based on ABAC policies first, then RBAC.
 *
 * Permission check flow: ABAC → RBAC → either passes = allowed
 *
 * @example
 * @UseGuards(JwtAuthGuard, PermissionGuard)
 * @Get('policies')
 * @RequirePermission('policy', 'read')
 * findAll() { ... }
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly policyEvaluator: PolicyEvaluatorService,
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

    // Step 1: Try ABAC policy evaluation
    const abacResult = await this.policyEvaluator.evaluate(
      user,
      permission.resource,
      permission.action
    );

    if (abacResult) {
      this.logger.debug(
        `Permission granted via ABAC: User ${user.username} can ${permission.action} on ${permission.resource}`
      );
      return true;
    }

    // Step 2: Try RBAC permission check
    const rbacResult = await this.checkRbacPermission(
      user.id,
      permission.resource,
      permission.action
    );

    if (rbacResult) {
      this.logger.debug(
        `Permission granted via RBAC: User ${user.username} can ${permission.action} on ${permission.resource}`
      );
      return true;
    }

    // Both ABAC and RBAC denied
    this.logger.warn(
      `Permission denied: User ${user.username} cannot ${permission.action} on ${permission.resource}`
    );
    throw new ForbiddenException(
      `You do not have permission to ${permission.action} on ${permission.resource}`
    );
  }

  /**
   * Check RBAC permissions
   */
  private async checkRbacPermission(
    userId: string,
    resource: string,
    action: string
  ): Promise<boolean> {
    try {
      const permissions = await this.roleService.getUserPermissions(userId);

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
    } catch (error) {
      this.logger.error('Error checking RBAC permissions', error);
      return false;
    }
  }
}
