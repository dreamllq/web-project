import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { UnauthorizedException } from '@nestjs/common';
import { of } from 'rxjs';
import { AxiosResponse } from 'axios';
import { BaiduOAuthService } from './baidu.service';
import { AuthService } from '../auth.service';
import { UsersService } from '../../users/users.service';
import { SocialProvider } from '../../entities/social-account.entity';
import { User, UserStatus } from '../../entities/user.entity';
import { BaiduConfig } from '../../config/baidu.config';

describe('BaiduOAuthService', () => {
  let service: BaiduOAuthService;

  const mockBaiduConfig: BaiduConfig = {
    appId: 'test_app_id',
    appSecret: 'test_app_secret',
    redirectUri: 'http://localhost:3001/api/auth/oauth/baidu/callback',
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue(mockBaiduConfig),
  };

  const mockHttpService = {
    get: jest.fn(),
  };

  const mockUser = {
    id: 'uuid-123',
    username: 'baidu_abc12345',
    passwordHash: null,
    nickname: 'Test User',
    avatarUrl: 'https://himg.bdimg.com/sys/portrait/item/test_portrait',
    status: UserStatus.ACTIVE,
  } as User;

  const mockSocialAccount = {
    id: 'social-uuid',
    userId: 'uuid-123',
    provider: SocialProvider.BAIDU,
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
        BaiduOAuthService,
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

    service = module.get<BaiduOAuthService>(BaiduOAuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAuthorizationUrl', () => {
    it('should generate Baidu OAuth authorization URL', async () => {
      const result = await service.getAuthorizationUrl('test_state');

      expect(result.url).toContain('https://openapi.baidu.com/oauth/2.0/authorize');
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
        'Baidu OAuth configuration is missing'
      );
    });
  });

  describe('handleCallback', () => {
    const mockTokenResponse = {
      access_token: 'access_token_123',
      expires_in: 7200,
      refresh_token: 'refresh_token_456',
    };

    const mockUserInfo = {
      openid: 'openid123',
      unionid: 'unionid789',
      username: 'Test User',
      portrait: 'test_portrait',
      sex: '1',
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
        SocialProvider.BAIDU,
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
      mockUsersService.generateOAuthUsername.mockReturnValue('baidu_openid12');
      mockUsersService.createOAuthUser.mockResolvedValue(mockUser);
      mockUsersService.createSocialAccount.mockResolvedValue(mockSocialAccount);
      mockUsersService.updateLastLogin.mockResolvedValue(undefined);
      mockAuthService.generateTokens.mockResolvedValue(mockTokens);

      const result = await service.handleCallback('auth_code');

      expect(result).toEqual(mockTokens);
      expect(mockUsersService.createOAuthUser).toHaveBeenCalledWith({
        username: 'baidu_openid12',
        nickname: mockUserInfo.username,
        avatarUrl: 'https://himg.bdimg.com/sys/portrait/item/test_portrait',
      });
      expect(mockUsersService.createSocialAccount).toHaveBeenCalledWith(
        'uuid-123',
        SocialProvider.BAIDU,
        'openid123',
        expect.objectContaining({
          unionid: mockUserInfo.unionid,
          username: mockUserInfo.username,
          portrait: mockUserInfo.portrait,
          sex: mockUserInfo.sex,
        })
      );
    });

    it('should handle user without portrait', async () => {
      const mockAxiosResponse: Partial<AxiosResponse> = {
        data: mockTokenResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValueOnce(of(mockAxiosResponse as AxiosResponse));

      const userInfoWithoutPortrait = { ...mockUserInfo, portrait: '' };
      const mockUserInfoResponse: Partial<AxiosResponse> = {
        data: userInfoWithoutPortrait,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValueOnce(of(mockUserInfoResponse as AxiosResponse));

      mockUsersService.findSocialAccount.mockResolvedValue(null);
      mockUsersService.generateOAuthUsername.mockReturnValue('baidu_openid12');
      mockUsersService.createOAuthUser.mockResolvedValue(mockUser);
      mockUsersService.createSocialAccount.mockResolvedValue(mockSocialAccount);
      mockUsersService.updateLastLogin.mockResolvedValue(undefined);
      mockAuthService.generateTokens.mockResolvedValue(mockTokens);

      await service.handleCallback('auth_code');

      expect(mockUsersService.createOAuthUser).toHaveBeenCalledWith({
        username: 'baidu_openid12',
        nickname: userInfoWithoutPortrait.username,
        avatarUrl: undefined,
      });
    });

    it('should throw UnauthorizedException if access token request fails', async () => {
      const errorResponse: Partial<AxiosResponse> = {
        data: {
          error: 'invalid_request',
          error_description: 'invalid code',
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
          error: 'invalid_token',
          error_description: 'access token expired',
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
    it('should call userinfo endpoint with get_unionid=1 parameter', async () => {
      const mockTokenResponse = {
        access_token: 'access_token_123',
        expires_in: 7200,
        refresh_token: 'refresh_token_456',
      };

      const mockAxiosResponse: Partial<AxiosResponse> = {
        data: mockTokenResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValueOnce(of(mockAxiosResponse as AxiosResponse));

      const mockUserInfoResponse: Partial<AxiosResponse> = {
        data: {
          openid: 'openid123',
          unionid: 'unionid789',
          username: 'Test',
          portrait: 'test_portrait',
          sex: '1',
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

      const userinfoCall = mockHttpService.get.mock.calls[1][0];
      expect(userinfoCall).toContain('get_unionid=1');
      expect(userinfoCall).toContain('https://openapi.baidu.com/rest/2.0/passport/users/getInfo');
    });
  });
});
