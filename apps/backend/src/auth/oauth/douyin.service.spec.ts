import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { UnauthorizedException } from '@nestjs/common';
import { of } from 'rxjs';
import { AxiosResponse } from 'axios';
import { DouyinOAuthService } from './douyin.service';
import { AuthService } from '../auth.service';
import { UsersService } from '../../users/users.service';
import { SocialProvider } from '../../entities/social-account.entity';
import { User, UserStatus } from '../../entities/user.entity';
import { DouyinConfig } from '../../config/douyin.config';

describe('DouyinOAuthService', () => {
  let service: DouyinOAuthService;

  const mockDouyinConfig: DouyinConfig = {
    appId: 'test_app_id',
    appSecret: 'test_app_secret',
    redirectUri: 'https://localhost:3001/api/auth/oauth/douyin/callback',
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue(mockDouyinConfig),
  };

  const mockHttpService = {
    get: jest.fn(),
    post: jest.fn(),
  };

  const mockUser = {
    id: 'uuid-123',
    username: 'douyin_abc12345',
    passwordHash: null,
    nickname: 'Test User',
    avatarUrl: 'http://example.com/avatar.jpg',
    status: UserStatus.ACTIVE,
  } as User;

  const mockSocialAccount = {
    id: 'social-uuid',
    userId: 'uuid-123',
    provider: SocialProvider.DOUYIN,
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
        DouyinOAuthService,
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

    service = module.get<DouyinOAuthService>(DouyinOAuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAuthorizationUrl', () => {
    it('should generate Douyin OAuth authorization URL', async () => {
      const result = await service.getAuthorizationUrl('test_state');

      expect(result.url).toContain('https://open.douyin.com/platform/oauth/connect');
      expect(result.url).toContain('client_key=test_app_id');
      expect(result.url).toContain('state=test_state');
      expect(result.url).toContain('scope=user_info');
      expect(result.url).toContain('response_type=code');
    });

    it('should generate random state if not provided', async () => {
      const result = await service.getAuthorizationUrl();

      expect(result.url).toContain('state=');
    });

    it('should throw error if config is missing', async () => {
      mockConfigService.get.mockReturnValueOnce(null);

      await expect(service.getAuthorizationUrl()).rejects.toThrow(
        'Douyin OAuth configuration is missing'
      );
    });

    it('should throw error if redirect_uri is not HTTPS', async () => {
      const httpConfig = {
        ...mockDouyinConfig,
        redirectUri: 'http://localhost:3001/callback',
      };
      mockConfigService.get.mockReturnValueOnce(httpConfig);

      await expect(service.getAuthorizationUrl()).rejects.toThrow(
        'Douyin redirect_uri must use HTTPS'
      );
    });
  });

  describe('handleCallback', () => {
    const mockTokenResponse = {
      access_token: 'access_token_123',
      expires_in: 7200,
      refresh_token: 'refresh_token_456',
      open_id: 'openid123',
      scope: 'user_info',
    };

    const mockUserInfo = {
      open_id: 'openid123',
      union_id: 'unionid789',
      nickname: 'Test User',
      avatar: 'http://example.com/avatar.jpg',
      city: 'Beijing',
      province: 'Beijing',
      country: 'CN',
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
      mockHttpService.post.mockReturnValueOnce(of(mockAxiosResponse as AxiosResponse));

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
        SocialProvider.DOUYIN,
        'openid123'
      );
      expect(mockUsersService.updateLastLogin).toHaveBeenCalled();
      expect(mockAuthService.generateTokens).toHaveBeenCalledWith(mockUser);
    });

    it('should create new user for new social account', async () => {
      const mockAxiosResponse: Partial<AxiosResponse> = {
        data: mockTokenResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.post.mockReturnValueOnce(of(mockAxiosResponse as AxiosResponse));

      const mockUserInfoResponse: Partial<AxiosResponse> = {
        data: mockUserInfo,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValueOnce(of(mockUserInfoResponse as AxiosResponse));

      mockUsersService.findSocialAccount.mockResolvedValue(null);
      mockUsersService.generateOAuthUsername.mockReturnValue('douyin_openid12');
      mockUsersService.createOAuthUser.mockResolvedValue(mockUser);
      mockUsersService.createSocialAccount.mockResolvedValue(mockSocialAccount);
      mockUsersService.updateLastLogin.mockResolvedValue(undefined);
      mockAuthService.generateTokens.mockResolvedValue(mockTokens);

      const result = await service.handleCallback('auth_code');

      expect(result).toEqual(mockTokens);
      expect(mockUsersService.createOAuthUser).toHaveBeenCalledWith({
        username: 'douyin_openid12',
        nickname: mockUserInfo.nickname,
        avatarUrl: mockUserInfo.avatar,
      });
      expect(mockUsersService.createSocialAccount).toHaveBeenCalledWith(
        mockUser.id,
        SocialProvider.DOUYIN,
        'openid123',
        expect.objectContaining({
          union_id: 'unionid789',
          nickname: mockUserInfo.nickname,
          avatar: mockUserInfo.avatar,
        })
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
      mockHttpService.post.mockReturnValueOnce(of(errorResponse as AxiosResponse));

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
      mockHttpService.post.mockReturnValueOnce(of(mockTokenAxiosResponse as AxiosResponse));

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
      it('should call POST with correct parameters', async () => {
        const mockResponse = {
          access_token: 'token123',
          expires_in: 7200,
          refresh_token: 'refresh123',
          open_id: 'openid123',
          scope: 'user_info',
        };

        const mockAxiosResponse: Partial<AxiosResponse> = {
          data: mockResponse,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };
        mockHttpService.post.mockReturnValueOnce(of(mockAxiosResponse as AxiosResponse));

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
            open_id: 'openid123',
            union_id: 'union123',
            nickname: 'Test',
            avatar: 'http://example.com/avatar.jpg',
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };
        mockHttpService.get.mockReturnValueOnce(of(mockUserInfoResponse as AxiosResponse));

        await service.handleCallback('code');

        expect(mockHttpService.post).toHaveBeenCalledWith(
          'https://open.douyin.com/oauth/access_token/',
          expect.objectContaining({
            client_key: 'test_app_id',
            client_secret: 'test_app_secret',
            code: 'code',
            grant_type: 'authorization_code',
          }),
          expect.objectContaining({
            headers: {
              'Content-Type': 'application/json',
            },
          })
        );
      });
    });
  });
});
