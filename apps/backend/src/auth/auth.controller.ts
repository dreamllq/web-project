import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  Headers,
  Get,
  Query,
  Res,
  Version,
  Ip,
  UnauthorizedException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService, LoginResponse } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SendPhoneCodeDto, VerifyPhoneDto } from './dto/phone-verification.dto';
import {
  ConfirmTwoFactorDto,
  VerifyTwoFactorDto,
  RecoveryCodeDto,
  DisableTwoFactorDto,
  RegenerateCodesDto,
} from './dto/two-factor.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { User } from '../entities/user.entity';
import { WechatOAuthService } from './oauth/wechat.service';
import {
  WechatMiniprogramService,
  WechatMiniprogramLoginDto,
} from './oauth/wechat-miniprogram.service';
import {
  DingtalkMiniprogramService,
  DingtalkMiniprogramLoginDto,
} from './oauth/dingtalk-miniprogram.service';
import { TwoFactorService, TwoFactorSetupResult } from './services/two-factor.service';
import { SmsServiceInterface } from '../sms/sms.service.interface';
import { SmsConfig } from '../config/sms.config';
import { UsersService } from '../users/users.service';
import { randomInt } from 'crypto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFactorService: TwoFactorService,
    private readonly wechatOAuthService: WechatOAuthService,
    private readonly wechatMiniprogramService: WechatMiniprogramService,
    private readonly dingtalkMiniprogramService: DingtalkMiniprogramService,
    private readonly configService: ConfigService,
    @Inject('SmsServiceInterface')
    private readonly smsService: SmsServiceInterface,
    private readonly usersService: UsersService
  ) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 requests per hour
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  @Post('login')
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    return this.authService.login(loginDto, {
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });
  }

  @Public()
  @Post('refresh')
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refresh_token);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: User, @Headers('authorization') auth?: string) {
    const token = auth?.replace('Bearer ', '') ?? '';
    await this.authService.logout(user.id, token);
    return { message: 'Logged out successfully' };
  }

  // ==================== OAuth Endpoints ====================

  @Public()
  @Get('oauth/wechat/url')
  async getWechatOAuthUrl(@Query('state') state?: string) {
    return this.wechatOAuthService.getAuthorizationUrl(state);
  }

  @Public()
  @Get('oauth/wechat/callback')
  async wechatOAuthCallback(
    @Query('code') code: string,
    @Query('state') _state: string,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const tokens = await this.wechatOAuthService.handleCallback(code, ip);

    // Get frontend URL from config or use default
    const frontendUrl =
      this.configService.get<string>('frontendUrl') ||
      process.env.FRONTEND_URL ||
      'http://localhost:5173';

    // Redirect to frontend with tokens in query params
    return res.redirect(
      `${frontendUrl}/auth/callback?access_token=${tokens.access_token}&refresh_token=${tokens.refresh_token}&expires_in=${tokens.expires_in}`
    );
  }

  // ==================== Miniprogram OAuth Endpoints ====================

  /**
   * WeChat miniprogram login
   * POST /api/auth/oauth/wechat-miniprogram
   */
  @Public()
  @Post('oauth/wechat-miniprogram')
  async wechatMiniprogramLogin(@Body() dto: WechatMiniprogramLoginDto, @Req() req: Request) {
    const ip = req.ip || req.socket.remoteAddress;
    return this.wechatMiniprogramService.login(dto, ip);
  }

  /**
   * DingTalk miniprogram login
   * POST /api/auth/oauth/dingtalk-miniprogram
   */
  @Public()
  @Post('oauth/dingtalk-miniprogram')
  async dingtalkMiniprogramLogin(@Body() dto: DingtalkMiniprogramLoginDto, @Req() req: Request) {
    const ip = req.ip || req.socket.remoteAddress;
    return this.dingtalkMiniprogramService.login(dto, ip);
  }

  // ==================== Email Verification Endpoints ====================

  /**
   * Request email verification
   * POST /api/v1/auth/verify-email/request
   * Requires authentication
   */
  @Version('1')
  @Post('verify-email/request')
  @UseGuards(JwtAuthGuard)
  async requestEmailVerification(@CurrentUser() user: User) {
    return this.authService.requestEmailVerification(user.id, user.email, user.username);
  }

  /**
   * Confirm email verification with token
   * POST /api/v1/auth/verify-email/confirm
   * Public endpoint - no authentication required
   */
  @Version('1')
  @Public()
  @Post('verify-email/confirm')
  async confirmEmailVerification(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  // ==================== Password Reset Endpoints ====================

  /**
   * Request password reset
   * POST /api/v1/auth/forgot-password
   * Public endpoint - no authentication required
   */
  @Version('1')
  @Public()
  @Throttle({ default: { limit: 1, ttl: 60000 } }) // 1 request per minute
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  /**
   * Reset password with token
   * POST /api/v1/auth/reset-password
   * Public endpoint - no authentication required
   */
  @Version('1')
  @Public()
  @Throttle({ default: { limit: 1, ttl: 60000 } }) // 1 request per minute
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  // ==================== Two-Factor Authentication Endpoints ====================

  /**
   * Start 2FA setup
   * POST /api/v1/auth/2fa/enable
   * Requires authentication
   */
  @Version('1')
  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  async enableTwoFactor(@CurrentUser() user: User): Promise<TwoFactorSetupResult> {
    return this.twoFactorService.enable(user.id);
  }

  /**
   * Confirm 2FA setup with verification code
   * POST /api/v1/auth/2fa/confirm
   * Requires authentication
   */
  @Version('1')
  @Post('2fa/confirm')
  @UseGuards(JwtAuthGuard)
  async confirmTwoFactor(
    @CurrentUser() user: User,
    @Body() dto: ConfirmTwoFactorDto
  ): Promise<{ success: boolean }> {
    return this.twoFactorService.confirmEnable(user.id, dto.secret, dto.code, dto.recoveryCodes);
  }

  /**
   * Disable 2FA
   * POST /api/v1/auth/2fa/disable
   * Requires authentication
   */
  @Version('1')
  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  async disableTwoFactor(
    @CurrentUser() user: User,
    @Body() dto: DisableTwoFactorDto
  ): Promise<{ success: boolean }> {
    return this.twoFactorService.disable(user.id, dto.password);
  }

  /**
   * Verify 2FA code during login
   * POST /api/v1/auth/2fa/verify
   * Public endpoint - uses temp token from login
   */
  @Version('1')
  @Public()
  @Post('2fa/verify')
  async verifyTwoFactor(
    @Body() dto: VerifyTwoFactorDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string
  ): Promise<LoginResponse> {
    // Validate temp token
    const pending = this.twoFactorService.validatePendingLogin(dto.tempToken);
    if (!pending) {
      throw new UnauthorizedException('Invalid or expired temporary token');
    }

    // Verify TOTP code
    const isValid = await this.twoFactorService.verify(pending.userId, dto.code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid verification code');
    }

    // Complete login
    return this.authService.completeTwoFactorLogin(dto.tempToken, {
      ipAddress: ip,
      userAgent,
    });
  }

  /**
   * Use recovery code during login
   * POST /api/v1/auth/2fa/recovery
   * Public endpoint - uses temp token from login
   */
  @Version('1')
  @Public()
  @Post('2fa/recovery')
  async useRecoveryCode(
    @Body() dto: RecoveryCodeDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string
  ): Promise<LoginResponse & { remainingCodes: number }> {
    // Validate temp token
    const pending = this.twoFactorService.validatePendingLogin(dto.tempToken);
    if (!pending) {
      throw new UnauthorizedException('Invalid or expired temporary token');
    }

    // Verify recovery code
    const result = await this.twoFactorService.verifyRecoveryCode(pending.userId, dto.recoveryCode);

    // Complete login
    const tokens = await this.authService.completeTwoFactorLogin(dto.tempToken, {
      ipAddress: ip,
      userAgent,
    });

    return {
      ...tokens,
      remainingCodes: result.remainingCodes,
    };
  }

  /**
   * Regenerate recovery codes
   * POST /api/v1/auth/2fa/recovery-codes
   * Requires authentication
   */
  @Version('1')
  @Post('2fa/recovery-codes')
  @UseGuards(JwtAuthGuard)
  async regenerateRecoveryCodes(
    @CurrentUser() user: User,
    @Body() dto: RegenerateCodesDto
  ): Promise<{ recoveryCodes: string[] }> {
    const codes = await this.twoFactorService.regenerateRecoveryCodes(user.id, dto.password);
    return { recoveryCodes: codes };
  }

  // ==================== Phone Verification Endpoints ====================

  /**
   * Send phone verification code
   * POST /api/v1/auth/phone/send
   * Requires authentication
   */
  @Version('1')
  @Post('phone/send')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send phone verification code (placeholder)' })
  @ApiResponse({ status: 201, description: 'Code sent successfully' })
  async sendPhoneCode(
    @Body() dto: SendPhoneCodeDto
  ): Promise<{ success: boolean; message: string; expiresIn: number }> {
    // Get SMS config
    const smsConfig = this.configService.get<SmsConfig>('sms');
    const codeLength = smsConfig?.codeLength || 6;
    const codeExpiry = smsConfig?.codeExpiry || 300;

    // Generate random code
    const code = Array.from({ length: codeLength }, () => randomInt(0, 10)).join('');

    // Send via SMS service (placeholder)
    const result = await this.smsService.sendVerificationCode(dto.phone, code);

    if (!result.success) {
      throw new BadRequestException(result.error || 'Failed to send verification code');
    }

    // In production, store code in Redis with expiry
    // For now, we just log it (DummySmsService already logs)

    return {
      success: true,
      message: 'Verification code sent',
      expiresIn: codeExpiry,
    };
  }

  /**
   * Verify phone number with code
   * POST /api/v1/auth/phone/verify
   * Requires authentication
   */
  @Version('1')
  @Post('phone/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify phone number' })
  @ApiResponse({ status: 201, description: 'Phone verified successfully' })
  async verifyPhone(
    @CurrentUser() user: User,
    @Body() dto: VerifyPhoneDto
  ): Promise<{ success: boolean; message: string }> {
    // In production, verify code from Redis
    // For placeholder, we use DummySmsService which always returns true
    if (!this.smsService.verifyCode) {
      throw new BadRequestException('SMS verification not configured');
    }

    const isValid = await this.smsService.verifyCode(dto.phone, dto.code);

    if (!isValid) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    // Update user's phone and phoneVerifiedAt
    await this.usersService.update(user.id, {
      phone: dto.phone,
      phoneVerifiedAt: new Date(),
    });

    return {
      success: true,
      message: 'Phone number verified successfully',
    };
  }
}
