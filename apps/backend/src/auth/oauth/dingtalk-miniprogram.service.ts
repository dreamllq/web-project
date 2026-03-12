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

interface DingTalkAccessTokenResponse {
  accessToken: string;
  expireIn: number;
  errcode?: number;
  errmsg?: string;
}

interface DingTalkUserInfoResponse {
  openId: string;
  unionId: string;
  nickName?: string;
  avatarUrl?: string;
  mobile?: string;
  email?: string;
  errcode?: number;
  errmsg?: string;
}

export interface DingtalkMiniprogramLoginDto {
  authCode: string;
}

interface DingtalkMiniprogramConfig {
  appKey: string;
  appSecret: string;
}

@Injectable()
export class DingtalkMiniprogramService {
  private readonly logger = new Logger(DingtalkMiniprogramService.name);
  private readonly GET_ACCESS_TOKEN_URL = 'https://api.dingtalk.com/v1.0/oauth2/accessToken';
  private readonly GET_USER_INFO_URL = 'https://api.dingtalk.com/v1.0/contact/users/me';

  private cachedAccessToken: string | null = null;
  private accessTokenExpiresAt: number = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly oauthProviderService: OAuthProviderService
  ) {}

  private async getConfig(configId?: string): Promise<DingtalkMiniprogramConfig> {
    let config = null;

    if (configId) {
      config = await this.oauthProviderService.getByConfigId(configId);
    } else {
      const configs = await this.oauthProviderService.listByCode(
        OAuthProviderCode.DINGTALK_MINIPROGRAM
      );
      config = configs.find((c) => c.isDefault) || configs.find((c) => c.enabled) || null;
    }

    if (config) {
      const extraConfig = config.config as Record<string, unknown> | null;
      return {
        appKey: (extraConfig?.appKey as string) || config.appId,
        appSecret: config.appSecret,
      };
    }

    const envConfig = this.configService.get<DingtalkMiniprogramConfig>('dingtalkMiniprogram');
    if (!envConfig?.appKey || !envConfig?.appSecret) {
      throw new UnauthorizedException('DingTalk miniprogram configuration is missing');
    }
    return envConfig;
  }

  async login(
    dto: DingtalkMiniprogramLoginDto,
    ip?: string,
    configId?: string
  ): Promise<TokenResponse> {
    this.logger.log('Processing DingTalk miniprogram login');

    const accessToken = await this.getAppAccessToken(configId);

    const userInfo = await this.getUserInfo(accessToken, dto.authCode);
    const { openId, unionId, nickName, avatarUrl, mobile, email } = userInfo;

    const providerUserId = unionId || openId;
    const socialAccount = await this.usersService.findSocialAccount(
      SocialProvider.DINGTALK_MINIPROGRAM,
      providerUserId
    );

    let user;
    if (socialAccount) {
      user = socialAccount.user;
      this.logger.log(`Found existing user for DingTalk miniprogram userId: ${providerUserId}`);
    } else {
      const username = this.usersService.generateOAuthUsername(
        SocialProvider.DINGTALK_MINIPROGRAM,
        providerUserId
      );

      user = await this.usersService.createOAuthUser({
        username,
        nickname: nickName,
        avatarUrl: avatarUrl,
        phone: mobile,
        email: email,
        authType: UserAuthType.OAUTH,
        authSource: 'dingtalk_miniprogram',
      });

      await this.usersService.createSocialAccount(
        user.id,
        SocialProvider.DINGTALK_MINIPROGRAM,
        providerUserId,
        {
          openId,
          unionId,
          nickName,
          avatarUrl,
          mobile,
          email,
        }
      );

      this.logger.log(`Created new user for DingTalk miniprogram userId: ${providerUserId}`);
    }

    await this.usersService.updateLastLogin(user.id, ip);

    return this.authService.generateTokens(user);
  }

  private async getAppAccessToken(configId?: string): Promise<string> {
    if (this.cachedAccessToken && Date.now() < this.accessTokenExpiresAt) {
      return this.cachedAccessToken;
    }

    const config = await this.getConfig(configId);

    try {
      const response = await firstValueFrom(
        this.httpService.post<DingTalkAccessTokenResponse>(
          this.GET_ACCESS_TOKEN_URL,
          {
            appKey: config.appKey,
            appSecret: config.appSecret,
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )
      );

      const data = response.data;

      if (data.errcode && data.errcode !== 0) {
        this.logger.error(`DingTalk access token API error: ${data.errcode} - ${data.errmsg}`);
        throw new UnauthorizedException(`Failed to get DingTalk access token: ${data.errmsg}`);
      }

      this.cachedAccessToken = data.accessToken;
      this.accessTokenExpiresAt = Date.now() + (data.expireIn - 60) * 1000;

      this.logger.log('Successfully obtained DingTalk app access token');
      return this.cachedAccessToken;
    } catch (error) {
      this.logger.error('Failed to get DingTalk access token', error);
      throw new UnauthorizedException('Failed to authenticate with DingTalk');
    }
  }

  private async getUserInfo(
    accessToken: string,
    authCode: string
  ): Promise<DingTalkUserInfoResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<DingTalkUserInfoResponse>(this.GET_USER_INFO_URL, {
          headers: {
            'x-acs-dingtalk-access-token': accessToken,
            'Content-Type': 'application/json',
          },
          params: {
            authCode,
          },
        })
      );

      const data = response.data;

      if (data.errcode && data.errcode !== 0) {
        this.logger.error(`DingTalk user info API error: ${data.errcode} - ${data.errmsg}`);
        throw new UnauthorizedException(`Failed to get DingTalk user info: ${data.errmsg}`);
      }

      this.logger.log(`Successfully obtained user info for openId: ${data.openId}`);
      return data;
    } catch (error) {
      this.logger.error('Failed to get DingTalk user info', error);
      throw new UnauthorizedException('Failed to get user info from DingTalk');
    }
  }
}
