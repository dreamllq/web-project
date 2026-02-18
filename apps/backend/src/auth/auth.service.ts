import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
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
import { VerificationTokenService } from './services/verification-token.service';
import { VerificationTokenType } from '../entities/verification-token.entity';
import { MailService } from '../mail/mail.service';
import { LoginHistoryService, LoginInfo } from '../users/services/login-history.service';
import { UserDeviceService, RegisterDeviceInput } from '../users/services/user-device.service';
import { LoginMethod } from '../entities/login-history.entity';

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
  require2FA?: boolean;
  tempToken?: string; // Temporary token for 2FA verification
}

export interface CustomJwtPayload {
  sub: string;
  username: string;
  type: 'access' | 'refresh';
}

export interface LoginContext {
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
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
    private readonly cacheService: CustomCacheService,
    private readonly verificationTokenService: VerificationTokenService,
    private readonly mailService: MailService,
    private readonly loginHistoryService: LoginHistoryService,
    private readonly userDeviceService: UserDeviceService
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

  async login(loginDto: LoginDto, context?: LoginContext): Promise<LoginResponse> {
    const { username, password } = loginDto;

    // Find user by username
    const user = await this.usersService.findByUsername(username);

    // Build login info for recording
    const loginInfo: LoginInfo = {
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      deviceFingerprint: context?.deviceFingerprint,
      loginMethod: LoginMethod.PASSWORD,
      success: false,
    };

    if (!user) {
      // Record failed login attempt with unknown user
      loginInfo.failureReason = 'user_not_found';
      await this.loginHistoryService.recordLogin(null, loginInfo);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user has a password (might be OAuth-only user)
    if (!user.passwordHash) {
      loginInfo.failureReason = 'no_password_set';
      await this.loginHistoryService.recordLogin(user.id, loginInfo);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await this.comparePassword(password, user.passwordHash);

    if (!isPasswordValid) {
      loginInfo.failureReason = 'invalid_password';
      await this.loginHistoryService.recordLogin(user.id, loginInfo);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is disabled
    if (user.status === UserStatus.DISABLED) {
      loginInfo.failureReason = 'account_disabled';
      await this.loginHistoryService.recordLogin(user.id, loginInfo);
      throw new UnauthorizedException('User account is disabled');
    }

    // Update last login
    await this.usersService.updateLastLogin(user.id, context?.ipAddress);

    // If user was pending, activate them after first login
    if (user.status === UserStatus.PENDING) {
      await this.usersService.updateStatus(user.id, UserStatus.ACTIVE);
    }

    // Check if user has 2FA enabled
    if (user.mfaEnabled) {
      // Don't generate tokens yet - require 2FA verification first
      // Create a temporary token for 2FA verification
      const tempToken = this.createTwoFactorPendingLogin(user.id, user.username);

      this.logger.log(`Login requires 2FA verification for user ${user.id}`);

      return {
        access_token: '',
        refresh_token: '',
        expires_in: 0,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          status: user.status,
        },
        require2FA: true,
        tempToken,
      };
    }

    // Record successful login
    loginInfo.success = true;
    await this.loginHistoryService.recordLogin(user.id, loginInfo);

    // Register device
    const deviceInput: RegisterDeviceInput = {
      userAgent: context?.userAgent,
      ipAddress: context?.ipAddress,
    };
    await this.userDeviceService.registerDevice(user.id, deviceInput);

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

  /**
   * Create a pending 2FA login session
   * Uses in-memory store (in production, use Redis)
   */
  private twoFactorPendingLogins = new Map<
    string,
    { userId: string; username: string; expiresAt: Date }
  >();
  private readonly TWO_FACTOR_TTL = 5 * 60 * 1000; // 5 minutes

  private createTwoFactorPendingLogin(userId: string, username: string): string {
    const tempToken = Buffer.from(`${userId}:${username}:${Date.now()}:${Math.random()}`).toString(
      'base64'
    );

    this.twoFactorPendingLogins.set(tempToken, {
      userId,
      username,
      expiresAt: new Date(Date.now() + this.TWO_FACTOR_TTL),
    });

    // Clean up expired entries
    const now = new Date();
    for (const [token, login] of this.twoFactorPendingLogins.entries()) {
      if (login.expiresAt < now) {
        this.twoFactorPendingLogins.delete(token);
      }
    }

    return tempToken;
  }

  /**
   * Validate a pending 2FA login token
   */
  validateTwoFactorPendingLogin(tempToken: string): { userId: string; username: string } | null {
    const pending = this.twoFactorPendingLogins.get(tempToken);

    if (!pending) {
      return null;
    }

    if (pending.expiresAt < new Date()) {
      this.twoFactorPendingLogins.delete(tempToken);
      return null;
    }

    return { userId: pending.userId, username: pending.username };
  }

  /**
   * Complete a pending 2FA login after successful verification
   * Returns the user info and removes the pending token
   */
  async completeTwoFactorLogin(tempToken: string, context?: LoginContext): Promise<LoginResponse> {
    const pending = this.twoFactorPendingLogins.get(tempToken);

    if (!pending || pending.expiresAt < new Date()) {
      this.twoFactorPendingLogins.delete(tempToken);
      throw new UnauthorizedException('Invalid or expired 2FA session');
    }

    // Remove the pending token (single use)
    this.twoFactorPendingLogins.delete(tempToken);

    // Get the user
    const user = await this.usersService.findById(pending.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Record successful login
    const loginInfo: LoginInfo = {
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      deviceFingerprint: context?.deviceFingerprint,
      loginMethod: LoginMethod.PASSWORD,
      success: true,
    };
    await this.loginHistoryService.recordLogin(user.id, loginInfo);

    // Register device
    const deviceInput: RegisterDeviceInput = {
      userAgent: context?.userAgent,
      ipAddress: context?.ipAddress,
    };
    await this.userDeviceService.registerDevice(user.id, deviceInput);

    // Generate tokens
    const tokens = await this.generateTokens(user);

    this.logger.log(`2FA login completed for user ${user.id}`);

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

  /**
   * Request email verification for a user
   * @param userId The user ID
   * @param email The user's email
   * @param username The user's username
   */
  async requestEmailVerification(
    userId: string,
    email: string | null,
    username: string
  ): Promise<{ success: true; message: string }> {
    // Check if user has an email
    if (!email) {
      throw new BadRequestException('User does not have an email address');
    }

    // Check if email is already verified
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.emailVerifiedAt) {
      throw new BadRequestException('Email is already verified');
    }

    // Invalidate any existing verification tokens for this user
    await this.verificationTokenService.invalidateUserTokens(
      userId,
      VerificationTokenType.EMAIL_VERIFICATION
    );

    // Generate a new verification token
    const token = await this.verificationTokenService.generateToken(
      userId,
      VerificationTokenType.EMAIL_VERIFICATION
    );

    // Send verification email
    await this.mailService.sendVerificationEmail(email, token, username);

    this.logger.log(`Email verification requested for user ${userId}`);

    return {
      success: true,
      message: 'Verification email sent',
    };
  }

  /**
   * Verify email with token
   * @param token The verification token
   */
  async verifyEmail(token: string): Promise<{ success: true; message: string }> {
    // Validate the token
    const verificationToken = await this.verificationTokenService.validateToken(
      token,
      VerificationTokenType.EMAIL_VERIFICATION
    );

    if (!verificationToken) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    // Get the user
    const user = await this.usersService.findById(verificationToken.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Check if email is already verified
    if (user.emailVerifiedAt) {
      throw new BadRequestException('Email is already verified');
    }

    // Mark the token as used
    await this.verificationTokenService.markAsUsed(verificationToken.id);

    // Update user's emailVerifiedAt
    await this.usersService.updateEmailVerifiedAt(user.id, new Date());

    this.logger.log(`Email verified for user ${user.id}`);

    return {
      success: true,
      message: 'Email verified successfully',
    };
  }

  /**
   * Request password reset
   * Always returns the same message to prevent user enumeration
   * @param email The user's email
   */
  async forgotPassword(email: string): Promise<{ success: true; message: string }> {
    // Find user by email
    const user = await this.usersService.findByEmail(email);

    // Always return the same response to prevent user enumeration
    const genericResponse = {
      success: true,
      message: 'If the email exists, a password reset link will be sent',
    } as const;

    // If user not found, still return generic response
    if (!user) {
      this.logger.log(`Password reset requested for non-existent email: ${email}`);
      return genericResponse;
    }

    // Check if user has a password (OAuth-only users cannot reset password)
    if (!user.passwordHash) {
      this.logger.log(`Password reset requested for OAuth-only user: ${user.id}`);
      return genericResponse;
    }

    // Invalidate any existing password reset tokens for this user
    await this.verificationTokenService.invalidateUserTokens(
      user.id,
      VerificationTokenType.PASSWORD_RESET
    );

    // Generate a new password reset token
    const token = await this.verificationTokenService.generateToken(
      user.id,
      VerificationTokenType.PASSWORD_RESET
    );

    // Send password reset email
    if (user.email) {
      await this.mailService.sendPasswordResetEmail(user.email, token, user.username);
    }

    this.logger.log(`Password reset email sent for user ${user.id}`);

    return genericResponse;
  }

  /**
   * Reset password with token
   * @param token The password reset token
   * @param newPassword The new password
   */
  async resetPassword(
    token: string,
    newPassword: string
  ): Promise<{ success: true; message: string }> {
    // Validate the token
    const verificationToken = await this.verificationTokenService.validateToken(
      token,
      VerificationTokenType.PASSWORD_RESET
    );

    if (!verificationToken) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    // Get the user
    const user = await this.usersService.findById(verificationToken.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Hash the new password
    const passwordHash = await this.hashPassword(newPassword);

    // Update user's password
    await this.usersService.updatePassword(user.id, passwordHash);

    // Mark the token as used (single-use enforcement)
    await this.verificationTokenService.markAsUsed(verificationToken.id);

    this.logger.log(`Password reset successful for user ${user.id}`);

    return {
      success: true,
      message: 'Password reset successfully',
    };
  }
}
