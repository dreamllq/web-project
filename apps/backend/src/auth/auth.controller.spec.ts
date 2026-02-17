import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { WechatOAuthService } from './oauth/wechat.service';
import { WechatMiniprogramService } from './oauth/wechat-miniprogram.service';
import { DingtalkMiniprogramService } from './oauth/dingtalk-miniprogram.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { User, UserStatus } from '../entities/user.entity';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    refreshToken: jest.fn(),
    logout: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    requestEmailVerification: jest.fn(),
    verifyEmail: jest.fn(),
  };

  const mockWechatOAuthService = {
    getAuthorizationUrl: jest.fn(),
    handleCallback: jest.fn(),
  };

  const mockWechatMiniprogramService = {
    login: jest.fn(),
  };

  const mockDingtalkMiniprogramService = {
    login: jest.fn(),
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
    emailVerifiedAt: null,
    phoneVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    socialAccounts: [],
    notifications: [],
    files: [],
    oauthTokens: [],
    verificationTokens: [],
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
          provide: WechatMiniprogramService,
          useValue: mockWechatMiniprogramService,
        },
        {
          provide: DingtalkMiniprogramService,
          useValue: mockDingtalkMiniprogramService,
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

  describe('requestEmailVerification', () => {
    it('should call authService.requestEmailVerification with correct parameters', async () => {
      const expectedResult = {
        success: true,
        message: 'Verification email sent',
      };

      mockAuthService.requestEmailVerification.mockResolvedValue(expectedResult);

      const result = await controller.requestEmailVerification(mockUser);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.requestEmailVerification).toHaveBeenCalledWith(
        'uuid-123',
        'test@example.com',
        'testuser'
      );
    });

    it('should handle user without email', async () => {
      const userWithoutEmail = { ...mockUser, email: null };

      mockAuthService.requestEmailVerification.mockRejectedValue(
        new Error('User does not have an email address')
      );

      await expect(controller.requestEmailVerification(userWithoutEmail)).rejects.toThrow(
        'User does not have an email address'
      );
    });
  });

  describe('confirmEmailVerification', () => {
    const verifyEmailDto: VerifyEmailDto = {
      token: 'valid_verification_token',
    };

    it('should call authService.verifyEmail with correct parameters', async () => {
      const expectedResult = {
        success: true,
        message: 'Email verified successfully',
      };

      mockAuthService.verifyEmail.mockResolvedValue(expectedResult);

      const result = await controller.confirmEmailVerification(verifyEmailDto);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.verifyEmail).toHaveBeenCalledWith('valid_verification_token');
    });

    it('should handle invalid token', async () => {
      mockAuthService.verifyEmail.mockRejectedValue(
        new Error('Invalid or expired verification token')
      );

      await expect(controller.confirmEmailVerification(verifyEmailDto)).rejects.toThrow(
        'Invalid or expired verification token'
      );
    });
  });

  describe('forgotPassword', () => {
    const forgotPasswordDto: ForgotPasswordDto = {
      email: 'test@example.com',
    };

    it('should call authService.forgotPassword with correct parameters', async () => {
      const expectedResult = {
        success: true,
        message: 'If the email exists, a password reset link will be sent',
      };

      mockAuthService.forgotPassword.mockResolvedValue(expectedResult);

      const result = await controller.forgotPassword(forgotPasswordDto);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith('test@example.com');
    });

    it('should return generic response for non-existent email', async () => {
      const expectedResult = {
        success: true,
        message: 'If the email exists, a password reset link will be sent',
      };

      mockAuthService.forgotPassword.mockResolvedValue(expectedResult);

      const result = await controller.forgotPassword({ email: 'nonexistent@example.com' });

      expect(result).toEqual(expectedResult);
    });
  });

  describe('resetPassword', () => {
    const resetPasswordDto: ResetPasswordDto = {
      token: 'valid_reset_token',
      newPassword: 'NewPassword123!',
    };

    it('should call authService.resetPassword with correct parameters', async () => {
      const expectedResult = {
        success: true,
        message: 'Password reset successfully',
      };

      mockAuthService.resetPassword.mockResolvedValue(expectedResult);

      const result = await controller.resetPassword(resetPasswordDto);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(
        'valid_reset_token',
        'NewPassword123!'
      );
    });

    it('should throw error for invalid token', async () => {
      const { BadRequestException } = await import('@nestjs/common');
      mockAuthService.resetPassword.mockRejectedValue(
        new BadRequestException('Invalid or expired password reset token')
      );

      await expect(
        controller.resetPassword({
          token: 'invalid_token',
          newPassword: 'NewPassword123!',
        })
      ).rejects.toThrow(BadRequestException);
    });
  });
});
