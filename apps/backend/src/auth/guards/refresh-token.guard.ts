import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

/**
 * Refresh Token Guard
 *
 * Used to validate refresh tokens for the token refresh endpoint.
 * Unlike JwtAuthGuard, this guard validates refresh tokens specifically.
 *
 * Note: For the refresh endpoint, we don't use this guard directly
 * but instead validate the refresh token in the service layer.
 * This guard is provided for potential future use cases.
 */
@Injectable()
export class RefreshTokenGuard extends AuthGuard('jwt-refresh') {
  constructor() {
    super();
  }

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const refreshToken = request.body?.refresh_token;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(
    err: Error | null,
    user: TUser | false,
    _info: unknown,
  ): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid or expired refresh token');
    }
    return user;
  }
}
