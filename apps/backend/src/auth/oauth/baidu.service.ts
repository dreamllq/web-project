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
import {
  BaiduAccessTokenResponse,
  BaiduUserInfo,
  BaiduAuthUrlResponse,
  BaiduErrorResponse,
} from './dto/baidu.dto';

interface BaiduConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
}

@Injectable()
export class BaiduOAuthService {
  private readonly logger = new Logger(BaiduOAuthService.name);
  private readonly BAIDU_AUTH_URL = 'https://openapi.baidu.com/oauth/2.0/authorize';
  private readonly BAIDU_ACCESS_TOKEN_URL = 'https://openapi.baidu.com/oauth/2.0/token';
  private readonly BAIDU_USERINFO_URL = 'https://openapi.baidu.com/rest/2.0/passport/users/getInfo';
  private readonly BAIDU_AVATAR_BASE_URL = 'https://himg.bdimg.com/sys/portrait/item';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly oauthProviderService: OAuthProviderService
  ) {}

  private async getConfig(configId?: string): Promise<BaiduConfig> {
    let config = null;

    if (configId) {
      config = await this.oauthProviderService.getByConfigId(configId);
    } else {
      const configs = await this.oauthProviderService.listByCode(OAuthProviderCode.BAIDU);
      config = configs.find((c) => c.isDefault) || configs.find((c) => c.enabled) || null;
    }

    if (config) {
      return {
        appId: config.appId,
        appSecret: config.appSecret,
        redirectUri: config.redirectUri || '',
      };
    }

    const envConfig = this.configService.get<BaiduConfig>('baidu');
    if (!envConfig?.appId || !envConfig?.appSecret || !envConfig?.redirectUri) {
      throw new UnauthorizedException('Baidu OAuth configuration is missing');
    }
    return envConfig;
  }

  async getAuthorizationUrl(state?: string, configId?: string): Promise<BaiduAuthUrlResponse> {
    const config = await this.getConfig(configId);
    if (!config?.appId || !config?.redirectUri) {
      throw new Error('Baidu OAuth configuration is missing');
    }

    const params = new URLSearchParams({
      client_id: config.appId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      state: state || Math.random().toString(36).substring(7),
    });

    const url = `${this.BAIDU_AUTH_URL}?${params.toString()}`;
    this.logger.log(`Generated Baidu OAuth URL with state: ${state || 'random'}`);

    return { url };
  }

  async handleCallback(code: string, ip?: string, configId?: string): Promise<TokenResponse> {
    this.logger.log('Processing Baidu OAuth callback');

    const tokenResponse = await this.getAccessToken(code, configId);
    const { access_token } = tokenResponse;

    const userInfo = await this.getUserInfo(access_token);
    const { openid } = userInfo;

    const socialAccount = await this.usersService.findSocialAccount(SocialProvider.BAIDU, openid);

    let user;
    if (socialAccount) {
      user = socialAccount.user;
      this.logger.log(`Found existing user for Baidu openid: ${openid}`);
    } else {
      const username = this.usersService.generateOAuthUsername(SocialProvider.BAIDU, openid);

      const avatarUrl = userInfo.portrait
        ? `${this.BAIDU_AVATAR_BASE_URL}/${userInfo.portrait}`
        : undefined;

      user = await this.usersService.createOAuthUser({
        username,
        nickname: userInfo.username,
        avatarUrl,
        authType: UserAuthType.OAUTH,
        authSource: 'baidu',
      });

      await this.usersService.createSocialAccount(user.id, SocialProvider.BAIDU, openid, {
        unionid: userInfo.unionid,
        username: userInfo.username,
        portrait: userInfo.portrait,
        sex: userInfo.sex,
      });

      this.logger.log(`Created new user for Baidu openid: ${openid}`);
    }

    await this.usersService.updateLastLogin(user.id, ip);

    return this.authService.generateTokens(user);
  }

  private async getAccessToken(code: string, configId?: string): Promise<BaiduAccessTokenResponse> {
    const config = await this.getConfig(configId);
    if (!config?.appId || !config?.appSecret || !config?.redirectUri) {
      throw new UnauthorizedException('Baidu OAuth configuration is missing');
    }

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.appId,
      client_secret: config.appSecret,
      code,
      redirect_uri: config.redirectUri,
    });

    const url = `${this.BAIDU_ACCESS_TOKEN_URL}?${params.toString()}`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<BaiduAccessTokenResponse | BaiduErrorResponse>(url)
      );

      const data = response.data;

      if ('error' in data) {
        this.logger.error(`Baidu API error: ${data.error} - ${data.error_description}`);
        throw new UnauthorizedException(`Baidu OAuth failed: ${data.error_description}`);
      }

      this.logger.log('Successfully obtained Baidu access token');
      return data as BaiduAccessTokenResponse;
    } catch (error) {
      this.logger.error('Failed to get Baidu access token', error);
      throw new UnauthorizedException('Failed to authenticate with Baidu');
    }
  }

  private async getUserInfo(accessToken: string): Promise<BaiduUserInfo> {
    const params = new URLSearchParams({
      access_token: accessToken,
      get_unionid: '1',
    });

    const url = `${this.BAIDU_USERINFO_URL}?${params.toString()}`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<BaiduUserInfo | BaiduErrorResponse>(url)
      );

      const data = response.data;

      if ('error' in data) {
        this.logger.error(`Baidu userinfo API error: ${data.error} - ${data.error_description}`);
        throw new UnauthorizedException(`Failed to get Baidu user info: ${data.error_description}`);
      }

      this.logger.log(
        `Successfully retrieved user info for openid: ${(data as BaiduUserInfo).openid}`
      );
      return data as BaiduUserInfo;
    } catch (error) {
      this.logger.error('Failed to get Baidu user info', error);
      throw new UnauthorizedException('Failed to get user info from Baidu');
    }
  }

  async handleTestCallback(
    code: string,
    configId?: string
  ): Promise<{
    providerUserId: string;
    nickname: string | null;
    avatarUrl: string | null;
    rawUserInfo: Record<string, unknown>;
  }> {
    this.logger.log('Processing Baidu OAuth test callback');

    const tokenResponse = await this.getAccessToken(code, configId);
    const { access_token } = tokenResponse;

    const userInfo = await this.getUserInfo(access_token);

    const avatarUrl = userInfo.portrait
      ? `${this.BAIDU_AVATAR_BASE_URL}/${userInfo.portrait}`
      : null;

    return {
      providerUserId: userInfo.openid,
      nickname: userInfo.username,
      avatarUrl,
      rawUserInfo: {
        openid: userInfo.openid,
        unionid: userInfo.unionid,
        username: userInfo.username,
        portrait: userInfo.portrait,
        sex: userInfo.sex,
      },
    };
  }
}
