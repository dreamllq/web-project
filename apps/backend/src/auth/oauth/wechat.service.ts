import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AuthService, TokenResponse } from '../auth.service';
import { UsersService } from '../../users/users.service';
import { SocialProvider } from '../../entities/social-account.entity';
import { UserAuthType } from '../../entities/user.entity';
import { OAuthProviderCode } from '../../entities/oauth-provider-config.entity';
import { OAuthProviderService } from '../../oauth/oauth-provider.service';
import { WeChatConfig } from '../../config/wechat.config';
import {
  WeChatAccessTokenResponse,
  WeChatUserInfo,
  WeChatAuthUrlResponse,
  WeChatErrorResponse,
} from './wechat.dto';

interface WechatOAuthConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
}

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
    private readonly oauthProviderService: OAuthProviderService
  ) {}

  /**
   * Get OAuth config with fallback to environment variables
   * Priority: 1. Database config (by configId or default) 2. Environment variables
   */
  private async getConfig(configId?: string): Promise<WechatOAuthConfig> {
    // Try database config first
    let config = null;

    if (configId) {
      // Get specific config by ID
      config = await this.oauthProviderService.getByConfigId(configId);
      if (!config) {
        this.logger.warn(`Config with ID ${configId} not found, falling back to default`);
      }
    }

    if (!config) {
      // Get default config for wechat (isDefault=true or first enabled)
      const configs = await this.oauthProviderService.listByCode(OAuthProviderCode.WECHAT);
      config = configs.find((c) => c.isDefault && c.enabled) || configs.find((c) => c.enabled);
    }

    if (config) {
      this.logger.log(`Using database config: ${config.configName} (${config.id})`);
      return {
        appId: config.appId,
        appSecret: config.appSecret,
        redirectUri: config.redirectUri || '',
      };
    }

    // Fallback to environment variables
    const envConfig = this.configService.get<WeChatConfig>('wechat');
    if (!envConfig?.appId) {
      throw new Error('WeChat OAuth configuration not found in database or environment');
    }

    this.logger.log('Using environment variable config for WeChat OAuth');
    return {
      appId: envConfig.appId,
      appSecret: envConfig.appSecret,
      redirectUri: envConfig.redirectUri,
    };
  }

  /**
   * Generate WeChat OAuth authorization URL
   * @param state - Optional state parameter for CSRF protection
   * @param configId - Optional config ID to use specific provider configuration
   */
  async getAuthorizationUrl(state?: string, configId?: string): Promise<WeChatAuthUrlResponse> {
    const config = await this.getConfig(configId);
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
   * @param code - Authorization code from WeChat
   * @param ip - Optional client IP for login tracking
   * @param configId - Optional config ID to use specific provider configuration
   */
  async handleCallback(code: string, ip?: string, configId?: string): Promise<TokenResponse> {
    this.logger.log('Processing WeChat OAuth callback');

    // 1. Exchange code for access token
    const config = await this.getConfig(configId);
    const tokenResponse = await this.getAccessToken(code, config);
    const { access_token, openid, unionid } = tokenResponse;

    // 2. Get user info from WeChat
    const userInfo = await this.getUserInfo(access_token, openid);

    // 3. Find existing social account or create new user
    const socialAccount = await this.usersService.findSocialAccount(SocialProvider.WECHAT, openid);

    let user;
    if (socialAccount) {
      // User exists, get the associated user
      user = socialAccount.user;
      this.logger.log(`Found existing user for WeChat openid: ${openid}`);
    } else {
      // Create new user with WeChat info
      const username = this.usersService.generateOAuthUsername(SocialProvider.WECHAT, openid);

      user = await this.usersService.createOAuthUser({
        username,
        nickname: userInfo.nickname,
        avatarUrl: userInfo.headimgurl,
        authType: UserAuthType.OAUTH,
        authSource: 'wechat',
      });

      // Create social account link
      await this.usersService.createSocialAccount(user.id, SocialProvider.WECHAT, openid, {
        unionid,
        nickname: userInfo.nickname,
        headimgurl: userInfo.headimgurl,
      });

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
  private async getAccessToken(
    code: string,
    config: WechatOAuthConfig
  ): Promise<WeChatAccessTokenResponse> {
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
        this.httpService.get<WeChatAccessTokenResponse | WeChatErrorResponse>(url)
      );

      const data = response.data;

      // Check for error response
      if ('errcode' in data && data.errcode !== 0) {
        this.logger.error(`WeChat API error: ${data.errcode} - ${data.errmsg}`);
        throw new UnauthorizedException(`WeChat OAuth failed: ${data.errmsg}`);
      }

      this.logger.log(
        `Successfully obtained access token for openid: ${(data as WeChatAccessTokenResponse).openid}`
      );
      return data as WeChatAccessTokenResponse;
    } catch (error) {
      this.logger.error('Failed to get WeChat access token', error);
      throw new UnauthorizedException('Failed to authenticate with WeChat');
    }
  }

  /**
   * Get user info from WeChat using access token
   */
  private async getUserInfo(accessToken: string, openid: string): Promise<WeChatUserInfo> {
    const params = new URLSearchParams({
      access_token: accessToken,
      openid,
    });

    const url = `${this.WECHAT_USERINFO_URL}?${params.toString()}`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<WeChatUserInfo | WeChatErrorResponse>(url)
      );

      const data = response.data;

      // Check for error response
      if ('errcode' in data && data.errcode !== 0) {
        this.logger.error(`WeChat userinfo API error: ${data.errcode} - ${data.errmsg}`);
        throw new UnauthorizedException(`Failed to get WeChat user info: ${data.errmsg}`);
      }

      this.logger.log(
        `Successfully retrieved user info for openid: ${(data as WeChatUserInfo).openid}`
      );
      return data as WeChatUserInfo;
    } catch (error) {
      this.logger.error('Failed to get WeChat user info', error);
      throw new UnauthorizedException('Failed to get user info from WeChat');
    }
  }
}
