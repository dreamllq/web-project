import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { User, UserStatus } from '../entities/user.entity';
import { SocialAccount, SocialProvider } from '../entities/social-account.entity';
import { UsersService, CreateUserData, CreateOAuthUserData } from './users.service';

// Mock bcrypt
jest.mock('bcrypt');
import * as bcrypt from 'bcrypt';

describe('UsersService', () => {
  let service: UsersService;

  const mockUser: User = {
    id: 'uuid-123',
    username: 'testuser',
    email: 'test@example.com',
    phone: null,
    passwordHash: 'hashedpassword',
    nickname: null,
    avatarUrl: null,
    status: UserStatus.ACTIVE,
    locale: 'zh-CN',
    lastLoginAt: null,
    lastLoginIp: null,
    emailVerifiedAt: null,
    phoneVerifiedAt: null,
    mfaEnabled: false,
    mfaSecret: null,
    recoveryCodes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    socialAccounts: [],
    notifications: [],
    files: [],
    oauthTokens: [],
    verificationTokens: [],
    roles: [],
  };

  const mockUserRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockSocialAccountRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(SocialAccount),
          useValue: mockSocialAccountRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createUserData: CreateUserData = {
      username: 'testuser',
      passwordHash: 'hashedpassword',
      email: 'test@example.com',
    };

    it('should create a new user successfully', async () => {
      const mockUser = {
        id: 'uuid-123',
        username: 'testuser',
        passwordHash: 'hashedpassword',
        email: 'test@example.com',
        status: UserStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);

      const result = await service.create(createUserData);

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findOne).toHaveBeenCalledTimes(2);
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        username: 'testuser',
        passwordHash: 'hashedpassword',
        email: 'test@example.com',
        phone: null,
        status: UserStatus.PENDING,
      });
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if username already exists', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce({ id: 'existing-id' });

      await expect(service.create(createUserData)).rejects.toThrow(ConflictException);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { username: 'testuser' } });
    });

    it('should throw ConflictException if email already exists', async () => {
      mockUserRepository.findOne
        .mockResolvedValueOnce(null) // username check
        .mockResolvedValueOnce({ id: 'existing-id' }); // email check

      await expect(service.create(createUserData)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if phone already exists', async () => {
      const dataWithPhone: CreateUserData = {
        ...createUserData,
        phone: '1234567890',
      };

      mockUserRepository.findOne
        .mockResolvedValueOnce(null) // username check
        .mockResolvedValueOnce(null) // email check
        .mockResolvedValueOnce({ id: 'existing-id' }); // phone check

      await expect(service.create(dataWithPhone)).rejects.toThrow(ConflictException);
    });
  });

  describe('findById', () => {
    it('should return a user by id', async () => {
      const mockUser = { id: 'uuid-123', username: 'testuser' };
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findById('uuid-123');

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id: 'uuid-123' } });
    });

    it('should return null if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByUsername', () => {
    it('should return a user by username', async () => {
      const mockUser = { id: 'uuid-123', username: 'testuser' };
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByUsername('testuser');

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { username: 'testuser' } });
    });

    it('should return null if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.findByUsername('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should return a user by email', async () => {
      const mockUser = { id: 'uuid-123', email: 'test@example.com' };
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });
  });

  describe('findByPhone', () => {
    it('should return a user by phone', async () => {
      const mockUser = { id: 'uuid-123', phone: '1234567890' };
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByPhone('1234567890');

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { phone: '1234567890' } });
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp and IP', async () => {
      mockUserRepository.update.mockResolvedValue({ affected: 1 });

      await service.updateLastLogin('uuid-123', '192.168.1.1');

      expect(mockUserRepository.update).toHaveBeenCalledWith(
        'uuid-123',
        expect.objectContaining({
          lastLoginAt: expect.any(Date),
          lastLoginIp: '192.168.1.1',
        })
      );
    });

    it('should update last login without IP', async () => {
      mockUserRepository.update.mockResolvedValue({ affected: 1 });

      await service.updateLastLogin('uuid-123');

      expect(mockUserRepository.update).toHaveBeenCalledWith(
        'uuid-123',
        expect.objectContaining({
          lastLoginAt: expect.any(Date),
          lastLoginIp: null,
        })
      );
    });
  });

  describe('updateStatus', () => {
    it('should update user status', async () => {
      mockUserRepository.update.mockResolvedValue({ affected: 1 });

      await service.updateStatus('uuid-123', UserStatus.ACTIVE);

      expect(mockUserRepository.update).toHaveBeenCalledWith('uuid-123', {
        status: UserStatus.ACTIVE,
      });
    });
  });

  describe('createOAuthUser', () => {
    const createOAuthUserData: CreateOAuthUserData = {
      username: 'wechat_abc12345',
      nickname: 'Test User',
      avatarUrl: 'http://example.com/avatar.jpg',
    };

    it('should create a new OAuth user successfully', async () => {
      const mockUser = {
        id: 'uuid-123',
        username: 'wechat_abc12345',
        passwordHash: null,
        nickname: 'Test User',
        avatarUrl: 'http://example.com/avatar.jpg',
        status: UserStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);

      const result = await service.createOAuthUser(createOAuthUserData);

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { username: 'wechat_abc12345' },
      });
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        username: 'wechat_abc12345',
        passwordHash: null,
        nickname: 'Test User',
        avatarUrl: 'http://example.com/avatar.jpg',
        email: null,
        phone: null,
        status: UserStatus.ACTIVE,
      });
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if username already exists', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce({ id: 'existing-id' });

      await expect(service.createOAuthUser(createOAuthUserData)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if email already exists', async () => {
      const dataWithEmail: CreateOAuthUserData = {
        ...createOAuthUserData,
        email: 'test@example.com',
      };

      mockUserRepository.findOne
        .mockResolvedValueOnce(null) // username check
        .mockResolvedValueOnce({ id: 'existing-id' }); // email check

      await expect(service.createOAuthUser(dataWithEmail)).rejects.toThrow(ConflictException);
    });
  });

  describe('findSocialAccount', () => {
    it('should return a social account by provider and providerUserId', async () => {
      const mockSocialAccount = {
        id: 'social-uuid',
        userId: 'user-uuid',
        provider: SocialProvider.WECHAT,
        providerUserId: 'openid123',
        user: { id: 'user-uuid', username: 'testuser' },
      };

      mockSocialAccountRepository.findOne.mockResolvedValue(mockSocialAccount);

      const result = await service.findSocialAccount(SocialProvider.WECHAT, 'openid123');

      expect(result).toEqual(mockSocialAccount);
      expect(mockSocialAccountRepository.findOne).toHaveBeenCalledWith({
        where: { provider: SocialProvider.WECHAT, providerUserId: 'openid123' },
        relations: ['user'],
      });
    });

    it('should return null if social account not found', async () => {
      mockSocialAccountRepository.findOne.mockResolvedValue(null);

      const result = await service.findSocialAccount(SocialProvider.WECHAT, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('createSocialAccount', () => {
    it('should create a social account successfully', async () => {
      const mockSocialAccount = {
        id: 'social-uuid',
        userId: 'user-uuid',
        provider: SocialProvider.WECHAT,
        providerUserId: 'openid123',
        providerData: { nickname: 'Test' },
      };

      mockSocialAccountRepository.create.mockReturnValue(mockSocialAccount);
      mockSocialAccountRepository.save.mockResolvedValue(mockSocialAccount);

      const result = await service.createSocialAccount(
        'user-uuid',
        SocialProvider.WECHAT,
        'openid123',
        { nickname: 'Test' }
      );

      expect(result).toEqual(mockSocialAccount);
      expect(mockSocialAccountRepository.create).toHaveBeenCalledWith({
        userId: 'user-uuid',
        provider: SocialProvider.WECHAT,
        providerUserId: 'openid123',
        providerData: { nickname: 'Test' },
      });
      expect(mockSocialAccountRepository.save).toHaveBeenCalled();
    });

    it('should create a social account without providerData', async () => {
      const mockSocialAccount = {
        id: 'social-uuid',
        userId: 'user-uuid',
        provider: SocialProvider.WECHAT,
        providerUserId: 'openid123',
        providerData: null,
      };

      mockSocialAccountRepository.create.mockReturnValue(mockSocialAccount);
      mockSocialAccountRepository.save.mockResolvedValue(mockSocialAccount);

      const result = await service.createSocialAccount(
        'user-uuid',
        SocialProvider.WECHAT,
        'openid123'
      );

      expect(result).toEqual(mockSocialAccount);
      expect(mockSocialAccountRepository.create).toHaveBeenCalledWith({
        userId: 'user-uuid',
        provider: SocialProvider.WECHAT,
        providerUserId: 'openid123',
        providerData: null,
      });
    });
  });

  describe('generateOAuthUsername', () => {
    it('should generate username for WeChat provider', () => {
      const result = service.generateOAuthUsername(SocialProvider.WECHAT, 'openid12345678');

      expect(result).toBe('wechat_openid12');
    });

    it('should generate username for WeChat Mini Program provider', () => {
      const result = service.generateOAuthUsername(
        SocialProvider.WECHAT_MINIPROGRAM,
        'openid12345678'
      );

      expect(result).toBe('wechatminiprogram_openid12');
    });

    it('should generate username for DingTalk Mini Program provider', () => {
      const result = service.generateOAuthUsername(
        SocialProvider.DINGTALK_MINIPROGRAM,
        'userid123456789'
      );

      expect(result).toBe('dingtalkminiprogram_userid12');
    });

    it('should handle short provider user ID', () => {
      const result = service.generateOAuthUsername(SocialProvider.WECHAT, 'abc');

      expect(result).toBe('wechat_abc');
    });
  });

  describe('updateEmailVerifiedAt', () => {
    it('should update email verified at timestamp', async () => {
      mockUserRepository.update.mockResolvedValue({ affected: 1 });
      const verifiedAt = new Date();

      await service.updateEmailVerifiedAt('uuid-123', verifiedAt);

      expect(mockUserRepository.update).toHaveBeenCalledWith('uuid-123', {
        emailVerifiedAt: verifiedAt,
      });
    });
  });

  describe('updatePassword', () => {
    it('should update user password hash', async () => {
      mockUserRepository.update.mockResolvedValue({ affected: 1 });

      await service.updatePassword('uuid-123', 'newHashedPassword');

      expect(mockUserRepository.update).toHaveBeenCalledWith('uuid-123', {
        passwordHash: 'newHashedPassword',
      });
    });
  });

  describe('updateProfile', () => {
    it('should update nickname only', async () => {
      const updatedUser = { ...mockUser, nickname: 'New Nickname' };
      mockUserRepository.findOne.mockResolvedValueOnce(mockUser);
      mockUserRepository.update.mockResolvedValue({ affected: 1 });
      mockUserRepository.findOne.mockResolvedValueOnce(updatedUser);

      const result = await service.updateProfile('uuid-123', { nickname: 'New Nickname' });

      expect(result.nickname).toBe('New Nickname');
      expect(mockUserRepository.update).toHaveBeenCalledWith('uuid-123', {
        nickname: 'New Nickname',
      });
    });

    it('should update locale only', async () => {
      const updatedUser = { ...mockUser, locale: 'en-US' };
      mockUserRepository.findOne.mockResolvedValueOnce(mockUser);
      mockUserRepository.update.mockResolvedValue({ affected: 1 });
      mockUserRepository.findOne.mockResolvedValueOnce(updatedUser);

      const result = await service.updateProfile('uuid-123', { locale: 'en-US' });

      expect(result.locale).toBe('en-US');
      expect(mockUserRepository.update).toHaveBeenCalledWith('uuid-123', {
        locale: 'en-US',
      });
    });

    it('should update both nickname and locale', async () => {
      const updatedUser = { ...mockUser, nickname: 'New Name', locale: 'ja-JP' };
      mockUserRepository.findOne.mockResolvedValueOnce(mockUser);
      mockUserRepository.update.mockResolvedValue({ affected: 1 });
      mockUserRepository.findOne.mockResolvedValueOnce(updatedUser);

      const result = await service.updateProfile('uuid-123', {
        nickname: 'New Name',
        locale: 'ja-JP',
      });

      expect(result.nickname).toBe('New Name');
      expect(result.locale).toBe('ja-JP');
      expect(mockUserRepository.update).toHaveBeenCalledWith('uuid-123', {
        nickname: 'New Name',
        locale: 'ja-JP',
      });
    });

    it('should not call update if no fields provided', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      await service.updateProfile('uuid-123', {});

      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.updateProfile('non-existent', { nickname: 'Test' })).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.update.mockResolvedValue({ affected: 1 });

      // Mock bcrypt functions
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('newHashedPassword' as never);

      await service.changePassword('uuid-123', 'OldPassword123', 'NewPassword123');

      expect(mockUserRepository.update).toHaveBeenCalledWith('uuid-123', {
        passwordHash: 'newHashedPassword',
      });
    });

    it('should throw BadRequestException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.changePassword('non-existent', 'old', 'new')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw BadRequestException if user has no password', async () => {
      const userWithoutPassword = { ...mockUser, passwordHash: null };
      mockUserRepository.findOne.mockResolvedValue(userWithoutPassword);

      await expect(service.changePassword('uuid-123', 'old', 'new')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw UnauthorizedException if old password is incorrect', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(
        service.changePassword('uuid-123', 'wrongPassword', 'NewPassword123')
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('softDelete', () => {
    it('should soft delete user account', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.softDelete.mockResolvedValue({ affected: 1 });

      await service.softDelete('uuid-123');

      expect(mockUserRepository.softDelete).toHaveBeenCalledWith('uuid-123');
    });

    it('should throw BadRequestException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.softDelete('non-existent')).rejects.toThrow(BadRequestException);
    });
  });
});
