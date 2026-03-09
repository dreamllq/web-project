import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { mock, describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { SocialAccountService } from './social-account.service';
import { SocialAccount, SocialAccountStatus } from '../entities/social-account.entity';
import { SocialProvider } from '../entities/social-provider.enum';
import { UsersService } from '../users/users.service';
import { LoginHistoryService } from '../users/services/login-history.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('SocialAccountService', () => {
  let service: SocialAccountService;
  let mockRepository: any;
  let mockUsersService: any;
  let mockLoginHistoryService: any;

  const mockUser = {
    id: 'user-id',
    username: 'testuser',
    email: 'test@example.com',
    passwordHash: 'hashed_password',
  };

  const mockSocialAccount: SocialAccount = {
    id: 'test-id',
    userId: 'user-id',
    provider: SocialProvider.WECHAT,
    providerUserId: 'wx_123',
    providerData: { openid: 'wx_123' },
    accessToken: 'access_token',
    refreshToken: 'refresh_token',
    tokenExpiresAt: new Date(Date.now() + 3600000),
    status: SocialAccountStatus.LINKED,
    unboundAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: mockUser as any,
  };

  const mockLoginHistory = [
    {
      id: 'login-1',
      userId: 'user-id',
      ipAddress: '192.168.1.1',
      createdAt: new Date('2024-01-15T10:00:00Z'),
      success: true,
    },
    {
      id: 'login-2',
      userId: 'user-id',
      ipAddress: '192.168.1.2',
      createdAt: new Date('2024-01-10T10:00:00Z'),
      success: true,
    },
  ];

  beforeEach(async () => {
    mockRepository = {
      findOne: mock().mockResolvedValue(mockSocialAccount),
      find: mock().mockResolvedValue([mockSocialAccount]),
      update: mock().mockResolvedValue(undefined),
      createQueryBuilder: mock().mockReturnValue({
        leftJoinAndSelect: mock().mockReturnThis(),
        andWhere: mock().mockReturnThis(),
        orderBy: mock().mockReturnThis(),
        getCount: mock().mockResolvedValue(1),
        skip: mock().mockReturnThis(),
        take: mock().mockReturnThis(),
        getMany: mock().mockResolvedValue([mockSocialAccount]),
      }),
      count: mock().mockResolvedValue(2),
    };

    mockUsersService = {
      findById: mock().mockResolvedValue(mockUser),
    };

    mockLoginHistoryService = {
      getRecentLogins: mock().mockResolvedValue(mockLoginHistory),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialAccountService,
        {
          provide: getRepositoryToken(SocialAccount),
          useValue: mockRepository,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: LoginHistoryService,
          useValue: mockLoginHistoryService,
        },
      ],
    }).compile();

    service = module.get<SocialAccountService>(SocialAccountService);
  });

  afterEach(() => {
    mockRepository.findOne.mockClear();
    mockRepository.find.mockClear();
  });

  // ==================== Existing Tests ====================

  it('should find by id', async () => {
    const result = await service.findById('test-id');

    expect(result).toEqual(mockSocialAccount);
  });

  it('should find by user', async () => {
    const result = await service.findByUser('user-id');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(mockSocialAccount);
  });

  it('should find by provider', async () => {
    const result = await service.findByProvider(SocialProvider.WECHAT, 'wx_123');

    expect(result).toEqual(mockSocialAccount);
  });

  it('should unlink social account', async () => {
    await service.unlink('test-id');

    expect(mockRepository.update).toHaveBeenCalledWith('test-id', {
      status: SocialAccountStatus.UNLINKED,
      unboundAt: expect.any(Date),
      accessToken: null,
      refreshToken: null,
    });
  });

  it('should throw when unlinking already unlinked account', async () => {
    const unlinkedAccount = { ...mockSocialAccount, status: SocialAccountStatus.UNLINKED };
    mockRepository.findOne.mockResolvedValueOnce(unlinkedAccount);

    await expect(service.unlink('test-id')).rejects.toThrow('Social account already unlinked');
  });

  it('should update tokens', async () => {
    await service.updateTokens(
      'test-id',
      'new_access_token',
      'new_refresh_token',
      new Date(Date.now() + 7200000)
    );

    expect(mockRepository.update).toHaveBeenCalled();
  });

  // ==================== Admin List Method Tests ====================

  describe('list', () => {
    it('should return paginated list without filters', async () => {
      const result = await service.list({});

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by provider', async () => {
      const mockQb = {
        leftJoinAndSelect: mock().mockReturnThis(),
        andWhere: mock().mockReturnThis(),
        orderBy: mock().mockReturnThis(),
        getCount: mock().mockResolvedValue(1),
        skip: mock().mockReturnThis(),
        take: mock().mockReturnThis(),
        getMany: mock().mockResolvedValue([mockSocialAccount]),
      };
      mockRepository.createQueryBuilder.mockReturnValueOnce(mockQb);

      await service.list({ provider: SocialProvider.WECHAT });

      expect(mockQb.andWhere).toHaveBeenCalledWith('account.provider = :provider', {
        provider: SocialProvider.WECHAT,
      });
    });

    it('should filter by userId', async () => {
      const mockQb = {
        leftJoinAndSelect: mock().mockReturnThis(),
        andWhere: mock().mockReturnThis(),
        orderBy: mock().mockReturnThis(),
        getCount: mock().mockResolvedValue(1),
        skip: mock().mockReturnThis(),
        take: mock().mockReturnThis(),
        getMany: mock().mockResolvedValue([mockSocialAccount]),
      };
      mockRepository.createQueryBuilder.mockReturnValueOnce(mockQb);

      await service.list({ userId: 'user-id' });

      expect(mockQb.andWhere).toHaveBeenCalledWith('account.userId = :userId', {
        userId: 'user-id',
      });
    });

    it('should filter by keyword', async () => {
      const mockQb = {
        leftJoinAndSelect: mock().mockReturnThis(),
        andWhere: mock().mockReturnThis(),
        orderBy: mock().mockReturnThis(),
        getCount: mock().mockResolvedValue(1),
        skip: mock().mockReturnThis(),
        take: mock().mockReturnThis(),
        getMany: mock().mockResolvedValue([mockSocialAccount]),
      };
      mockRepository.createQueryBuilder.mockReturnValueOnce(mockQb);

      await service.list({ keyword: 'testuser' });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        '(user.username ILIKE :keyword OR user.email ILIKE :keyword)',
        { keyword: '%testuser%' }
      );
    });

    it('should apply pagination with default values', async () => {
      const mockQb = {
        leftJoinAndSelect: mock().mockReturnThis(),
        andWhere: mock().mockReturnThis(),
        orderBy: mock().mockReturnThis(),
        getCount: mock().mockResolvedValue(10),
        skip: mock().mockReturnThis(),
        take: mock().mockReturnThis(),
        getMany: mock().mockResolvedValue([mockSocialAccount]),
      };
      mockRepository.createQueryBuilder.mockReturnValueOnce(mockQb);

      await service.list({});

      expect(mockQb.skip).toHaveBeenCalledWith(0);
      expect(mockQb.take).toHaveBeenCalledWith(20);
    });

    it('should apply custom pagination', async () => {
      const mockQb = {
        leftJoinAndSelect: mock().mockReturnThis(),
        andWhere: mock().mockReturnThis(),
        orderBy: mock().mockReturnThis(),
        getCount: mock().mockResolvedValue(100),
        skip: mock().mockReturnThis(),
        take: mock().mockReturnThis(),
        getMany: mock().mockResolvedValue([mockSocialAccount]),
      };
      mockRepository.createQueryBuilder.mockReturnValueOnce(mockQb);

      await service.list({ limit: 50, offset: 100 });

      expect(mockQb.skip).toHaveBeenCalledWith(100);
      expect(mockQb.take).toHaveBeenCalledWith(50);
    });

    it('should order by createdAt DESC', async () => {
      const mockQb = {
        leftJoinAndSelect: mock().mockReturnThis(),
        andWhere: mock().mockReturnThis(),
        orderBy: mock().mockReturnThis(),
        getCount: mock().mockResolvedValue(1),
        skip: mock().mockReturnThis(),
        take: mock().mockReturnThis(),
        getMany: mock().mockResolvedValue([mockSocialAccount]),
      };
      mockRepository.createQueryBuilder.mockReturnValueOnce(mockQb);

      await service.list({});

      expect(mockQb.orderBy).toHaveBeenCalledWith('account.createdAt', 'DESC');
    });
  });

  // ==================== Batch Unlink Method Tests ====================

  describe('batchUnlink', () => {
    it('should throw if more than 50 ids provided', async () => {
      const ids = Array.from({ length: 51 }, (_, i) => `id-${i}`);

      await expect(service.batchUnlink(ids)).rejects.toThrow(BadRequestException);
      await expect(service.batchUnlink(ids)).rejects.toThrow(
        'Cannot unlink more than 50 accounts at once'
      );
    });

    it('should unlink exactly 50 accounts', async () => {
      const ids = Array.from({ length: 50 }, (_, i) => `id-${i}`);
      mockRepository.findOne.mockResolvedValue(mockSocialAccount);
      mockUsersService.findById.mockResolvedValue(mockUser);
      mockRepository.count.mockResolvedValue(2); // More than 1 social account

      const result = await service.batchUnlink(ids);

      expect(result.success.length + result.failed.length).toBe(50);
    });

    it('should return success for accounts with other auth methods', async () => {
      mockRepository.findOne.mockResolvedValueOnce(mockSocialAccount);
      mockUsersService.findById.mockResolvedValueOnce(mockUser);
      mockRepository.count.mockResolvedValueOnce(2); // Has other social accounts

      const result = await service.batchUnlink(['test-id']);

      expect(result.success).toContain('test-id');
      expect(result.failed).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should return failed for accounts without other auth methods', async () => {
      const userWithoutPassword = { ...mockUser, passwordHash: null };
      mockRepository.findOne.mockResolvedValueOnce(mockSocialAccount);
      mockUsersService.findById.mockResolvedValueOnce(userWithoutPassword);
      mockRepository.count.mockResolvedValueOnce(1); // Only this social account

      const result = await service.batchUnlink(['test-id']);

      expect(result.failed).toContain('test-id');
      expect(result.success).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Cannot unlink the only authentication method');
    });

    it('should return failed for non-existent accounts', async () => {
      mockRepository.findOne.mockResolvedValueOnce(null);

      const result = await service.batchUnlink(['non-existent-id']);

      expect(result.failed).toContain('non-existent-id');
      expect(result.success).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('not found');
    });

    it('should handle mixed success and failures', async () => {
      const userWithoutPassword = { ...mockUser, id: 'user-id-2', passwordHash: null };

      mockRepository.findOne
        .mockResolvedValueOnce(mockSocialAccount)
        .mockResolvedValueOnce(mockSocialAccount)
        .mockResolvedValueOnce(mockSocialAccount)
        .mockResolvedValueOnce({ ...mockSocialAccount, id: 'test-id-2', userId: 'user-id-2' })
        .mockResolvedValueOnce(null);

      mockUsersService.findById
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(userWithoutPassword);

      mockRepository.count.mockResolvedValueOnce(1);

      const result = await service.batchUnlink(['test-id', 'test-id-2', 'test-id-3']);

      expect(result.success).toEqual(['test-id']);
      expect(result.failed).toHaveLength(2);
      expect(result.failed).toContain('test-id-2');
      expect(result.failed).toContain('test-id-3');
      expect(result.errors).toHaveLength(2);
    });

    it('should allow unlinking if user has password', async () => {
      mockRepository.findOne.mockResolvedValueOnce(mockSocialAccount);
      mockUsersService.findById.mockResolvedValueOnce(mockUser); // Has passwordHash

      const result = await service.batchUnlink(['test-id']);

      expect(result.success).toContain('test-id');
    });

    it('should allow unlinking if user has multiple social accounts', async () => {
      const userWithoutPassword = { ...mockUser, passwordHash: null };
      mockRepository.findOne.mockResolvedValueOnce(mockSocialAccount);
      mockUsersService.findById.mockResolvedValueOnce(userWithoutPassword);
      mockRepository.count.mockResolvedValueOnce(3); // 3 social accounts total

      const result = await service.batchUnlink(['test-id']);

      expect(result.success).toContain('test-id');
    });

    it('should continue processing after errors', async () => {
      // First: error
      mockRepository.findOne.mockRejectedValueOnce(new Error('DB error'));
      // Second: success
      mockRepository.findOne.mockResolvedValueOnce(mockSocialAccount);
      mockUsersService.findById.mockResolvedValueOnce(mockUser);

      const result = await service.batchUnlink(['id-1', 'id-2']);

      expect(result.success).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
    });
  });

  // ==================== Get Detail Method Tests ====================

  describe('getDetail', () => {
    it('should return detailed social account info', async () => {
      const result = await service.getDetail('test-id');

      expect(result.id).toBe('test-id');
      expect(result.user.id).toBe('user-id');
      expect(result.user.username).toBe('testuser');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should include login history', async () => {
      const result = await service.getDetail('test-id');

      expect(result.loginHistory).toBeDefined();
      expect(result.loginHistory.loginCount).toBe(2);
      expect(result.loginHistory.lastLoginAt).toEqual(new Date('2024-01-15T10:00:00Z'));
      expect(result.loginHistory.lastLoginIp).toBe('192.168.1.1');
    });

    it('should throw NotFoundException for non-existent account', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.getDetail('non-existent-id')).rejects.toThrow(NotFoundException);
    });

    it('should handle empty login history', async () => {
      mockLoginHistoryService.getRecentLogins.mockResolvedValueOnce([]);

      const result = await service.getDetail('test-id');

      expect(result.loginHistory.loginCount).toBe(0);
      expect(result.loginHistory.lastLoginAt).toBeNull();
      expect(result.loginHistory.lastLoginIp).toBeNull();
    });

    it('should handle user without email', async () => {
      const userWithoutEmail = { ...mockUser, email: null };
      mockRepository.findOne.mockResolvedValueOnce({
        ...mockSocialAccount,
        user: userWithoutEmail,
      });

      const result = await service.getDetail('test-id');

      expect(result.user.email).toBeNull();
    });

    it('should include provider data', async () => {
      const result = await service.getDetail('test-id');

      expect(result.provider).toBe(SocialProvider.WECHAT);
      expect(result.providerUserId).toBe('wx_123');
      expect(result.providerData).toEqual({ openid: 'wx_123' });
    });

    it('should include status information', async () => {
      const result = await service.getDetail('test-id');

      expect(result.status).toBe(SocialAccountStatus.LINKED);
    });
  });

  // ==================== Private Method Tests (via public methods) ====================

  describe('checkUserAuthenticationMethods', () => {
    it('should return true if user has password', async () => {
      mockRepository.findOne.mockResolvedValueOnce(mockSocialAccount);
      mockUsersService.findById.mockResolvedValueOnce(mockUser);

      const result = await service.batchUnlink(['test-id']);

      expect(result.success).toContain('test-id');
    });

    it('should return true if user has multiple social accounts', async () => {
      const userWithoutPassword = { ...mockUser, passwordHash: null };
      mockRepository.findOne.mockResolvedValueOnce(mockSocialAccount);
      mockUsersService.findById.mockResolvedValueOnce(userWithoutPassword);
      mockRepository.count.mockResolvedValueOnce(2);

      const result = await service.batchUnlink(['test-id']);

      expect(result.success).toContain('test-id');
    });

    it('should return false if user has no other auth methods', async () => {
      const userWithoutPassword = { ...mockUser, passwordHash: null };
      mockRepository.findOne.mockResolvedValueOnce(mockSocialAccount);
      mockUsersService.findById.mockResolvedValueOnce(userWithoutPassword);
      mockRepository.count.mockResolvedValueOnce(1);

      const result = await service.batchUnlink(['test-id']);

      expect(result.failed).toContain('test-id');
    });

    it('should return false if user not found', async () => {
      mockRepository.findOne.mockResolvedValueOnce(mockSocialAccount);
      mockUsersService.findById.mockResolvedValueOnce(null);

      const result = await service.batchUnlink(['test-id']);

      expect(result.failed).toContain('test-id');
    });
  });
});
