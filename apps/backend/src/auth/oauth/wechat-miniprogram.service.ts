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

interface WeChatMiniprogramSessionResponse {
  openid: string;
  session_key: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

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
    private readonly oauthProviderService: OAuthProviderService
  ) {}

  private async getConfig(configId?: string): Promise<WechatMiniprogramConfig> {
    let config = null;

    if (configId) {
      config = await this.oauthProviderService.getByConfigId(configId);
    } else {
      const configs = await this.oauthProviderService.listByCode(
        OAuthProviderCode.WECHAT_MINIPROGRAM
      );
      config = configs.find((c) => c.isDefault) || configs.find((c) => c.enabled) || null;
    }

    if (config) {
      return {
        appId: config.appId,
        appSecret: config.appSecret,
      };
    }

    const envConfig = this.configService.get<WechatMiniprogramConfig>('wechatMiniprogram');
    if (!envConfig?.appId || !envConfig?.appSecret) {
      throw new UnauthorizedException('WeChat miniprogram configuration is missing');
    }
    return envConfig;
  }

  async login(
    dto: WechatMiniprogramLoginDto,
    ip?: string,
    configId?: string
  ): Promise<TokenResponse> {
    this.logger.log('Processing WeChat miniprogram login');

    const sessionResponse = await this.code2Session(dto.code, configId);
    const { openid, unionid } = sessionResponse;

    const socialAccount = await this.usersService.findSocialAccount(
      SocialProvider.WECHAT_MINIPROGRAM,
      openid
    );

    let user;
    if (socialAccount) {
      user = socialAccount.user;
      this.logger.log(`Found existing user for WeChat miniprogram openid: ${openid}`);
    } else {
      const username = this.usersService.generateOAuthUsername(
        SocialProvider.WECHAT_MINIPROGRAM,
        openid
      );

      user = await this.usersService.createOAuthUser({
        username,
        nickname: dto.userInfo?.nickName,
        avatarUrl: dto.userInfo?.avatarUrl,
        authType: UserAuthType.OAUTH,
        authSource: 'wechat_miniprogram',
      });

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
        }
      );

      this.logger.log(`Created new user for WeChat miniprogram openid: ${openid}`);
    }

    await this.usersService.updateLastLogin(user.id, ip);

    return this.authService.generateTokens(user);
  }

  private async code2Session(
    code: string,
    configId?: string
  ): Promise<WeChatMiniprogramSessionResponse> {
    const config = await this.getConfig(configId);

    const params = new URLSearchParams({
      appid: config.appId,
      secret: config.appSecret,
      js_code: code,
      grant_type: 'authorization_code',
    });

    const url = `${this.JSCODE2SESSION_URL}?${params.toString()}`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<WeChatMiniprogramSessionResponse>(url)
      );

      const data = response.data;

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

  async getAuthorizationUrl(_state?: string, _configId?: string): Promise<{ url: string }> {
    throw new UnauthorizedException(
      'WeChat miniprogram does not support web-based OAuth authorization. Use the miniprogram client to login.'
    );
  }

  async handleTestCallback(
    _code: string,
    _configId?: string
  ): Promise<{
    providerUserId: string;
    nickname: string | null;
    avatarUrl: string | null;
    rawUserInfo: Record<string, unknown>;
  }> {
    throw new UnauthorizedException(
      'WeChat miniprogram does not support web-based OAuth test login. Use the miniprogram client to test.'
    );
  }
}
