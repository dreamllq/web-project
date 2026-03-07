import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { UnauthorizedException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AxiosResponse, AxiosError } from 'axios';
import { FeishuOAuthService } from './feishu.service';
import { AuthService } from '../auth.service';
import { UsersService } from '../../users/users.service';
import { SocialProvider } from '../../entities/social-account.entity';
import { User, UserStatus } from '../../entities/user.entity';
import { FeishuConfig } from '../../config/feishu.config';

describe('FeishuOAuthService', () => {
  let service: FeishuOAuthService;

  const mockFeishuConfig: FeishuConfig = {
    appId: 'test_app_id',
    appSecret: 'test_app_secret',
    redirectUri: 'http://localhost:3001/api/auth/oauth/feishu/callback',
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue(mockFeishuConfig),
  };

  const mockHttpService = {
    get: jest.fn(),
    post: jest.fn(),
  };

  const mockUser = {
    id: 'uuid-123',
    username: 'feishu_abc12345',
    passwordHash: null,
    nickname: 'Test User',
    avatarUrl: 'http://example.com/avatar.jpg',
    status: UserStatus.ACTIVE,
  } as User;

  const mockSocialAccount = {
    id: 'social-uuid',
    userId: 'uuid-123',
    provider: SocialProvider.FEISHU,
    providerUserId: 'open_id_123',
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
        FeishuOAuthService,
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

    service = module.get<FeishuOAuthService>(FeishuOAuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAuthorizationUrl', () => {
    it('should generate Feishu OAuth authorization URL', async () => {
      const result = await service.getAuthorizationUrl('test_state');

      expect(result.url).toContain('https://passport.feishu.cn/suite/passport/oauth/authorize');
      expect(result.url).toContain('app_id=test_app_id');
      expect(result.url).toContain('state=test_state');
      expect(result.url).toContain('response_type=code');
    });

    it('should generate random state if not provided', async () => {
      const result = await service.getAuthorizationUrl();

      expect(result.url).toContain('state=');
    });

    it('should throw error if config is missing', async () => {
      mockConfigService.get.mockReturnValueOnce(null);

      await expect(service.getAuthorizationUrl()).rejects.toThrow(
        'Feishu OAuth configuration is missing'
      );
    });
  });

  describe('handleCallback', () => {
    const mockTokenResponse = {
      access_token: 'access_token_123',
      expires_in: 7200,
      refresh_token: 'refresh_token_456',
      token_type: 'Bearer',
    };

    const mockUserInfo = {
      open_id: 'open_id_123',
      union_id: 'union_id_789',
      name: 'Test User',
      avatar_url: 'http://example.com/avatar.jpg',
      mobile: '+8613800138000',
      email: 'test@example.com',
    };

    const mockTokens = {
      access_token: 'jwt_access_token',
      refresh_token: 'jwt_refresh_token',
      expires_in: 900,
    };

    it('should handle callback for existing user', async () => {
      const mockTokenAxiosResponse: Partial<AxiosResponse> = {
        data: mockTokenResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.post.mockReturnValueOnce(of(mockTokenAxiosResponse as AxiosResponse));

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
        SocialProvider.FEISHU,
        'open_id_123'
      );
      expect(mockUsersService.updateLastLogin).toHaveBeenCalled();
      expect(mockAuthService.generateTokens).toHaveBeenCalledWith(mockUser);
    });

    it('should create new user for new social account', async () => {
      const mockTokenAxiosResponse: Partial<AxiosResponse> = {
        data: mockTokenResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.post.mockReturnValueOnce(of(mockTokenAxiosResponse as AxiosResponse));

      const mockUserInfoResponse: Partial<AxiosResponse> = {
        data: mockUserInfo,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValueOnce(of(mockUserInfoResponse as AxiosResponse));

      mockUsersService.findSocialAccount.mockResolvedValue(null);
      mockUsersService.generateOAuthUsername.mockReturnValue('feishu_open_id');
      mockUsersService.createOAuthUser.mockResolvedValue(mockUser);
      mockUsersService.createSocialAccount.mockResolvedValue(mockSocialAccount);
      mockUsersService.updateLastLogin.mockResolvedValue(undefined);
      mockAuthService.generateTokens.mockResolvedValue(mockTokens);

      const result = await service.handleCallback('auth_code');

      expect(result).toEqual(mockTokens);
      expect(mockUsersService.createOAuthUser).toHaveBeenCalledWith({
        username: 'feishu_open_id',
        nickname: mockUserInfo.name,
        avatarUrl: mockUserInfo.avatar_url,
        email: mockUserInfo.email,
        phone: mockUserInfo.mobile,
      });
      expect(mockUsersService.createSocialAccount).toHaveBeenCalledWith(
        mockUser.id,
        SocialProvider.FEISHU,
        'open_id_123',
        expect.objectContaining({
          union_id: 'union_id_789',
          name: mockUserInfo.name,
          avatar_url: mockUserInfo.avatar_url,
          mobile: mockUserInfo.mobile,
          email: mockUserInfo.email,
        })
      );
    });

    it('should throw UnauthorizedException if access token request fails with error response', async () => {
      const errorResponse: Partial<AxiosResponse> = {
        data: {
          error: 'invalid_grant',
          error_description: 'Invalid authorization code',
        },
        status: 400,
        statusText: 'Bad Request',
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
          error: 'invalid_token',
          error_description: 'Invalid access token',
        },
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValueOnce(of(errorResponse as AxiosResponse));

      await expect(service.handleCallback('auth_code')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if HTTP request throws error', async () => {
      const axiosError = new Error('Network error') as AxiosError;
      mockHttpService.post.mockReturnValueOnce(throwError(() => axiosError));

      await expect(service.handleCallback('auth_code')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('private methods (indirectly tested)', () => {
    describe('getAccessToken', () => {
      it('should call POST endpoint with correct parameters', async () => {
        const mockResponse = {
          access_token: 'token123',
          expires_in: 7200,
          refresh_token: 'refresh123',
          token_type: 'Bearer',
        };

        const mockTokenAxiosResponse: Partial<AxiosResponse> = {
          data: mockResponse,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };
        mockHttpService.post.mockReturnValueOnce(of(mockTokenAxiosResponse as AxiosResponse));

        const mockUserInfoResponse: Partial<AxiosResponse> = {
          data: {
            open_id: 'open_id_123',
            union_id: 'union_id_789',
            name: 'Test User',
            avatar_url: 'http://example.com/avatar.jpg',
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };
        mockHttpService.get.mockReturnValueOnce(of(mockUserInfoResponse as AxiosResponse));

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

        await service.handleCallback('code');

        expect(mockHttpService.post).toHaveBeenCalledWith(
          'https://passport.feishu.cn/suite/passport/oauth/token',
          {
            app_id: 'test_app_id',
            app_secret: 'test_app_secret',
            grant_type: 'authorization_code',
            code: 'code',
          },
          expect.objectContaining({
            headers: {
              'Content-Type': 'application/json',
            },
          })
        );
      });
    });

    describe('getUserInfo', () => {
      it('should call GET endpoint with access token', async () => {
        const mockTokenResponse = {
          access_token: 'access_token_123',
          expires_in: 7200,
          refresh_token: 'refresh_token_456',
          token_type: 'Bearer',
        };

        const mockTokenAxiosResponse: Partial<AxiosResponse> = {
          data: mockTokenResponse,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };
        mockHttpService.post.mockReturnValueOnce(of(mockTokenAxiosResponse as AxiosResponse));

        const mockUserInfoResponse: Partial<AxiosResponse> = {
          data: {
            open_id: 'open_id_123',
            union_id: 'union_id_789',
            name: 'Test User',
            avatar_url: 'http://example.com/avatar.jpg',
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };
        mockHttpService.get.mockReturnValueOnce(of(mockUserInfoResponse as AxiosResponse));

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

        await service.handleCallback('code');

        expect(mockHttpService.get).toHaveBeenCalledWith(
          'https://passport.feishu.cn/suite/passport/oauth/userinfo?access_token=access_token_123'
        );
      });
    });
  });
});
