// Mock bcrypt
jest.mock('bcrypt');

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { CustomCacheService } from '../custom-cache/custom-cache.service';
import * as bcrypt from 'bcrypt';
import { AuthService, CustomJwtPayload } from './auth.service';
import { UsersService } from '../users/users.service';
import { User, UserStatus } from '../entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

describe('AuthService', () => {
  let service: AuthService;

  const mockUsersService = {
    create: jest.fn(),
    findByUsername: jest.fn(),
    findById: jest.fn(),
    updateLastLogin: jest.fn(),
    updateStatus: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockCustomCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue({
      secret: 'test-secret-key',
      accessTokenExpiresIn: '15m',
      refreshTokenExpiresIn: '7d',
    }),
  };

  const mockUser = {
    id: 'uuid-123',
    username: 'testuser',
    passwordHash: 'hashed_password',
    email: 'test@example.com',
    phone: null,
    status: UserStatus.ACTIVE,
  } as User;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: CustomCacheService,
          useValue: mockCustomCacheService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('hashPassword', () => {
    it('should hash password with bcrypt', async () => {
      const password = 'Password123';
      const hashedPassword = 'hashed_password';

      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

      const result = await service.hashPassword(password);

      expect(result).toBe(hashedPassword);
      expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);
    });
  });

  describe('comparePassword', () => {
    it('should return true for valid password', async () => {
      const plainPassword = 'Password123';
      const hashedPassword = 'hashed_password';

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.comparePassword(plainPassword, hashedPassword);

      expect(result).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith(plainPassword, hashedPassword);
    });

    it('should return false for invalid password', async () => {
      const plainPassword = 'WrongPassword';
      const hashedPassword = 'hashed_password';

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.comparePassword(plainPassword, hashedPassword);

      expect(result).toBe(false);
    });
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', async () => {
      mockJwtService.sign
        .mockReturnValueOnce('access_token_123')
        .mockReturnValueOnce('refresh_token_456');

      const result = await service.generateTokens(mockUser);

      expect(result).toEqual({
        access_token: 'access_token_123',
        refresh_token: 'refresh_token_456',
        expires_in: 900,
      });

      expect(mockJwtService.sign).toHaveBeenCalledTimes(2);
    });

    it('should include correct payload in access token', async () => {
      mockJwtService.sign.mockReturnValue('token');

      await service.generateTokens(mockUser);

      const accessCall = mockJwtService.sign.mock.calls[0];
      expect(accessCall[0]).toEqual({
        sub: mockUser.id,
        username: mockUser.username,
        type: 'access',
      });
    });

    it('should include correct payload in refresh token', async () => {
      mockJwtService.sign.mockReturnValue('token');

      await service.generateTokens(mockUser);

      const refreshCall = mockJwtService.sign.mock.calls[1];
      expect(refreshCall[0]).toEqual({
        sub: mockUser.id,
        username: mockUser.username,
        type: 'refresh',
      });
    });
  });

  describe('refreshToken', () => {
    const validPayload: CustomJwtPayload = {
      sub: 'uuid-123',
      username: 'testuser',
      type: 'refresh',
    };

    it('should refresh tokens successfully', async () => {
      mockCustomCacheService.get.mockResolvedValue(null);
      mockJwtService.verify.mockReturnValue(validPayload);
      mockUsersService.findById.mockResolvedValue(mockUser);
      mockJwtService.sign
        .mockReturnValueOnce('new_access_token')
        .mockReturnValueOnce('new_refresh_token');

      const result = await service.refreshToken('valid_refresh_token');

      expect(result).toEqual({
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_in: 900,
      });
    });

    it('should throw if token is blacklisted', async () => {
      mockCustomCacheService.get.mockResolvedValue('1');

      await expect(service.refreshToken('blacklisted_token')).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should throw if token type is not refresh', async () => {
      mockCustomCacheService.get.mockResolvedValue(null);
      mockJwtService.verify.mockReturnValue({
        ...validPayload,
        type: 'access',
      });

      await expect(service.refreshToken('access_token_as_refresh')).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should throw if user not found', async () => {
      mockCustomCacheService.get.mockResolvedValue(null);
      mockJwtService.verify.mockReturnValue(validPayload);
      mockUsersService.findById.mockResolvedValue(null);

      await expect(service.refreshToken('valid_refresh_token')).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should throw if user is disabled', async () => {
      const disabledUser = { ...mockUser, status: UserStatus.DISABLED };
      mockCustomCacheService.get.mockResolvedValue(null);
      mockJwtService.verify.mockReturnValue(validPayload);
      mockUsersService.findById.mockResolvedValue(disabledUser);

      await expect(service.refreshToken('valid_refresh_token')).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should blacklist old refresh token after refresh', async () => {
      mockCustomCacheService.get.mockResolvedValue(null);
      mockJwtService.verify.mockReturnValue(validPayload);
      mockUsersService.findById.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('new_token');

      await service.refreshToken('old_refresh_token');

      expect(mockCustomCacheService.set).toHaveBeenCalledWith(
        'blacklist:old_refresh_token',
        '1',
        604800000
      );
    });
  });

  describe('logout', () => {
    it('should blacklist the access token', async () => {
      await service.logout('uuid-123', 'access_token_to_blacklist');

      expect(mockCustomCacheService.set).toHaveBeenCalledWith(
        'blacklist:access_token_to_blacklist',
        '1',
        900000
      );
    });
  });

  describe('validateAccessToken', () => {
    const validAccessPayload: CustomJwtPayload = {
      sub: 'uuid-123',
      username: 'testuser',
      type: 'access',
    };

    it('should return user for valid access token', async () => {
      mockCustomCacheService.get.mockResolvedValue(null);
      mockJwtService.verify.mockReturnValue(validAccessPayload);
      mockUsersService.findById.mockResolvedValue(mockUser);

      const result = await service.validateAccessToken('valid_access_token');

      expect(result).toEqual(mockUser);
    });

    it('should throw if token is blacklisted', async () => {
      mockCustomCacheService.get.mockResolvedValue('1');

      await expect(service.validateAccessToken('blacklisted_token')).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should throw if token type is not access', async () => {
      mockCustomCacheService.get.mockResolvedValue(null);
      mockJwtService.verify.mockReturnValue({
        ...validAccessPayload,
        type: 'refresh',
      });

      await expect(service.validateAccessToken('refresh_token_as_access')).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should throw if user not found', async () => {
      mockCustomCacheService.get.mockResolvedValue(null);
      mockJwtService.verify.mockReturnValue(validAccessPayload);
      mockUsersService.findById.mockResolvedValue(null);

      await expect(service.validateAccessToken('valid_access_token')).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should throw for invalid token', async () => {
      mockCustomCacheService.get.mockResolvedValue(null);
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.validateAccessToken('invalid_token')).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should return true if token is blacklisted', async () => {
      mockCustomCacheService.get.mockResolvedValue('1');

      const result = await service.isTokenBlacklisted('blacklisted_token');

      expect(result).toBe(true);
      expect(mockCustomCacheService.get).toHaveBeenCalledWith('blacklist:blacklisted_token');
    });

    it('should return false if token is not blacklisted', async () => {
      mockCustomCacheService.get.mockResolvedValue(null);

      const result = await service.isTokenBlacklisted('valid_token');

      expect(result).toBe(false);
    });
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      username: 'testuser',
      password: 'Password123',
      email: 'test@example.com',
    };

    it('should register a new user successfully', async () => {
      const hashedPassword = 'hashed_password';
      const newUser = {
        id: 'uuid-123',
        username: 'testuser',
        passwordHash: hashedPassword,
        email: 'test@example.com',
        status: UserStatus.PENDING,
        createdAt: new Date(),
      } as User;

      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockUsersService.create.mockResolvedValue(newUser);

      const result = await service.register(registerDto);

      expect(result).toEqual({
        id: 'uuid-123',
        username: 'testuser',
        status: UserStatus.PENDING,
        createdAt: newUser.createdAt,
      });
      expect(bcrypt.hash).toHaveBeenCalledWith('Password123', 10);
      expect(mockUsersService.create).toHaveBeenCalledWith({
        username: 'testuser',
        passwordHash: hashedPassword,
        email: 'test@example.com',
        phone: undefined,
      });
    });

    it('should register user with phone instead of email', async () => {
      const registerWithPhone: RegisterDto = {
        username: 'testuser',
        password: 'Password123',
        phone: '+1234567890',
      };

      const hashedPassword = 'hashed_password';
      const newUser = {
        id: 'uuid-123',
        username: 'testuser',
        passwordHash: hashedPassword,
        phone: '+1234567890',
        status: UserStatus.PENDING,
        createdAt: new Date(),
      } as User;

      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockUsersService.create.mockResolvedValue(newUser);

      const result = await service.register(registerWithPhone);

      expect(result).toEqual({
        id: 'uuid-123',
        username: 'testuser',
        status: UserStatus.PENDING,
        createdAt: newUser.createdAt,
      });
      expect(mockUsersService.create).toHaveBeenCalledWith({
        username: 'testuser',
        passwordHash: hashedPassword,
        email: undefined,
        phone: '+1234567890',
      });
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      username: 'testuser',
      password: 'Password123',
    };

    it('should login successfully with valid credentials', async () => {
      mockUsersService.findByUsername.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockUsersService.updateLastLogin.mockResolvedValue(undefined);
      mockJwtService.sign.mockReturnValueOnce('access_token').mockReturnValueOnce('refresh_token');

      const result = await service.login(loginDto);

      expect(result).toEqual({
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
      });
      expect(mockUsersService.updateLastLogin).toHaveBeenCalledWith('uuid-123', undefined);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockUsersService.findByUsername.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      expect(mockUsersService.findByUsername).toHaveBeenCalledWith('testuser');
    });

    it('should throw UnauthorizedException if user has no password', async () => {
      const userWithoutPassword = {
        ...mockUser,
        passwordHash: null,
      } as User;

      mockUsersService.findByUsername.mockResolvedValue(userWithoutPassword);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      mockUsersService.findByUsername.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user is disabled', async () => {
      const disabledUser = {
        ...mockUser,
        status: UserStatus.DISABLED,
      } as User;

      mockUsersService.findByUsername.mockResolvedValue(disabledUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should activate pending user after first login', async () => {
      const pendingUser = {
        ...mockUser,
        status: UserStatus.PENDING,
      } as User;

      mockUsersService.findByUsername.mockResolvedValue(pendingUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockUsersService.updateLastLogin.mockResolvedValue(undefined);
      mockUsersService.updateStatus.mockResolvedValue(undefined);
      mockJwtService.sign.mockReturnValue('token');

      await service.login(loginDto);

      expect(mockUsersService.updateStatus).toHaveBeenCalledWith('uuid-123', UserStatus.ACTIVE);
    });

    it('should pass client IP to updateLastLogin', async () => {
      mockUsersService.findByUsername.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockUsersService.updateLastLogin.mockResolvedValue(undefined);
      mockJwtService.sign.mockReturnValue('token');

      await service.login(loginDto, '192.168.1.1');

      expect(mockUsersService.updateLastLogin).toHaveBeenCalledWith('uuid-123', '192.168.1.1');
    });
  });

  describe('validateUser', () => {
    it('should return user if found', async () => {
      mockUsersService.findById.mockResolvedValue(mockUser);

      const result = await service.validateUser('uuid-123');

      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      mockUsersService.findById.mockResolvedValue(null);

      const result = await service.validateUser('non-existent');

      expect(result).toBeNull();
    });
  });
});
