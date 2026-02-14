import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AuthService, TokenResponse } from '../auth.service';
import { UsersService } from '../../users/users.service';
import { SocialProvider } from '../../entities/social-account.entity';

/**
 * Response from WeChat miniprogram jscode2session API
 */
interface WeChatMiniprogramSessionResponse {
  openid: string;
  session_key: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

/**
 * DTO for WeChat miniprogram login
 */
export interface WechatMiniprogramLoginDto {
  code: string;
  userInfo?: {
    nickName?: string;
    avatarUrl?: string;
    gender?: number;
    city?: string;
    province?: string;
    country?: string;
  };
}

/**
 * WeChat miniprogram configuration
 */
interface WechatMiniprogramConfig {
  appId: string;
  appSecret: string;
}

@Injectable()
export class WechatMiniprogramService {
  private readonly logger = new Logger(WechatMiniprogramService.name);
  private readonly JSCODE2SESSION_URL = 'https://api.weixin.qq.com/sns/jscode2session';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Login with WeChat miniprogram code
   * 1. Exchange code for session_key and openid
   * 2. Find or create user by openid
   * 3. Generate JWT tokens
   */
  async login(dto: WechatMiniprogramLoginDto, ip?: string): Promise<TokenResponse> {
    this.logger.log('Processing WeChat miniprogram login');

    // 1. Exchange code for session
    const sessionResponse = await this.code2Session(dto.code);
    const { openid, unionid } = sessionResponse;

    // 2. Find existing social account or create new user
    const socialAccount = await this.usersService.findSocialAccount(
      SocialProvider.WECHAT_MINIPROGRAM,
      openid,
    );

    let user;
    if (socialAccount) {
      // User exists, get the associated user
      user = socialAccount.user;
      this.logger.log(`Found existing user for WeChat miniprogram openid: ${openid}`);
    } else {
      // Create new user with WeChat info
      const username = this.usersService.generateOAuthUsername(
        SocialProvider.WECHAT_MINIPROGRAM,
        openid,
      );

      user = await this.usersService.createOAuthUser({
        username,
        nickname: dto.userInfo?.nickName,
        avatarUrl: dto.userInfo?.avatarUrl,
      });

      // Create social account link
      await this.usersService.createSocialAccount(
        user.id,
        SocialProvider.WECHAT_MINIPROGRAM,
        openid,
        {
          unionid,
          nickname: dto.userInfo?.nickName,
          avatarUrl: dto.userInfo?.avatarUrl,
          gender: dto.userInfo?.gender,
          city: dto.userInfo?.city,
          province: dto.userInfo?.province,
          country: dto.userInfo?.country,
        },
      );

      this.logger.log(`Created new user for WeChat miniprogram openid: ${openid}`);
    }

    // 3. Update last login
    await this.usersService.updateLastLogin(user.id, ip);

    // 4. Generate JWT tokens
    return this.authService.generateTokens(user);
  }

  /**
   * Exchange code for session_key and openid
   */
  private async code2Session(code: string): Promise<WeChatMiniprogramSessionResponse> {
    const config = this.configService.get<WechatMiniprogramConfig>('wechatMiniprogram');
    if (!config?.appId || !config?.appSecret) {
      throw new UnauthorizedException('WeChat miniprogram configuration is missing');
    }

    const params = new URLSearchParams({
      appid: config.appId,
      secret: config.appSecret,
      js_code: code,
      grant_type: 'authorization_code',
    });

    const url = `${this.JSCODE2SESSION_URL}?${params.toString()}`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<WeChatMiniprogramSessionResponse>(url),
      );

      const data = response.data;

      // Check for error response
      if (data.errcode && data.errcode !== 0) {
        this.logger.error(`WeChat miniprogram API error: ${data.errcode} - ${data.errmsg}`);
        throw new UnauthorizedException(`WeChat miniprogram login failed: ${data.errmsg}`);
      }

      this.logger.log(`Successfully obtained session for openid: ${data.openid}`);
      return data;
    } catch (error) {
      this.logger.error('Failed to get WeChat miniprogram session', error);
      throw new UnauthorizedException('Failed to authenticate with WeChat miniprogram');
    }
  }
}
