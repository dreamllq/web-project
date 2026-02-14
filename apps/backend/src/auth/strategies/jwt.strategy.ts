import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

/**
 * JWT Strategy
 *
 * This is a placeholder implementation that will be fully implemented in Task 5.
 * For now, it provides the basic structure for JWT validation.
 *
 * TODO (Task 5): Implement full JWT strategy with:
 * - Proper secret key from configuration
 * - Token expiration handling
 * - User validation from database
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    // Placeholder configuration - will be properly configured in Task 5
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: 'PLACEHOLDER_SECRET_WILL_BE_REPLACED_IN_TASK_5',
    });
  }

  /**
   * Validate JWT payload
   *
   * @param payload - The decoded JWT payload
   * @returns The user object to be attached to the request
   */
  async validate(payload: any) {
    // Placeholder: Will be implemented in Task 5
    // This should validate the user exists and return user data
    if (!payload || !payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    return {
      userId: payload.sub,
      username: payload.username,
    };
  }
}
