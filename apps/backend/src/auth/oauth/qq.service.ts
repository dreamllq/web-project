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
  QQAccessTokenResponse,
  QQUserInfo,
  QQAuthUrlResponse,
  QQErrorResponse,
  QQOpenIdResponse,
} from './dto/qq.dto';

interface QQConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
}

@Injectable()
export class QQOAuthService {
  private readonly logger = new Logger(QQOAuthService.name);
  private readonly QQ_AUTH_URL = 'https://graph.qq.com/oauth2.0/authorize';
  private readonly QQ_ACCESS_TOKEN_URL = 'https://graph.qq.com/oauth2.0/token';
  private readonly QQ_OPENID_URL = 'https://graph.qq.com/oauth2.0/me';
  private readonly QQ_USERINFO_URL = 'https://graph.qq.com/user/get_user_info';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly oauthProviderService: OAuthProviderService
  ) {}

  private async getConfig(configId?: string): Promise<QQConfig> {
    let config = null;

    if (configId) {
      config = await this.oauthProviderService.getByConfigId(configId);
    } else {
      const configs = await this.oauthProviderService.listByCode(OAuthProviderCode.QQ);
      config = configs.find((c) => c.isDefault) || configs.find((c) => c.enabled) || null;
    }

    if (config) {
      return {
        appId: config.appId,
        appSecret: config.appSecret,
        redirectUri: config.redirectUri || '',
      };
    }

    const envConfig = this.configService.get<QQConfig>('qq');
    if (!envConfig?.appId || !envConfig?.appSecret || !envConfig?.redirectUri) {
      throw new UnauthorizedException('QQ OAuth configuration is missing');
    }
    return envConfig;
  }

  async getAuthorizationUrl(state?: string, configId?: string): Promise<QQAuthUrlResponse> {
    const config = await this.getConfig(configId);
    if (!config?.appId || !config?.redirectUri) {
      throw new Error('QQ OAuth configuration is missing');
    }

    const params = new URLSearchParams({
      client_id: config.appId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      state: state || Math.random().toString(36).substring(7),
    });

    const url = `${this.QQ_AUTH_URL}?${params.toString()}`;
    this.logger.log(`Generated QQ OAuth URL with state: ${state || 'random'}`);

    return { url };
  }

  async handleCallback(code: string, ip?: string, configId?: string): Promise<TokenResponse> {
    this.logger.log('Processing QQ OAuth callback');

    const tokenResponse = await this.getAccessToken(code, configId);
    const { access_token } = tokenResponse;

    const openIdResponse = await this.getOpenId(access_token);
    const { openid, unionid } = openIdResponse;

    const config = await this.getConfig(configId);
    const userInfo = await this.getUserInfo(access_token, openid, config.appId);

    const socialAccount = await this.usersService.findSocialAccount(SocialProvider.QQ, openid);

    let user;
    if (socialAccount) {
      user = socialAccount.user;
      this.logger.log(`Found existing user for QQ openid: ${openid}`);
    } else {
      const username = this.usersService.generateOAuthUsername(SocialProvider.QQ, openid);

      user = await this.usersService.createOAuthUser({
        username,
        nickname: userInfo.nickname,
        avatarUrl: userInfo.figureurl_qq_1,
        authType: UserAuthType.OAUTH,
        authSource: 'qq',
      });

      await this.usersService.createSocialAccount(user.id, SocialProvider.QQ, openid, {
        unionid,
        nickname: userInfo.nickname,
        figureurl_qq_1: userInfo.figureurl_qq_1,
        gender: userInfo.gender,
      });

      this.logger.log(`Created new user for QQ openid: ${openid}`);
    }

    await this.usersService.updateLastLogin(user.id, ip);

    return this.authService.generateTokens(user);
  }

  private async getAccessToken(code: string, configId?: string): Promise<QQAccessTokenResponse> {
    const config = await this.getConfig(configId);
    if (!config?.appId || !config?.appSecret) {
      throw new UnauthorizedException('QQ OAuth configuration is missing');
    }

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.appId,
      client_secret: config.appSecret,
      code,
      redirect_uri: config.redirectUri,
      fmt: 'json',
    });

    const url = `${this.QQ_ACCESS_TOKEN_URL}?${params.toString()}`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<QQAccessTokenResponse | QQErrorResponse>(url)
      );

      const data = response.data;

      if ('error' in data) {
        this.logger.error(`QQ API error: ${data.error} - ${data.error_description}`);
        throw new UnauthorizedException(`QQ OAuth failed: ${data.error_description}`);
      }

      this.logger.log('Successfully obtained access token for QQ');
      return data as QQAccessTokenResponse;
    } catch (error) {
      this.logger.error('Failed to get QQ access token', error);
      throw new UnauthorizedException('Failed to authenticate with QQ');
    }
  }

  private async getOpenId(accessToken: string): Promise<QQOpenIdResponse> {
    const params = new URLSearchParams({
      access_token: accessToken,
      unionid: '1',
    });

    const url = `${this.QQ_OPENID_URL}?${params.toString()}`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<QQOpenIdResponse | QQErrorResponse>(url)
      );

      const data = response.data;

      if ('error' in data) {
        this.logger.error(`QQ OpenID API error: ${data.error} - ${data.error_description}`);
        throw new UnauthorizedException(`Failed to get QQ openid: ${data.error_description}`);
      }

      this.logger.log(`Successfully retrieved openid: ${(data as QQOpenIdResponse).openid}`);
      return data as QQOpenIdResponse;
    } catch (error) {
      this.logger.error('Failed to get QQ openid', error);
      throw new UnauthorizedException('Failed to get openid from QQ');
    }
  }

  private async getUserInfo(
    accessToken: string,
    openid: string,
    appId: string
  ): Promise<QQUserInfo> {
    const params = new URLSearchParams({
      access_token: accessToken,
      oauth_consumer_key: appId,
      openid,
    });

    const url = `${this.QQ_USERINFO_URL}?${params.toString()}`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<QQUserInfo | QQErrorResponse>(url)
      );

      const data = response.data;

      if ('error' in data) {
        this.logger.error(`QQ userinfo API error: ${data.error} - ${data.error_description}`);
        throw new UnauthorizedException(`Failed to get QQ user info: ${data.error_description}`);
      }

      this.logger.log(
        `Successfully retrieved user info for openid: ${(data as QQUserInfo).openid}`
      );
      return data as QQUserInfo;
    } catch (error) {
      this.logger.error('Failed to get QQ user info', error);
      throw new UnauthorizedException('Failed to get user info from QQ');
    }
  }
}
