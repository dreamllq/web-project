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
import { User, UserStatus, UserAuthType } from '../../entities/user.entity';
import { OAuthProviderCode } from '../../entities/oauth-provider-config.entity';
import { OAuthProviderService } from '../../oauth/oauth-provider.service';
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
    authType: UserAuthType.OAUTH,
    authSource: 'wechat',
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

  const mockOAuthProviderService = {
    getByConfigId: jest.fn().mockResolvedValue(null),
    listByCode: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockConfigService.get.mockReturnValue(mockWechatConfig);
    mockOAuthProviderService.getByConfigId.mockResolvedValue(null);
    mockOAuthProviderService.listByCode.mockResolvedValue([]);

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
        {
          provide: OAuthProviderService,
          useValue: mockOAuthProviderService,
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

    it('should use database config when available', async () => {
      const dbConfig = {
        id: 'config-uuid',
        code: OAuthProviderCode.WECHAT,
        configName: 'Production WeChat',
        appId: 'db_app_id',
        appSecret: 'db_app_secret',
        redirectUri: 'http://db-redirect.com/callback',
        isDefault: true,
        enabled: true,
      };
      mockOAuthProviderService.listByCode.mockResolvedValueOnce([dbConfig]);

      const result = await service.getAuthorizationUrl('test_state');

      expect(result.url).toContain('appid=db_app_id');
      expect(result.url).toContain('redirect_uri=http%3A%2F%2Fdb-redirect.com%2Fcallback');
    });

    it('should use specific config when configId is provided', async () => {
      const specificConfig = {
        id: 'specific-config-uuid',
        code: OAuthProviderCode.WECHAT,
        configName: 'Test WeChat',
        appId: 'specific_app_id',
        appSecret: 'specific_app_secret',
        redirectUri: 'http://specific-redirect.com/callback',
        isDefault: false,
        enabled: true,
      };
      mockOAuthProviderService.getByConfigId.mockResolvedValueOnce(specificConfig);

      const result = await service.getAuthorizationUrl('test_state', 'specific-config-uuid');

      expect(result.url).toContain('appid=specific_app_id');
      expect(mockOAuthProviderService.getByConfigId).toHaveBeenCalledWith('specific-config-uuid');
    });

    it('should fallback to environment variables if no database config', async () => {
      mockOAuthProviderService.listByCode.mockResolvedValueOnce([]);

      const result = await service.getAuthorizationUrl('test_state');

      expect(result.url).toContain('appid=test_app_id');
    });

    it('should throw error if config is missing', async () => {
      mockOAuthProviderService.listByCode.mockResolvedValueOnce([]);
      mockConfigService.get.mockReturnValueOnce(null);

      await expect(service.getAuthorizationUrl()).rejects.toThrow(
        'WeChat OAuth configuration not found in database or environment'
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
      const mockAxiosResponse: Partial<AxiosResponse> = {
        data: mockTokenResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValueOnce(of(mockAxiosResponse as AxiosResponse));

      const mockUserInfoResponse: Partial<AxiosResponse> = {
        data: mockUserInfo,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValueOnce(of(mockUserInfoResponse as AxiosResponse));

      mockUsersService.findSocialAccount.mockResolvedValue(mockSocialAccount);
      mockUsersService.updateLastLogin.mockResolvedValue(undefined);
      mockAuthService.generateTokens.mockResolvedValue(mockTokens);

      const result = await service.handleCallback('auth_code');

      expect(result).toEqual(mockTokens);
      expect(mockUsersService.findSocialAccount).toHaveBeenCalledWith(
        SocialProvider.WECHAT,
        'openid123'
      );
      expect(mockUsersService.updateLastLogin).toHaveBeenCalled();
      expect(mockAuthService.generateTokens).toHaveBeenCalledWith(mockUser);
    });

    it('should create new user for new social account with authType and authSource', async () => {
      const mockAxiosResponse: Partial<AxiosResponse> = {
        data: mockTokenResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValueOnce(of(mockAxiosResponse as AxiosResponse));

      const mockUserInfoResponse: Partial<AxiosResponse> = {
        data: mockUserInfo,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValueOnce(of(mockUserInfoResponse as AxiosResponse));

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
        authType: UserAuthType.OAUTH,
        authSource: 'wechat',
      });
      expect(mockUsersService.createSocialAccount).toHaveBeenCalledWith(
        mockUser.id,
        SocialProvider.WECHAT,
        'openid123',
        expect.objectContaining({
          unionid: 'unionid789',
          nickname: mockUserInfo.nickname,
        })
      );
    });

    it('should use specific config when configId is provided in callback', async () => {
      const specificConfig = {
        id: 'specific-config-uuid',
        code: OAuthProviderCode.WECHAT,
        configName: 'Test WeChat',
        appId: 'specific_app_id',
        appSecret: 'specific_app_secret',
        redirectUri: 'http://specific-redirect.com/callback',
        isDefault: false,
        enabled: true,
      };
      mockOAuthProviderService.getByConfigId.mockResolvedValueOnce(specificConfig);

      const mockAxiosResponse: Partial<AxiosResponse> = {
        data: mockTokenResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValueOnce(of(mockAxiosResponse as AxiosResponse));

      const mockUserInfoResponse: Partial<AxiosResponse> = {
        data: mockUserInfo,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValueOnce(of(mockUserInfoResponse as AxiosResponse));

      mockUsersService.findSocialAccount.mockResolvedValue(mockSocialAccount);
      mockUsersService.updateLastLogin.mockResolvedValue(undefined);
      mockAuthService.generateTokens.mockResolvedValue(mockTokens);

      await service.handleCallback('auth_code', undefined, 'specific-config-uuid');

      expect(mockOAuthProviderService.getByConfigId).toHaveBeenCalledWith('specific-config-uuid');
      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.stringContaining('appid=specific_app_id')
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

      await expect(service.handleCallback('invalid_code')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if userinfo request fails', async () => {
      const mockTokenAxiosResponse: Partial<AxiosResponse> = {
        data: mockTokenResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValueOnce(of(mockTokenAxiosResponse as AxiosResponse));

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

      await expect(service.handleCallback('auth_code')).rejects.toThrow(UnauthorizedException);
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
        mockHttpService.get.mockReturnValueOnce(of(mockUserInfoResponse as AxiosResponse));

        await service.handleCallback('code');

        expect(mockHttpService.get).toHaveBeenCalledWith(
          expect.stringContaining('https://api.weixin.qq.com/sns/oauth2/access_token')
        );
      });
    });
  });
});
