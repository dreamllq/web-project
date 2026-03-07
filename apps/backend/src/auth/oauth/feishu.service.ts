import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AuthService, TokenResponse } from '../auth.service';
import { UsersService } from '../../users/users.service';
import { SocialProvider } from '../../entities/social-account.entity';
import { FeishuConfig } from '../../config/feishu.config';
import { FeishuAccessTokenResponse, FeishuUserInfo } from './dto/feishu.dto';

export interface FeishuAuthUrlResponse {
  url: string;
}

export interface FeishuErrorResponse {
  error: string;
  error_description: string;
}

@Injectable()
export class FeishuOAuthService {
  private readonly logger = new Logger(FeishuOAuthService.name);
  private readonly FEISHU_AUTH_URL = 'https://passport.feishu.cn/suite/passport/oauth/authorize';
  private readonly FEISHU_ACCESS_TOKEN_URL =
    'https://passport.feishu.cn/suite/passport/oauth/token';
  private readonly FEISHU_USERINFO_URL = 'https://passport.feishu.cn/suite/passport/oauth/userinfo';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly usersService: UsersService,
    private readonly authService: AuthService
  ) {}

  async getAuthorizationUrl(state?: string): Promise<FeishuAuthUrlResponse> {
    const config = this.configService.get<FeishuConfig>('feishu');
    if (!config?.appId || !config?.redirectUri) {
      throw new Error('Feishu OAuth configuration is missing');
    }

    const params = new URLSearchParams({
      app_id: config.appId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      state: state || Math.random().toString(36).substring(7),
    });

    const url = `${this.FEISHU_AUTH_URL}?${params.toString()}`;
    this.logger.log(`Generated Feishu OAuth URL with state: ${state || 'random'}`);

    return { url };
  }

  async handleCallback(code: string, ip?: string): Promise<TokenResponse> {
    this.logger.log('Processing Feishu OAuth callback');

    const tokenResponse = await this.getAccessToken(code);
    const { access_token } = tokenResponse;

    const userInfo = await this.getUserInfo(access_token);

    const socialAccount = await this.usersService.findSocialAccount(
      SocialProvider.FEISHU,
      userInfo.open_id
    );

    let user;
    if (socialAccount) {
      user = socialAccount.user;
      this.logger.log(`Found existing user for Feishu open_id: ${userInfo.open_id}`);
    } else {
      const username = this.usersService.generateOAuthUsername(
        SocialProvider.FEISHU,
        userInfo.open_id
      );

      user = await this.usersService.createOAuthUser({
        username,
        nickname: userInfo.name,
        avatarUrl: userInfo.avatar_url,
        email: userInfo.email,
        phone: userInfo.mobile,
      });

      await this.usersService.createSocialAccount(
        user.id,
        SocialProvider.FEISHU,
        userInfo.open_id,
        {
          union_id: userInfo.union_id,
          name: userInfo.name,
          avatar_url: userInfo.avatar_url,
          mobile: userInfo.mobile,
          email: userInfo.email,
        }
      );

      this.logger.log(`Created new user for Feishu open_id: ${userInfo.open_id}`);
    }

    await this.usersService.updateLastLogin(user.id, ip);

    return this.authService.generateTokens(user);
  }

  private async getAccessToken(code: string): Promise<FeishuAccessTokenResponse> {
    const config = this.configService.get<FeishuConfig>('feishu');
    if (!config?.appId || !config?.appSecret) {
      throw new UnauthorizedException('Feishu OAuth configuration is missing');
    }

    const body = {
      app_id: config.appId,
      app_secret: config.appSecret,
      grant_type: 'authorization_code',
      code,
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post<FeishuAccessTokenResponse | FeishuErrorResponse>(
          this.FEISHU_ACCESS_TOKEN_URL,
          body,
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )
      );

      const data = response.data;

      if ('error' in data) {
        this.logger.error(`Feishu API error: ${data.error} - ${data.error_description}`);
        throw new UnauthorizedException(`Feishu OAuth failed: ${data.error_description}`);
      }

      this.logger.log('Successfully obtained access token for open_id');
      return data as FeishuAccessTokenResponse;
    } catch (error) {
      this.logger.error('Failed to get Feishu access token', error);
      throw new UnauthorizedException('Failed to authenticate with Feishu');
    }
  }

  private async getUserInfo(accessToken: string): Promise<FeishuUserInfo> {
    const url = `${this.FEISHU_USERINFO_URL}?access_token=${accessToken}`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<FeishuUserInfo | FeishuErrorResponse>(url)
      );

      const data = response.data;

      if ('error' in data) {
        this.logger.error(`Feishu userinfo API error: ${data.error} - ${data.error_description}`);
        throw new UnauthorizedException(
          `Failed to get Feishu user info: ${data.error_description}`
        );
      }

      this.logger.log(
        `Successfully retrieved user info for open_id: ${(data as FeishuUserInfo).open_id}`
      );
      return data as FeishuUserInfo;
    } catch (error) {
      this.logger.error('Failed to get Feishu user info', error);
      throw new UnauthorizedException('Failed to get user info from Feishu');
    }
  }
}
