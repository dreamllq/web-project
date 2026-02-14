import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AuthService, TokenResponse } from '../auth.service';
import { UsersService } from '../../users/users.service';
import { SocialProvider } from '../../entities/social-account.entity';
import { WeChatConfig } from '../../config/wechat.config';
import {
  WeChatAccessTokenResponse,
  WeChatUserInfo,
  WeChatAuthUrlResponse,
  WeChatErrorResponse,
} from './wechat.dto';

@Injectable()
export class WechatOAuthService {
  private readonly logger = new Logger(WechatOAuthService.name);
  private readonly WECHAT_AUTH_URL = 'https://open.weixin.qq.com/connect/qrconnect';
  private readonly WECHAT_ACCESS_TOKEN_URL = 'https://api.weixin.qq.com/sns/oauth2/access_token';
  private readonly WECHAT_USERINFO_URL = 'https://api.weixin.qq.com/sns/userinfo';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Generate WeChat OAuth authorization URL
   */
  async getAuthorizationUrl(state?: string): Promise<WeChatAuthUrlResponse> {
    const config = this.configService.get<WeChatConfig>('wechat');
    if (!config?.appId || !config?.redirectUri) {
      throw new Error('WeChat OAuth configuration is missing');
    }

    const params = new URLSearchParams({
      appid: config.appId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: 'snsapi_login',
      state: state || Math.random().toString(36).substring(7),
    });

    const url = `${this.WECHAT_AUTH_URL}?${params.toString()}#wechat_redirect`;
    this.logger.log(`Generated WeChat OAuth URL with state: ${state || 'random'}`);

    return { url };
  }

  /**
   * Handle WeChat OAuth callback
   * 1. Exchange code for access_token
   * 2. Get user info
   * 3. Find or create user
   * 4. Generate JWT tokens
   */
  async handleCallback(code: string, ip?: string): Promise<TokenResponse> {
    this.logger.log('Processing WeChat OAuth callback');

    // 1. Exchange code for access token
    const tokenResponse = await this.getAccessToken(code);
    const { access_token, openid, unionid } = tokenResponse;

    // 2. Get user info from WeChat
    const userInfo = await this.getUserInfo(access_token, openid);

    // 3. Find existing social account or create new user
    const socialAccount = await this.usersService.findSocialAccount(
      SocialProvider.WECHAT,
      openid,
    );

    let user;
    if (socialAccount) {
      // User exists, get the associated user
      user = socialAccount.user;
      this.logger.log(`Found existing user for WeChat openid: ${openid}`);
    } else {
      // Create new user with WeChat info
      const username = this.usersService.generateOAuthUsername(
        SocialProvider.WECHAT,
        openid,
      );

      user = await this.usersService.createOAuthUser({
        username,
        nickname: userInfo.nickname,
        avatarUrl: userInfo.headimgurl,
      });

      // Create social account link
      await this.usersService.createSocialAccount(
        user.id,
        SocialProvider.WECHAT,
        openid,
        {
          unionid,
          nickname: userInfo.nickname,
          headimgurl: userInfo.headimgurl,
        },
      );

      this.logger.log(`Created new user for WeChat openid: ${openid}`);
    }

    // 4. Update last login
    await this.usersService.updateLastLogin(user.id, ip);

    // 5. Generate JWT tokens
    return this.authService.generateTokens(user);
  }

  /**
   * Exchange authorization code for access token
   */
  private async getAccessToken(code: string): Promise<WeChatAccessTokenResponse> {
    const config = this.configService.get<WeChatConfig>('wechat');
    if (!config?.appId || !config?.appSecret) {
      throw new UnauthorizedException('WeChat OAuth configuration is missing');
    }

    const params = new URLSearchParams({
      appid: config.appId,
      secret: config.appSecret,
      code,
      grant_type: 'authorization_code',
    });

    const url = `${this.WECHAT_ACCESS_TOKEN_URL}?${params.toString()}`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<WeChatAccessTokenResponse | WeChatErrorResponse>(url),
      );

      const data = response.data;

      // Check for error response
      if ('errcode' in data && data.errcode !== 0) {
        this.logger.error(`WeChat API error: ${data.errcode} - ${data.errmsg}`);
        throw new UnauthorizedException(`WeChat OAuth failed: ${data.errmsg}`);
      }

      this.logger.log(`Successfully obtained access token for openid: ${(data as WeChatAccessTokenResponse).openid}`);
      return data as WeChatAccessTokenResponse;
    } catch (error) {
      this.logger.error('Failed to get WeChat access token', error);
      throw new UnauthorizedException('Failed to authenticate with WeChat');
    }
  }

  /**
   * Get user info from WeChat using access token
   */
  private async getUserInfo(
    accessToken: string,
    openid: string,
  ): Promise<WeChatUserInfo> {
    const params = new URLSearchParams({
      access_token: accessToken,
      openid,
    });

    const url = `${this.WECHAT_USERINFO_URL}?${params.toString()}`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<WeChatUserInfo | WeChatErrorResponse>(url),
      );

      const data = response.data;

      // Check for error response
      if ('errcode' in data && data.errcode !== 0) {
        this.logger.error(`WeChat userinfo API error: ${data.errcode} - ${data.errmsg}`);
        throw new UnauthorizedException(`Failed to get WeChat user info: ${data.errmsg}`);
      }

      this.logger.log(`Successfully retrieved user info for openid: ${(data as WeChatUserInfo).openid}`);
      return data as WeChatUserInfo;
    } catch (error) {
      this.logger.error('Failed to get WeChat user info', error);
      throw new UnauthorizedException('Failed to get user info from WeChat');
    }
  }
}
