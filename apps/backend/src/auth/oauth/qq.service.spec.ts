import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { UnauthorizedException } from '@nestjs/common';
import { of } from 'rxjs';
import { AxiosResponse } from 'axios';
import { QQOAuthService } from './qq.service';
import { AuthService } from '../auth.service';
import { UsersService } from '../../users/users.service';
import { SocialProvider } from '../../entities/social-account.entity';
import { User, UserStatus } from '../../entities/user.entity';
import { QQConfig } from '../../config/qq.config';

describe('QQOAuthService', () => {
  let service: QQOAuthService;

  const mockQQConfig: QQConfig = {
    appId: 'test_app_id',
    appSecret: 'test_app_secret',
    redirectUri: 'http://localhost:3001/api/auth/oauth/qq/callback',
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue(mockQQConfig),
  };

  const mockHttpService = {
    get: jest.fn(),
  };

  const mockUser = {
    id: 'uuid-123',
    username: 'qq_abc12345',
    passwordHash: null,
    nickname: 'Test User',
    avatarUrl: 'http://example.com/avatar.jpg',
    status: UserStatus.ACTIVE,
  } as User;

  const mockSocialAccount = {
    id: 'social-uuid',
    userId: 'uuid-123',
    provider: SocialProvider.QQ,
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
        QQOAuthService,
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

    service = module.get<QQOAuthService>(QQOAuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAuthorizationUrl', () => {
    it('should generate QQ OAuth authorization URL', async () => {
      const result = await service.getAuthorizationUrl('test_state');

      expect(result.url).toContain('https://graph.qq.com/oauth2.0/authorize');
      expect(result.url).toContain('client_id=test_app_id');
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
        'QQ OAuth configuration is missing'
      );
    });
  });

  describe('handleCallback', () => {
    const mockTokenResponse = {
      access_token: 'access_token_123',
      expires_in: 7200,
      refresh_token: 'refresh_token_456',
    };

    const mockOpenIdResponse = {
      client_id: 'test_app_id',
      openid: 'openid123',
      unionid: 'unionid789',
    };

    const mockUserInfo = {
      openid: 'openid123',
      nickname: 'Test User',
      figureurl_qq_1: 'http://example.com/avatar.jpg',
      gender: '男',
    };

    const mockTokens = {
      access_token: 'jwt_access_token',
      refresh_token: 'jwt_refresh_token',
      expires_in: 900,
    };

    it('should handle callback for existing user', async () => {
      mockHttpService.get
        .mockReturnValueOnce(
          of({
            data: mockTokenResponse,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          } as AxiosResponse)
        )
        .mockReturnValueOnce(
          of({
            data: mockOpenIdResponse,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          } as AxiosResponse)
        )
        .mockReturnValueOnce(
          of({
            data: mockUserInfo,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          } as AxiosResponse)
        );

      mockUsersService.findSocialAccount.mockResolvedValue(mockSocialAccount);
      mockUsersService.updateLastLogin.mockResolvedValue(undefined);
      mockAuthService.generateTokens.mockResolvedValue(mockTokens);

      const result = await service.handleCallback('auth_code');

      expect(result).toEqual(mockTokens);
      expect(mockUsersService.findSocialAccount).toHaveBeenCalledWith(
        SocialProvider.QQ,
        'openid123'
      );
      expect(mockUsersService.updateLastLogin).toHaveBeenCalled();
      expect(mockAuthService.generateTokens).toHaveBeenCalledWith(mockUser);
    });

    it('should create new user for new social account', async () => {
      mockHttpService.get
        .mockReturnValueOnce(
          of({
            data: mockTokenResponse,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          } as AxiosResponse)
        )
        .mockReturnValueOnce(
          of({
            data: mockOpenIdResponse,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          } as AxiosResponse)
        )
        .mockReturnValueOnce(
          of({
            data: mockUserInfo,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          } as AxiosResponse)
        );

      mockUsersService.findSocialAccount.mockResolvedValue(null);
      mockUsersService.generateOAuthUsername.mockReturnValue('qq_openid12');
      mockUsersService.createOAuthUser.mockResolvedValue(mockUser);
      mockUsersService.createSocialAccount.mockResolvedValue(mockSocialAccount);
      mockUsersService.updateLastLogin.mockResolvedValue(undefined);
      mockAuthService.generateTokens.mockResolvedValue(mockTokens);

      const result = await service.handleCallback('auth_code');

      expect(result).toEqual(mockTokens);
      expect(mockUsersService.createOAuthUser).toHaveBeenCalledWith({
        username: 'qq_openid12',
        nickname: mockUserInfo.nickname,
        avatarUrl: mockUserInfo.figureurl_qq_1,
      });
      expect(mockUsersService.createSocialAccount).toHaveBeenCalledWith(
        mockUser.id,
        SocialProvider.QQ,
        'openid123',
        expect.objectContaining({
          unionid: 'unionid789',
          nickname: mockUserInfo.nickname,
        })
      );
    });

    it('should throw UnauthorizedException if access token request fails', async () => {
      mockHttpService.get.mockReturnValueOnce(
        of({
          data: {
            error: 'invalid_request',
            error_description: 'invalid code',
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        } as AxiosResponse)
      );

      await expect(service.handleCallback('invalid_code')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if openid request fails', async () => {
      mockHttpService.get
        .mockReturnValueOnce(
          of({
            data: mockTokenResponse,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          } as AxiosResponse)
        )
        .mockReturnValueOnce(
          of({
            data: {
              error: 'invalid_access_token',
              error_description: 'access token expired',
            },
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          } as AxiosResponse)
        );

      await expect(service.handleCallback('auth_code')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if userinfo request fails', async () => {
      mockHttpService.get
        .mockReturnValueOnce(
          of({
            data: mockTokenResponse,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          } as AxiosResponse)
        )
        .mockReturnValueOnce(
          of({
            data: mockOpenIdResponse,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          } as AxiosResponse)
        )
        .mockReturnValueOnce(
          of({
            data: {
              error: 'invalid_openid',
              error_description: 'openid not found',
            },
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          } as AxiosResponse)
        );

      await expect(service.handleCallback('auth_code')).rejects.toThrow(UnauthorizedException);
    });

    it('should include fmt=json parameter in token request', async () => {
      mockHttpService.get
        .mockReturnValueOnce(
          of({
            data: mockTokenResponse,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          } as AxiosResponse)
        )
        .mockReturnValueOnce(
          of({
            data: mockOpenIdResponse,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          } as AxiosResponse)
        )
        .mockReturnValueOnce(
          of({
            data: mockUserInfo,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          } as AxiosResponse)
        );

      mockUsersService.findSocialAccount.mockResolvedValue(mockSocialAccount);
      mockUsersService.updateLastLogin.mockResolvedValue(undefined);
      mockAuthService.generateTokens.mockResolvedValue(mockTokens);

      await service.handleCallback('auth_code');

      expect(mockHttpService.get).toHaveBeenCalledWith(expect.stringContaining('fmt=json'));
    });

    it('should request unionid in openid request', async () => {
      mockHttpService.get
        .mockReturnValueOnce(
          of({
            data: mockTokenResponse,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          } as AxiosResponse)
        )
        .mockReturnValueOnce(
          of({
            data: mockOpenIdResponse,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          } as AxiosResponse)
        )
        .mockReturnValueOnce(
          of({
            data: mockUserInfo,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          } as AxiosResponse)
        );

      mockUsersService.findSocialAccount.mockResolvedValue(mockSocialAccount);
      mockUsersService.updateLastLogin.mockResolvedValue(undefined);
      mockAuthService.generateTokens.mockResolvedValue(mockTokens);

      await service.handleCallback('auth_code');

      expect(mockHttpService.get).toHaveBeenCalledWith(expect.stringContaining('unionid=1'));
    });

    it('should use oauth_consumer_key in userinfo request', async () => {
      mockHttpService.get
        .mockReturnValueOnce(
          of({
            data: mockTokenResponse,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          } as AxiosResponse)
        )
        .mockReturnValueOnce(
          of({
            data: mockOpenIdResponse,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          } as AxiosResponse)
        )
        .mockReturnValueOnce(
          of({
            data: mockUserInfo,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          } as AxiosResponse)
        );

      mockUsersService.findSocialAccount.mockResolvedValue(mockSocialAccount);
      mockUsersService.updateLastLogin.mockResolvedValue(undefined);
      mockAuthService.generateTokens.mockResolvedValue(mockTokens);

      await service.handleCallback('auth_code');

      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.stringContaining('oauth_consumer_key=test_app_id')
      );
    });
  });
});
