import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleService } from '../../rbac/role.service';
import { ROLE_KEY } from '../decorators/require-role.decorator';
import { User } from '../../entities/user.entity';

/**
 * Role Guard
 *
 * Guards routes that require specific roles.
 * Works with @RequireRole decorator to check if the user
 * has any of the required roles.
 *
 * @example
 * @UseGuards(JwtAuthGuard, RoleGuard)
 * @RequireRole('admin')
 * @Get('admin-only')
 * adminOnly() { ... }
 *
 * @example
 * @UseGuards(JwtAuthGuard, RoleGuard)
 * @RequireRole('admin', 'editor')
 * @Get('manage')
 * manage() { ... }
 */
@Injectable()
export class RoleGuard implements CanActivate {
  private readonly logger = new Logger(RoleGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly roleService: RoleService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required roles from decorator
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as User | undefined;

    // If no authenticated user, deny access
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Check if user has any of the required roles
    for (const roleName of requiredRoles) {
      const hasRole = await this.roleService.hasRole(user.id, roleName);
      if (hasRole) {
        this.logger.debug(`Role check passed: User ${user.username} has role '${roleName}'`);
        return true;
      }
    }

    this.logger.warn(
      `Role check failed: User ${user.username} does not have any of the required roles: ${requiredRoles.join(', ')}`
    );
    throw new ForbiddenException('You do not have the required role');
  }
}
