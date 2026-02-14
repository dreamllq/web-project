import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService, CustomJwtPayload } from '../auth.service';
import { User } from '../../entities/user.entity';
import { JwtConfig } from '../../config/jwt.config';

/**
 * JWT Strategy
 *
 * Validates JWT tokens from the Authorization header.
 * Only accepts access tokens (type: 'access').
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    const jwtConfig = configService.get<JwtConfig>('jwt') ?? {
      secret: 'your-secret-key-change-in-production',
      accessTokenExpiresIn: '15m',
      refreshTokenExpiresIn: '7d',
    };

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConfig.secret,
    });
  }

  /**
   * Validate JWT payload
   *
   * @param payload - The decoded JWT payload
   * @returns The user object to be attached to the request
   */
  async validate(payload: CustomJwtPayload): Promise<User> {
    // Only accept access tokens
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.authService.validateUser(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
