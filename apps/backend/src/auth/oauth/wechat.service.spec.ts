import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { UnauthorizedException } from '@nestjs/common';
import { of } from 'rxjs';
import { AxiosResponse } from 'axios';
import { WechatOAuthService } from './wechat.service';
import { AuthService } from '../auth.service';
import { UsersService } from '../../users/users.service';
import { SocialProvider } from '../../entities/social-account.entity';
import { User, UserStatus } from '../../entities/user.entity';
import { WeChatConfig } from '../../config/wechat.config';

describe('WechatOAuthService', () => {
  let service: WechatOAuthService;

  const mockWechatConfig: WeChatConfig = {
    appId: 'test_app_id',
    appSecret: 'test_app_secret',
    redirectUri: 'http://localhost:3001/api/auth/oauth/wechat/callback',
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue(mockWechatConfig),
  };

  const mockHttpService = {
    get: jest.fn(),
  };

  const mockUser = {
    id: 'uuid-123',
    username: 'wechat_abc12345',
    passwordHash: null,
    nickname: 'Test User',
    avatarUrl: 'http://example.com/avatar.jpg',
    status: UserStatus.ACTIVE,
  } as User;

  const mockSocialAccount = {
    id: 'social-uuid',
    userId: 'uuid-123',
    provider: SocialProvider.WECHAT,
    providerUserId: 'openid123',
    user: mockUser,
  };

  const mockUsersService = {
    findSocialAccount: jest.fn(),
    createOAuthUser: jest.fn(),
    createSocialAccount: jest.fn(),
    generateOAuthUsername: jest.fn(),
    updateLastLogin: jest.fn(),
  };

  const mockAuthService = {
    generateTokens: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WechatOAuthService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    service = module.get<WechatOAuthService>(WechatOAuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAuthorizationUrl', () => {
    it('should generate WeChat OAuth authorization URL', async () => {
      const result = await service.getAuthorizationUrl('test_state');

      expect(result.url).toContain('https://open.weixin.qq.com/connect/qrconnect');
      expect(result.url).toContain('appid=test_app_id');
      expect(result.url).toContain('state=test_state');
      expect(result.url).toContain('scope=snsapi_login');
      expect(result.url).toContain('#wechat_redirect');
    });

    it('should generate random state if not provided', async () => {
      const result = await service.getAuthorizationUrl();

      expect(result.url).toContain('state=');
      expect(result.url).toContain('#wechat_redirect');
    });

    it('should throw error if config is missing', async () => {
      mockConfigService.get.mockReturnValueOnce(null);

      await expect(service.getAuthorizationUrl()).rejects.toThrow(
        'WeChat OAuth configuration is missing',
      );
    });
  });

  describe('handleCallback', () => {
    const mockTokenResponse = {
      access_token: 'access_token_123',
      expires_in: 7200,
      refresh_token: 'refresh_token_456',
      openid: 'openid123',
      scope: 'snsapi_login',
      unionid: 'unionid789',
    };

    const mockUserInfo = {
      openid: 'openid123',
      nickname: 'Test User',
      sex: 1,
      province: 'Beijing',
      city: 'Beijing',
      country: 'CN',
      headimgurl: 'http://example.com/avatar.jpg',
      privilege: [],
    };

    const mockTokens = {
      access_token: 'jwt_access_token',
      refresh_token: 'jwt_refresh_token',
      expires_in: 900,
    };

    it('should handle callback for existing user', async () => {
      // Mock getAccessToken
      const mockAxiosResponse: Partial<AxiosResponse> = {
        data: mockTokenResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValueOnce(of(mockAxiosResponse as AxiosResponse));

      // Mock getUserInfo
      const mockUserInfoResponse: Partial<AxiosResponse> = {
        data: mockUserInfo,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValueOnce(of(mockUserInfoResponse as AxiosResponse));

      // Mock findSocialAccount - existing user
      mockUsersService.findSocialAccount.mockResolvedValue(mockSocialAccount);
      mockUsersService.updateLastLogin.mockResolvedValue(undefined);
      mockAuthService.generateTokens.mockResolvedValue(mockTokens);

      const result = await service.handleCallback('auth_code');

      expect(result).toEqual(mockTokens);
      expect(mockUsersService.findSocialAccount).toHaveBeenCalledWith(
        SocialProvider.WECHAT,
        'openid123',
      );
      expect(mockUsersService.updateLastLogin).toHaveBeenCalled();
      expect(mockAuthService.generateTokens).toHaveBeenCalledWith(mockUser);
    });

    it('should create new user for new social account', async () => {
      // Mock getAccessToken
      const mockAxiosResponse: Partial<AxiosResponse> = {
        data: mockTokenResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValueOnce(of(mockAxiosResponse as AxiosResponse));

      // Mock getUserInfo
      const mockUserInfoResponse: Partial<AxiosResponse> = {
        data: mockUserInfo,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValueOnce(of(mockUserInfoResponse as AxiosResponse));

      // Mock findSocialAccount - no existing user
      mockUsersService.findSocialAccount.mockResolvedValue(null);
      mockUsersService.generateOAuthUsername.mockReturnValue('wechat_openid12');
      mockUsersService.createOAuthUser.mockResolvedValue(mockUser);
      mockUsersService.createSocialAccount.mockResolvedValue(mockSocialAccount);
      mockUsersService.updateLastLogin.mockResolvedValue(undefined);
      mockAuthService.generateTokens.mockResolvedValue(mockTokens);

      const result = await service.handleCallback('auth_code');

      expect(result).toEqual(mockTokens);
      expect(mockUsersService.createOAuthUser).toHaveBeenCalledWith({
        username: 'wechat_openid12',
        nickname: mockUserInfo.nickname,
        avatarUrl: mockUserInfo.headimgurl,
      });
      expect(mockUsersService.createSocialAccount).toHaveBeenCalledWith(
        mockUser.id,
        SocialProvider.WECHAT,
        'openid123',
        expect.objectContaining({
          unionid: 'unionid789',
          nickname: mockUserInfo.nickname,
        }),
      );
    });

    it('should throw UnauthorizedException if access token request fails', async () => {
      const errorResponse: Partial<AxiosResponse> = {
        data: {
          errcode: 40029,
          errmsg: 'invalid code',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValueOnce(of(errorResponse as AxiosResponse));

      await expect(service.handleCallback('invalid_code')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if userinfo request fails', async () => {
      // Mock successful getAccessToken
      const mockTokenAxiosResponse: Partial<AxiosResponse> = {
        data: mockTokenResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValueOnce(
        of(mockTokenAxiosResponse as AxiosResponse),
      );

      // Mock failed getUserInfo
      const errorResponse: Partial<AxiosResponse> = {
        data: {
          errcode: 40001,
          errmsg: 'invalid access token',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValueOnce(of(errorResponse as AxiosResponse));

      await expect(service.handleCallback('auth_code')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('private methods (indirectly tested)', () => {
    describe('getAccessToken', () => {
      it('should return access token response on success', async () => {
        const mockResponse = {
          access_token: 'token123',
          expires_in: 7200,
          refresh_token: 'refresh123',
          openid: 'openid123',
          scope: 'snsapi_login',
        };

        const mockAxiosResponse: Partial<AxiosResponse> = {
          data: mockResponse,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };
        mockHttpService.get.mockReturnValueOnce(of(mockAxiosResponse as AxiosResponse));

        // Test via handleCallback
        mockUsersService.findSocialAccount.mockResolvedValue(null);
        mockUsersService.generateOAuthUsername.mockReturnValue('test_user');
        mockUsersService.createOAuthUser.mockResolvedValue(mockUser);
        mockUsersService.createSocialAccount.mockResolvedValue(mockSocialAccount);
        mockUsersService.updateLastLogin.mockResolvedValue(undefined);
        mockAuthService.generateTokens.mockResolvedValue({
          access_token: 'jwt',
          refresh_token: 'jwt_refresh',
          expires_in: 900,
        });

        // Mock getUserInfo
        const mockUserInfoResponse: Partial<AxiosResponse> = {
          data: {
            openid: 'openid123',
            nickname: 'Test',
            sex: 1,
            province: '',
            city: '',
            country: '',
            headimgurl: '',
            privilege: [],
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };
        mockHttpService.get.mockReturnValueOnce(
          of(mockUserInfoResponse as AxiosResponse),
        );

        await service.handleCallback('code');

        expect(mockHttpService.get).toHaveBeenCalledWith(
          expect.stringContaining('https://api.weixin.qq.com/sns/oauth2/access_token'),
        );
      });
    });
  });
});
