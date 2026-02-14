import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PolicyEvaluatorService } from '../policy-evaluator.service';
import { PERMISSION_KEY, PermissionMetadata } from '../decorators/require-permission.decorator';
import { User } from '../../entities/user.entity';

/**
 * Permission Guard
 *
 * Guards routes that require specific permissions.
 * Works with @RequirePermission decorator to check if the user
 * has the required permission based on ABAC policies.
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
      this.logger.warn(`Permission denied: No authenticated user for ${permission.resource}:${permission.action}`);
      throw new ForbiddenException('Authentication required');
    }

    // Evaluate permission using ABAC policy evaluator
    const hasPermission = await this.policyEvaluator.evaluate(
      user,
      permission.resource,
      permission.action,
    );

    if (!hasPermission) {
      this.logger.warn(
        `Permission denied: User ${user.username} cannot ${permission.action} on ${permission.resource}`,
      );
      throw new ForbiddenException(
        `You do not have permission to ${permission.action} on ${permission.resource}`,
      );
    }

    this.logger.debug(
      `Permission granted: User ${user.username} can ${permission.action} on ${permission.resource}`,
    );

    return true;
  }
}
