import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { CustomCacheService } from '../custom-cache/custom-cache.service';
import { CacheKeyPrefix } from '../custom-cache/custom-cache.constants';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User, UserStatus } from '../entities/user.entity';
import { JwtConfig } from '../config/jwt.config';

export interface RegisterResponse {
  id: string;
  username: string;
  status: UserStatus;
  createdAt: Date;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: {
    id: string;
    username: string;
    email: string | null;
    phone: string | null;
    status: UserStatus;
  };
}

export interface CustomJwtPayload {
  sub: string;
  username: string;
  type: 'access' | 'refresh';
}

@Injectable()
export class AuthService {
  private readonly SALT_ROUNDS = 10;
  private readonly ACCESS_TOKEN_TTL = 900; // 15 minutes in seconds
  private readonly REFRESH_TOKEN_TTL = 604800; // 7 days in seconds
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly cacheService: CustomCacheService
  ) {}

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  async comparePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * Generate access and refresh tokens for a user
   */
  async generateTokens(user: User): Promise<TokenResponse> {
    const accessPayload: CustomJwtPayload = {
      sub: user.id,
      username: user.username,
      type: 'access',
    };

    const refreshPayload: CustomJwtPayload = {
      sub: user.id,
      username: user.username,
      type: 'refresh',
    };

    const jwtConfig = this.configService.get<JwtConfig>('jwt') ?? {
      secret: 'your-secret-key-change-in-production',
      accessTokenExpiresIn: '15m',
      refreshTokenExpiresIn: '7d',
    };

    // Use number for expiresIn to avoid type issues with StringValue
    const access_token = this.jwtService.sign(accessPayload, {
      secret: jwtConfig.secret,
      expiresIn: this.ACCESS_TOKEN_TTL,
    });

    const refresh_token = this.jwtService.sign(refreshPayload, {
      secret: jwtConfig.secret,
      expiresIn: this.REFRESH_TOKEN_TTL,
    });

    return {
      access_token,
      refresh_token,
      expires_in: this.ACCESS_TOKEN_TTL,
    };
  }

  /**
   * Validate refresh token and issue new tokens
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    // Check if token is blacklisted
    const isBlacklisted = await this.isTokenBlacklisted(refreshToken);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const jwtConfig = this.configService.get<JwtConfig>('jwt') ?? {
      secret: 'your-secret-key-change-in-production',
      accessTokenExpiresIn: '15m',
      refreshTokenExpiresIn: '7d',
    };

    try {
      const payload = this.jwtService.verify<CustomJwtPayload>(refreshToken, {
        secret: jwtConfig.secret,
      });

      // Verify this is a refresh token
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Get the user
      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Check if user is still active
      if (user.status === UserStatus.DISABLED) {
        throw new UnauthorizedException('User account is disabled');
      }

      // Blacklist the old refresh token
      await this.blacklistToken(refreshToken, this.REFRESH_TOKEN_TTL);

      // Generate new tokens
      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Logout user by blacklisting tokens
   */
  async logout(userId: string, accessToken: string): Promise<void> {
    this.logger.log(`Logging out user: ${userId}`);

    // Blacklist the access token
    await this.blacklistToken(accessToken, this.ACCESS_TOKEN_TTL);

    // Note: Refresh token should also be blacklisted by the client
    // sending it to a separate endpoint if needed
  }

  /**
   * Validate access token and return user
   */
  async validateAccessToken(token: string): Promise<User> {
    // Check if token is blacklisted
    const isBlacklisted = await this.isTokenBlacklisted(token);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const jwtConfig = this.configService.get<JwtConfig>('jwt') ?? {
      secret: 'your-secret-key-change-in-production',
      accessTokenExpiresIn: '15m',
      refreshTokenExpiresIn: '7d',
    };

    try {
      const payload = this.jwtService.verify<CustomJwtPayload>(token, {
        secret: jwtConfig.secret,
      });

      // Verify this is an access token
      if (payload.type !== 'access') {
        throw new UnauthorizedException('Invalid token type');
      }

      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return user;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /**
   * Check if token is in Redis blacklist
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const key = `${CacheKeyPrefix.BLACKLIST}:${token}`;
    const result = await this.cacheService.get(key);
    return result !== null && result !== undefined;
  }

  /**
   * Add token to Redis blacklist with TTL
   */
  private async blacklistToken(token: string, ttl: number): Promise<void> {
    const key = `${CacheKeyPrefix.BLACKLIST}:${token}`;
    await this.cacheService.set(key, '1', ttl * 1000); // TTL in milliseconds
  }

  /**
   * Validate user by ID (used by JWT strategy)
   */
  async validateUser(userId: string): Promise<User | null> {
    return this.usersService.findById(userId);
  }

  async register(registerDto: RegisterDto): Promise<RegisterResponse> {
    const { username, password, email, phone } = registerDto;

    // Hash password
    const passwordHash = await this.hashPassword(password);

    // Create user
    const user = await this.usersService.create({
      username,
      passwordHash,
      email,
      phone,
    });

    return {
      id: user.id,
      username: user.username,
      status: user.status,
      createdAt: user.createdAt,
    };
  }

  async login(loginDto: LoginDto, ip?: string): Promise<LoginResponse> {
    const { username, password } = loginDto;

    // Find user by username
    const user = await this.usersService.findByUsername(username);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user has a password (might be OAuth-only user)
    if (!user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await this.comparePassword(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is disabled
    if (user.status === UserStatus.DISABLED) {
      throw new UnauthorizedException('User account is disabled');
    }

    // Update last login
    await this.usersService.updateLastLogin(user.id, ip);

    // If user was pending, activate them after first login
    if (user.status === UserStatus.PENDING) {
      await this.usersService.updateStatus(user.id, UserStatus.ACTIVE);
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      ...tokens,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        status: user.status,
      },
    };
  }
}
