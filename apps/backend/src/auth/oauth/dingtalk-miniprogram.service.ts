import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AuthService, TokenResponse } from '../auth.service';
import { UsersService } from '../../users/users.service';
import { SocialProvider } from '../../entities/social-account.entity';

/**
 * Response from DingTalk miniprogram getAccessToken API
 */
interface DingTalkAccessTokenResponse {
  accessToken: string;
  expireIn: number;
  errcode?: number;
  errmsg?: string;
}

/**
 * Response from DingTalk miniprogram getUserInfo API
 */
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

/**
 * DTO for DingTalk miniprogram login
 */
export interface DingtalkMiniprogramLoginDto {
  authCode: string;
}

/**
 * DingTalk miniprogram configuration
 */
interface DingtalkMiniprogramConfig {
  appKey: string;
  appSecret: string;
}

@Injectable()
export class DingtalkMiniprogramService {
  private readonly logger = new Logger(DingtalkMiniprogramService.name);
  private readonly GET_ACCESS_TOKEN_URL = 'https://api.dingtalk.com/v1.0/oauth2/accessToken';
  private readonly GET_USER_INFO_URL = 'https://api.dingtalk.com/v1.0/contact/users/me';
  
  // Cache the access token
  private cachedAccessToken: string | null = null;
  private accessTokenExpiresAt: number = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Login with DingTalk miniprogram authCode
   * 1. Get app access token
   * 2. Exchange authCode for user info
   * 3. Find or create user by unionId
   * 4. Generate JWT tokens
   */
  async login(dto: DingtalkMiniprogramLoginDto, ip?: string): Promise<TokenResponse> {
    this.logger.log('Processing DingTalk miniprogram login');

    // 1. Get app access token
    const accessToken = await this.getAppAccessToken();

    // 2. Get user info using authCode
    const userInfo = await this.getUserInfo(accessToken, dto.authCode);
    const { openId, unionId, nickName, avatarUrl, mobile, email } = userInfo;

    // 3. Find existing social account or create new user
    // Use unionId first for cross-app identification, fallback to openId
    const providerUserId = unionId || openId;
    const socialAccount = await this.usersService.findSocialAccount(
      SocialProvider.DINGTALK_MINIPROGRAM,
      providerUserId,
    );

    let user;
    if (socialAccount) {
      // User exists, get the associated user
      user = socialAccount.user;
      this.logger.log(`Found existing user for DingTalk miniprogram userId: ${providerUserId}`);
    } else {
      // Create new user with DingTalk info
      const username = this.usersService.generateOAuthUsername(
        SocialProvider.DINGTALK_MINIPROGRAM,
        providerUserId,
      );

      user = await this.usersService.createOAuthUser({
        username,
        nickname: nickName,
        avatarUrl: avatarUrl,
        phone: mobile,
        email: email,
      });

      // Create social account link
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
        },
      );

      this.logger.log(`Created new user for DingTalk miniprogram userId: ${providerUserId}`);
    }

    // 4. Update last login
    await this.usersService.updateLastLogin(user.id, ip);

    // 5. Generate JWT tokens
    return this.authService.generateTokens(user);
  }

  /**
   * Get app access token (with caching)
   */
  private async getAppAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.cachedAccessToken && Date.now() < this.accessTokenExpiresAt) {
      return this.cachedAccessToken;
    }

    const config = this.configService.get<DingtalkMiniprogramConfig>('dingtalkMiniprogram');
    if (!config?.appKey || !config?.appSecret) {
      throw new UnauthorizedException('DingTalk miniprogram configuration is missing');
    }

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
          },
        ),
      );

      const data = response.data;

      // Check for error response
      if (data.errcode && data.errcode !== 0) {
        this.logger.error(`DingTalk access token API error: ${data.errcode} - ${data.errmsg}`);
        throw new UnauthorizedException(`Failed to get DingTalk access token: ${data.errmsg}`);
      }

      // Cache the token (subtract 60 seconds for safety margin)
      this.cachedAccessToken = data.accessToken;
      this.accessTokenExpiresAt = Date.now() + (data.expireIn - 60) * 1000;

      this.logger.log('Successfully obtained DingTalk app access token');
      return this.cachedAccessToken;
    } catch (error) {
      this.logger.error('Failed to get DingTalk access token', error);
      throw new UnauthorizedException('Failed to authenticate with DingTalk');
    }
  }

  /**
   * Get user info using authCode
   */
  private async getUserInfo(accessToken: string, authCode: string): Promise<DingTalkUserInfoResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<DingTalkUserInfoResponse>(
          this.GET_USER_INFO_URL,
          {
            headers: {
              'x-acs-dingtalk-access-token': accessToken,
              'Content-Type': 'application/json',
            },
            params: {
              authCode,
            },
          },
        ),
      );

      const data = response.data;

      // Check for error response
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
