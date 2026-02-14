import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT Authentication Guard
 *
 * This is a placeholder implementation that will be fully implemented in Task 5.
 * For now, it throws an error indicating JWT auth is not yet available.
 *
 * TODO (Task 5): Implement full JWT authentication with:
 * - JWT token validation
 * - User extraction from token
 * - Token refresh logic
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(_context: ExecutionContext) {
    // Placeholder: JWT auth will be implemented in Task 5
    // For now, we throw an error to indicate this is not yet functional
    throw new UnauthorizedException('JWT authentication not yet implemented. Will be available in Task 5.');
  }
}
