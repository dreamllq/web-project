import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { User, UserStatus } from '../entities/user.entity';
import { SocialAccount, SocialProvider } from '../entities/social-account.entity';
import { UsersService, CreateUserData, CreateOAuthUserData } from './users.service';

describe('UsersService', () => {
  let service: UsersService;

  const mockUserRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
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
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
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
        }),
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
        }),
      );
    });
  });

  describe('updateStatus', () => {
    it('should update user status', async () => {
      mockUserRepository.update.mockResolvedValue({ affected: 1 });

      await service.updateStatus('uuid-123', UserStatus.ACTIVE);

      expect(mockUserRepository.update).toHaveBeenCalledWith('uuid-123', { status: UserStatus.ACTIVE });
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
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { username: 'wechat_abc12345' } });
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
        { nickname: 'Test' },
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
        'openid123',
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
        'openid12345678',
      );

      expect(result).toBe('wechatminiprogram_openid12');
    });

    it('should generate username for DingTalk Mini Program provider', () => {
      const result = service.generateOAuthUsername(
        SocialProvider.DINGTALK_MINIPROGRAM,
        'userid123456789',
      );

      expect(result).toBe('dingtalkminiprogram_userid12');
    });

    it('should handle short provider user ID', () => {
      const result = service.generateOAuthUsername(SocialProvider.WECHAT, 'abc');

      expect(result).toBe('wechat_abc');
    });
  });
});
