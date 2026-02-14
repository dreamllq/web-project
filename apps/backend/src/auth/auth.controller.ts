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
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { User } from '../entities/user.entity';
import { WechatOAuthService } from './oauth/wechat.service';
import { WechatMiniprogramService, WechatMiniprogramLoginDto } from './oauth/wechat-miniprogram.service';
import { DingtalkMiniprogramService, DingtalkMiniprogramLoginDto } from './oauth/dingtalk-miniprogram.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly wechatOAuthService: WechatOAuthService,
    private readonly wechatMiniprogramService: WechatMiniprogramService,
    private readonly dingtalkMiniprogramService: DingtalkMiniprogramService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('login')
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    const ip = req.ip || req.socket.remoteAddress;
    return this.authService.login(loginDto, ip);
  }

  @Public()
  @Post('refresh')
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refresh_token);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentUser() user: User,
    @Headers('authorization') auth?: string,
  ) {
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
    @Res() res: Response,
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
      `${frontendUrl}/auth/callback?access_token=${tokens.access_token}&refresh_token=${tokens.refresh_token}&expires_in=${tokens.expires_in}`,
    );
  }

  // ==================== Miniprogram OAuth Endpoints ====================

  /**
   * WeChat miniprogram login
   * POST /api/auth/oauth/wechat-miniprogram
   */
  @Public()
  @Post('oauth/wechat-miniprogram')
  async wechatMiniprogramLogin(
    @Body() dto: WechatMiniprogramLoginDto,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    return this.wechatMiniprogramService.login(dto, ip);
  }

  /**
   * DingTalk miniprogram login
   * POST /api/auth/oauth/dingtalk-miniprogram
   */
  @Public()
  @Post('oauth/dingtalk-miniprogram')
  async dingtalkMiniprogramLogin(
    @Body() dto: DingtalkMiniprogramLoginDto,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    return this.dingtalkMiniprogramService.login(dto, ip);
  }
}
