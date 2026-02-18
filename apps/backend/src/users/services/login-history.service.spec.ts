import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { mock, describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { LoginHistoryService, LoginInfo, LoginHistoryQuery } from './login-history.service';
import { LoginHistory, LoginMethod } from '../../entities/login-history.entity';

describe('LoginHistoryService', () => {
  let service: LoginHistoryService;
  let mockRepository: jest.Mocked<Repository<LoginHistory>>;

  const mockLoginHistory: LoginHistory = {
    id: 'uuid-123',
    userId: 'user-uuid-123',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    deviceFingerprint: 'fingerprint-123',
    loginMethod: LoginMethod.PASSWORD,
    success: true,
    failureReason: null,
    createdAt: new Date('2024-01-15T10:30:00Z'),
    user: null,
  } as LoginHistory;

  const mockFailedLoginHistory: LoginHistory = {
    id: 'uuid-456',
    userId: 'user-uuid-123',
    ipAddress: '192.168.1.2',
    userAgent: 'Mozilla/5.0',
    deviceFingerprint: 'fingerprint-456',
    loginMethod: LoginMethod.PASSWORD,
    success: false,
    failureReason: 'Invalid password',
    createdAt: new Date('2024-01-14T10:30:00Z'),
    user: null,
  } as LoginHistory;

  beforeEach(async () => {
    mockRepository = {
      create: mock(),
      save: mock(),
      find: mock(),
      findAndCount: mock(),
      count: mock(),
      createQueryBuilder: mock(),
    } as unknown as jest.Mocked<Repository<LoginHistory>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginHistoryService,
        {
          provide: getRepositoryToken(LoginHistory),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<LoginHistoryService>(LoginHistoryService);
  });

  afterEach(() => {
    mockRepository.create.mockClear();
    mockRepository.save.mockClear();
    mockRepository.find.mockClear();
    mockRepository.findAndCount.mockClear();
    mockRepository.count.mockClear();
  });

  describe('recordLogin', () => {
    it('should record a successful login', async () => {
      const loginInfo: LoginInfo = {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        deviceFingerprint: 'fingerprint-123',
        loginMethod: LoginMethod.PASSWORD,
        success: true,
      };

      mockRepository.create.mockReturnValue(mockLoginHistory);
      mockRepository.save.mockResolvedValue(mockLoginHistory);

      const result = await service.recordLogin('user-uuid-123', loginInfo);

      expect(mockRepository.create).toHaveBeenCalledWith({
        userId: 'user-uuid-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        deviceFingerprint: 'fingerprint-123',
        loginMethod: LoginMethod.PASSWORD,
        success: true,
        failureReason: null,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(mockLoginHistory);
      expect(result).toEqual(mockLoginHistory);
    });

    it('should record a failed login with failure reason', async () => {
      const loginInfo: LoginInfo = {
        ipAddress: '192.168.1.2',
        userAgent: 'Mozilla/5.0',
        success: false,
        failureReason: 'Invalid password',
      };

      mockRepository.create.mockReturnValue(mockFailedLoginHistory);
      mockRepository.save.mockResolvedValue(mockFailedLoginHistory);

      const result = await service.recordLogin('user-uuid-123', loginInfo);

      expect(mockRepository.create).toHaveBeenCalledWith({
        userId: 'user-uuid-123',
        ipAddress: '192.168.1.2',
        userAgent: 'Mozilla/5.0',
        deviceFingerprint: null,
        loginMethod: null,
        success: false,
        failureReason: 'Invalid password',
      });
      expect(result).toEqual(mockFailedLoginHistory);
    });

    it('should record login with null userId for unknown user attempts', async () => {
      const loginInfo: LoginInfo = {
        ipAddress: '10.0.0.1',
        userAgent: 'Unknown',
        success: false,
        failureReason: 'User not found',
      };

      const unknownUserLogin = {
        ...mockFailedLoginHistory,
        id: 'uuid-789',
        userId: null,
        ipAddress: '10.0.0.1',
      } as LoginHistory;

      mockRepository.create.mockReturnValue(unknownUserLogin);
      mockRepository.save.mockResolvedValue(unknownUserLogin);

      const result = await service.recordLogin(null, loginInfo);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: null,
          ipAddress: '10.0.0.1',
        })
      );
      expect(result.userId).toBeNull();
    });

    it('should record OAuth login', async () => {
      const loginInfo: LoginInfo = {
        ipAddress: '192.168.1.1',
        loginMethod: LoginMethod.OAUTH,
        success: true,
      };

      const oauthLogin = {
        ...mockLoginHistory,
        loginMethod: LoginMethod.OAUTH,
      } as LoginHistory;

      mockRepository.create.mockReturnValue(oauthLogin);
      mockRepository.save.mockResolvedValue(oauthLogin);

      const result = await service.recordLogin('user-uuid-123', loginInfo);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          loginMethod: LoginMethod.OAUTH,
          success: true,
        })
      );
      expect(result).toEqual(oauthLogin);
    });

    it('should record magic link login', async () => {
      const loginInfo: LoginInfo = {
        ipAddress: '192.168.1.1',
        loginMethod: LoginMethod.MAGIC_LINK,
        success: true,
      };

      const magicLinkLogin = {
        ...mockLoginHistory,
        loginMethod: LoginMethod.MAGIC_LINK,
      } as LoginHistory;

      mockRepository.create.mockReturnValue(magicLinkLogin);
      mockRepository.save.mockResolvedValue(magicLinkLogin);

      const result = await service.recordLogin('user-uuid-123', loginInfo);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          loginMethod: LoginMethod.MAGIC_LINK,
        })
      );
      expect(result).toEqual(magicLinkLogin);
    });
  });

  describe('getLoginHistory', () => {
    it('should return paginated login history for a user', async () => {
      mockRepository.findAndCount.mockResolvedValue([
        [mockLoginHistory, mockFailedLoginHistory],
        2,
      ]);

      const result = await service.getLoginHistory('user-uuid-123');

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-uuid-123' },
          order: { createdAt: 'DESC' },
          take: 20,
          skip: 0,
          relations: ['user'],
        })
      );
      expect(result).toEqual({
        data: [mockLoginHistory, mockFailedLoginHistory],
        total: 2,
        limit: 20,
        offset: 0,
      });
    });

    it('should return login history with custom pagination', async () => {
      mockRepository.findAndCount.mockResolvedValue([[mockLoginHistory], 15]);

      const query: LoginHistoryQuery = {
        limit: 10,
        offset: 5,
      };

      const result = await service.getLoginHistory('user-uuid-123', query);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 5,
        })
      );
      expect(result).toEqual({
        data: [mockLoginHistory],
        total: 15,
        limit: 10,
        offset: 5,
      });
    });

    it('should filter login history by success status', async () => {
      mockRepository.findAndCount.mockResolvedValue([[mockLoginHistory], 1]);

      const query: LoginHistoryQuery = {
        success: true,
      };

      const result = await service.getLoginHistory('user-uuid-123', query);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ success: true }),
        })
      );
      expect(result.data).toHaveLength(1);
    });

    it('should filter login history by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      mockRepository.findAndCount.mockResolvedValue([[mockLoginHistory], 1]);

      const query: LoginHistoryQuery = {
        startDate,
        endDate,
      };

      await service.getLoginHistory('user-uuid-123', query);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { _type: 'between' },
          }),
        })
      );
    });

    it('should filter login history by start date only', async () => {
      const startDate = new Date('2024-01-01');

      mockRepository.findAndCount.mockResolvedValue([[mockLoginHistory], 1]);

      const query: LoginHistoryQuery = {
        startDate,
      };

      await service.getLoginHistory('user-uuid-123', query);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { _type: 'moreThanOrEqual' },
          }),
        })
      );
    });

    it('should filter login history by end date only', async () => {
      const endDate = new Date('2024-01-31');

      mockRepository.findAndCount.mockResolvedValue([[mockLoginHistory], 1]);

      const query: LoginHistoryQuery = {
        endDate,
      };

      await service.getLoginHistory('user-uuid-123', query);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { _type: 'lessThanOrEqual' },
          }),
        })
      );
    });

    it('should return empty array when no history found', async () => {
      mockRepository.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.getLoginHistory('non-existent-user');

      expect(result).toEqual({
        data: [],
        total: 0,
        limit: 20,
        offset: 0,
      });
    });
  });

  describe('getRecentLogins', () => {
    it('should return recent logins with default limit', async () => {
      const recentLogins = [mockLoginHistory, mockFailedLoginHistory];
      mockRepository.find.mockResolvedValue(recentLogins);

      const result = await service.getRecentLogins('user-uuid-123');

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-uuid-123' },
        order: { createdAt: 'DESC' },
        take: 10,
        relations: ['user'],
      });
      expect(result).toEqual(recentLogins);
    });

    it('should return recent logins with custom limit', async () => {
      mockRepository.find.mockResolvedValue([mockLoginHistory]);

      const result = await service.getRecentLogins('user-uuid-123', 5);

      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
        })
      );
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no recent logins', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.getRecentLogins('user-uuid-123', 10);

      expect(result).toEqual([]);
    });
  });

  describe('getLoginStats', () => {
    it('should return login statistics for a user', async () => {
      mockRepository.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(95); // successful

      const result = await service.getLoginStats('user-uuid-123');

      expect(result).toEqual({
        total: 100,
        successful: 95,
        failed: 5,
      });
    });

    it('should return zero stats when no login history', async () => {
      mockRepository.count
        .mockResolvedValueOnce(0) // total
        .mockResolvedValueOnce(0); // successful

      const result = await service.getLoginStats('user-uuid-123');

      expect(result).toEqual({
        total: 0,
        successful: 0,
        failed: 0,
      });
    });
  });

  describe('deleteOldHistory', () => {
    it('should delete login history older than specified date', async () => {
      const olderThan = new Date('2023-01-01');
      const mockQueryBuilder = {
        delete: mock().mockReturnThis(),
        where: mock().mockReturnThis(),
        execute: mock().mockResolvedValue({ affected: 50 }),
      };

      mockRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as unknown as ReturnType<typeof mockRepository.createQueryBuilder>
      );

      const result = await service.deleteOldHistory(olderThan);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('createdAt < :olderThan', { olderThan });
      expect(result).toBe(50);
    });

    it('should return 0 when no records deleted', async () => {
      const olderThan = new Date('2025-01-01');
      const mockQueryBuilder = {
        delete: mock().mockReturnThis(),
        where: mock().mockReturnThis(),
        execute: mock().mockResolvedValue({ affected: 0 }),
      };

      mockRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as unknown as ReturnType<typeof mockRepository.createQueryBuilder>
      );

      const result = await service.deleteOldHistory(olderThan);

      expect(result).toBe(0);
    });

    it('should handle null affected result', async () => {
      const olderThan = new Date('2023-01-01');
      const mockQueryBuilder = {
        delete: mock().mockReturnThis(),
        where: mock().mockReturnThis(),
        execute: mock().mockResolvedValue({ affected: null }),
      };

      mockRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as unknown as ReturnType<typeof mockRepository.createQueryBuilder>
      );

      const result = await service.deleteOldHistory(olderThan);

      expect(result).toBe(0);
    });
  });
});
