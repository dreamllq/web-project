import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AuthService, TokenResponse } from '../auth.service';
import { UsersService } from '../../users/users.service';
import { SocialProvider } from '../../entities/social-account.entity';
import { DouyinConfig } from '../../config/douyin.config';
import {
  DouyinAccessTokenResponse,
  DouyinUserInfo,
  DouyinAuthUrlResponse,
  DouyinErrorResponse,
} from './dto/douyin.dto';

@Injectable()
export class DouyinOAuthService {
  private readonly logger = new Logger(DouyinOAuthService.name);
  private readonly DOUYIN_AUTH_URL = 'https://open.douyin.com/platform/oauth/connect';
  private readonly DOUYIN_ACCESS_TOKEN_URL = 'https://open.douyin.com/oauth/access_token/';
  private readonly DOUYIN_USERINFO_URL = 'https://open.douyin.com/oauth/userinfo/';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly usersService: UsersService,
    private readonly authService: AuthService
  ) {}

  async getAuthorizationUrl(state?: string): Promise<DouyinAuthUrlResponse> {
    const config = this.configService.get<DouyinConfig>('douyin');
    if (!config?.appId || !config?.redirectUri) {
      throw new Error('Douyin OAuth configuration is missing');
    }

    // CRITICAL: Douyin requires HTTPS for redirect_uri
    if (!config.redirectUri.startsWith('https://')) {
      throw new Error('Douyin redirect_uri must use HTTPS');
    }

    const params = new URLSearchParams({
      client_key: config.appId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: 'user_info',
      state: state || Math.random().toString(36).substring(7),
    });

    const url = `${this.DOUYIN_AUTH_URL}?${params.toString()}`;
    this.logger.log(`Generated Douyin OAuth URL with state: ${state || 'random'}`);

    return { url };
  }

  async handleCallback(code: string, ip?: string): Promise<TokenResponse> {
    this.logger.log('Processing Douyin OAuth callback');

    const tokenResponse = await this.getAccessToken(code);
    const { access_token, open_id } = tokenResponse;

    const userInfo = await this.getUserInfo(access_token, open_id);

    const socialAccount = await this.usersService.findSocialAccount(SocialProvider.DOUYIN, open_id);

    let user;
    if (socialAccount) {
      user = socialAccount.user;
      this.logger.log(`Found existing user for Douyin open_id: ${open_id}`);
    } else {
      const username = this.usersService.generateOAuthUsername(SocialProvider.DOUYIN, open_id);

      user = await this.usersService.createOAuthUser({
        username,
        nickname: userInfo.nickname,
        avatarUrl: userInfo.avatar,
      });

      await this.usersService.createSocialAccount(user.id, SocialProvider.DOUYIN, open_id, {
        union_id: userInfo.union_id,
        nickname: userInfo.nickname,
        avatar: userInfo.avatar,
        city: userInfo.city,
        province: userInfo.province,
        country: userInfo.country,
      });

      this.logger.log(`Created new user for Douyin open_id: ${open_id}`);
    }

    await this.usersService.updateLastLogin(user.id, ip);

    return this.authService.generateTokens(user);
  }

  private async getAccessToken(code: string): Promise<DouyinAccessTokenResponse> {
    const config = this.configService.get<DouyinConfig>('douyin');
    if (!config?.appId || !config?.appSecret) {
      throw new UnauthorizedException('Douyin OAuth configuration is missing');
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post<DouyinAccessTokenResponse | DouyinErrorResponse>(
          this.DOUYIN_ACCESS_TOKEN_URL,
          {
            client_key: config.appId,
            client_secret: config.appSecret,
            code,
            grant_type: 'authorization_code',
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )
      );

      const data = response.data;

      if ('errcode' in data && data.errcode !== 0) {
        this.logger.error(`Douyin API error: ${data.errcode} - ${data.errmsg}`);
        throw new UnauthorizedException(`Douyin OAuth failed: ${data.errmsg}`);
      }

      this.logger.log(
        `Successfully obtained access token for open_id: ${(data as DouyinAccessTokenResponse).open_id}`
      );
      return data as DouyinAccessTokenResponse;
    } catch (error) {
      this.logger.error('Failed to get Douyin access token', error);
      throw new UnauthorizedException('Failed to authenticate with Douyin');
    }
  }

  private async getUserInfo(accessToken: string, openId: string): Promise<DouyinUserInfo> {
    const params = new URLSearchParams({
      access_token: accessToken,
      open_id: openId,
    });

    const url = `${this.DOUYIN_USERINFO_URL}?${params.toString()}`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<DouyinUserInfo | DouyinErrorResponse>(url)
      );

      const data = response.data;

      if ('errcode' in data && data.errcode !== 0) {
        this.logger.error(`Douyin userinfo API error: ${data.errcode} - ${data.errmsg}`);
        throw new UnauthorizedException(`Failed to get Douyin user info: ${data.errmsg}`);
      }

      this.logger.log(
        `Successfully retrieved user info for open_id: ${(data as DouyinUserInfo).open_id}`
      );
      return data as DouyinUserInfo;
    } catch (error) {
      this.logger.error('Failed to get Douyin user info', error);
      throw new UnauthorizedException('Failed to get user info from Douyin');
    }
  }
}
