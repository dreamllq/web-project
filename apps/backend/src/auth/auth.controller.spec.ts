import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { WechatOAuthService } from './oauth/wechat.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { User, UserStatus } from '../entities/user.entity';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    refreshToken: jest.fn(),
    logout: jest.fn(),
  };

  const mockWechatOAuthService = {
    getAuthorizationUrl: jest.fn(),
    handleCallback: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('http://localhost:5173'),
  };

  const mockRequest = {
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
  } as any;

  const mockUser: User = {
    id: 'uuid-123',
    username: 'testuser',
    email: 'test@example.com',
    phone: null,
    passwordHash: 'hashed_password',
    nickname: null,
    avatarUrl: null,
    status: UserStatus.ACTIVE,
    locale: 'zh-CN',
    lastLoginAt: null,
    lastLoginIp: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    socialAccounts: [],
    notifications: [],
    files: [],
    oauthTokens: [],
  } as User;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: WechatOAuthService,
          useValue: mockWechatOAuthService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      username: 'testuser',
      password: 'Password123',
      email: 'test@example.com',
    };

    it('should call authService.register with correct parameters', async () => {
      const expectedResult = {
        id: 'uuid-123',
        username: 'testuser',
        status: UserStatus.PENDING,
        createdAt: new Date(),
      };

      mockAuthService.register.mockResolvedValue(expectedResult);

      const result = await controller.register(registerDto);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      username: 'testuser',
      password: 'Password123',
    };

    it('should call authService.login with correct parameters', async () => {
      const expectedResult = {
        access_token: 'access_token',
        refresh_token: 'refresh_token',
        expires_in: 900,
        user: {
          id: 'uuid-123',
          username: 'testuser',
          email: 'test@example.com',
          phone: null,
          status: UserStatus.ACTIVE,
        },
      };

      mockAuthService.login.mockResolvedValue(expectedResult);

      const result = await controller.login(loginDto, mockRequest);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto, '127.0.0.1');
    });

    it('should use socket.remoteAddress when ip is not available', async () => {
      const requestWithoutIp = {
        ip: undefined,
        socket: { remoteAddress: '192.168.1.1' },
      } as any;

      const expectedResult = {
        access_token: 'access_token',
        refresh_token: 'refresh_token',
        expires_in: 900,
        user: {
          id: 'uuid-123',
          username: 'testuser',
          email: 'test@example.com',
          phone: null,
          status: UserStatus.ACTIVE,
        },
      };

      mockAuthService.login.mockResolvedValue(expectedResult);

      await controller.login(loginDto, requestWithoutIp);

      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto, '192.168.1.1');
    });
  });

  describe('refreshToken', () => {
    const refreshTokenDto: RefreshTokenDto = {
      refresh_token: 'valid_refresh_token',
    };

    it('should call authService.refreshToken with correct parameters', async () => {
      const expectedResult = {
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_in: 900,
      };

      mockAuthService.refreshToken.mockResolvedValue(expectedResult);

      const result = await controller.refreshToken(refreshTokenDto);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.refreshToken).toHaveBeenCalledWith('valid_refresh_token');
    });
  });

  describe('logout', () => {
    it('should call authService.logout with correct parameters', async () => {
      const authHeader = 'Bearer access_token_123';

      await controller.logout(mockUser, authHeader);

      expect(mockAuthService.logout).toHaveBeenCalledWith('uuid-123', 'access_token_123');
    });

    it('should handle missing authorization header gracefully', async () => {
      await controller.logout(mockUser, undefined);

      expect(mockAuthService.logout).toHaveBeenCalledWith('uuid-123', '');
    });

    it('should return success message', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);

      const result = await controller.logout(mockUser, 'Bearer token');

      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });
});
