import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { User, UserStatus } from '../entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

// Mock bcrypt
jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;

  const mockUsersService = {
    create: jest.fn(),
    findByUsername: jest.fn(),
    findById: jest.fn(),
    updateLastLogin: jest.fn(),
    updateStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: mockUsersService,
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

  describe('register', () => {
    const registerDto: RegisterDto = {
      username: 'testuser',
      password: 'Password123',
      email: 'test@example.com',
    };

    it('should register a new user successfully', async () => {
      const hashedPassword = 'hashed_password';
      const mockUser = {
        id: 'uuid-123',
        username: 'testuser',
        passwordHash: hashedPassword,
        email: 'test@example.com',
        status: UserStatus.PENDING,
        createdAt: new Date(),
      } as User;

      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockUsersService.create.mockResolvedValue(mockUser);

      const result = await service.register(registerDto);

      expect(result).toEqual({
        id: 'uuid-123',
        username: 'testuser',
        status: UserStatus.PENDING,
        createdAt: mockUser.createdAt,
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
      const mockUser = {
        id: 'uuid-123',
        username: 'testuser',
        passwordHash: hashedPassword,
        phone: '+1234567890',
        status: UserStatus.PENDING,
        createdAt: new Date(),
      } as User;

      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockUsersService.create.mockResolvedValue(mockUser);

      const result = await service.register(registerWithPhone);

      expect(result).toEqual({
        id: 'uuid-123',
        username: 'testuser',
        status: UserStatus.PENDING,
        createdAt: mockUser.createdAt,
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

    const mockUser = {
      id: 'uuid-123',
      username: 'testuser',
      passwordHash: 'hashed_password',
      email: 'test@example.com',
      phone: null,
      status: UserStatus.ACTIVE,
    } as User;

    it('should login successfully with valid credentials', async () => {
      mockUsersService.findByUsername.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockUsersService.updateLastLogin.mockResolvedValue(undefined);

      const result = await service.login(loginDto);

      expect(result).toEqual({
        user: {
          id: 'uuid-123',
          username: 'testuser',
          email: 'test@example.com',
          phone: null,
          status: UserStatus.ACTIVE,
        },
        message: 'Login successful',
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

      const result = await service.login(loginDto);

      expect(mockUsersService.updateStatus).toHaveBeenCalledWith('uuid-123', UserStatus.ACTIVE);
      expect(result.message).toBe('Login successful');
    });

    it('should pass client IP to updateLastLogin', async () => {
      mockUsersService.findByUsername.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockUsersService.updateLastLogin.mockResolvedValue(undefined);

      await service.login(loginDto, '192.168.1.1');

      expect(mockUsersService.updateLastLogin).toHaveBeenCalledWith('uuid-123', '192.168.1.1');
    });
  });

  describe('validateUser', () => {
    it('should return user if found', async () => {
      const mockUser = { id: 'uuid-123' } as User;
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
