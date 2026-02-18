import { Test, TestingModule } from '@nestjs/testing';
import { mock, describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { LoginHistoryController } from './login-history.controller';
import { LoginHistoryService, LoginHistoryResult } from '../services/login-history.service';
import { LoginHistory, LoginMethod } from '../../entities/login-history.entity';
import { User, UserStatus } from '../../entities/user.entity';

describe('LoginHistoryController', () => {
  let controller: LoginHistoryController;
  let mockLoginHistoryService: jest.Mocked<LoginHistoryService>;

  const mockUser: User = {
    id: 'user-uuid-123',
    username: 'testuser',
    email: 'test@example.com',
    phone: null,
    passwordHash: 'hashedpassword',
    nickname: null,
    avatarUrl: null,
    status: UserStatus.ACTIVE,
    locale: 'en-US',
    lastLoginAt: new Date(),
    lastLoginIp: null,
    emailVerifiedAt: null,
    phoneVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  } as User;

  const mockLoginHistory: LoginHistory = {
    id: 'uuid-123',
    userId: 'user-uuid-123',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 Chrome/120.0',
    deviceFingerprint: 'fingerprint-123',
    loginMethod: LoginMethod.PASSWORD,
    success: true,
    failureReason: null,
    createdAt: new Date('2024-01-15T10:30:00Z'),
    user: mockUser,
  } as LoginHistory;

  const mockFailedLoginHistory: LoginHistory = {
    id: 'uuid-456',
    userId: 'user-uuid-123',
    ipAddress: '192.168.1.2',
    userAgent: 'Mozilla/5.0 Chrome/119.0',
    deviceFingerprint: 'fingerprint-456',
    loginMethod: LoginMethod.PASSWORD,
    success: false,
    failureReason: 'invalid_password',
    createdAt: new Date('2024-01-14T10:30:00Z'),
    user: mockUser,
  } as LoginHistory;

  beforeEach(async () => {
    mockLoginHistoryService = {
      recordLogin: mock(),
      getLoginHistory: mock(),
      getRecentLogins: mock(),
      getLoginStats: mock(),
      deleteOldHistory: mock(),
    } as unknown as jest.Mocked<LoginHistoryService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LoginHistoryController],
      providers: [
        {
          provide: LoginHistoryService,
          useValue: mockLoginHistoryService,
        },
      ],
    }).compile();

    controller = module.get<LoginHistoryController>(LoginHistoryController);
  });

  afterEach(() => {
    mockLoginHistoryService.getLoginHistory.mockClear();
  });

  describe('getLoginHistory', () => {
    it('should return login history with default pagination', async () => {
      const mockResult: LoginHistoryResult = {
        data: [mockLoginHistory],
        total: 1,
        limit: 20,
        offset: 0,
      };

      mockLoginHistoryService.getLoginHistory.mockResolvedValue(mockResult);

      const result = await controller.getLoginHistory(mockUser, {});

      expect(mockLoginHistoryService.getLoginHistory).toHaveBeenCalledWith('user-uuid-123', {
        limit: undefined,
        offset: undefined,
        success: undefined,
        startDate: undefined,
        endDate: undefined,
      });
      expect(result).toEqual({
        data: [
          {
            id: 'uuid-123',
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0 Chrome/120.0',
            deviceFingerprint: 'fingerprint-123',
            loginMethod: LoginMethod.PASSWORD,
            success: true,
            failureReason: null,
            createdAt: '2024-01-15T10:30:00.000Z',
          },
        ],
        pagination: {
          total: 1,
          limit: 20,
          offset: 0,
        },
      });
    });

    it('should return login history with custom pagination', async () => {
      const mockResult: LoginHistoryResult = {
        data: [mockLoginHistory, mockFailedLoginHistory],
        total: 25,
        limit: 10,
        offset: 10,
      };

      mockLoginHistoryService.getLoginHistory.mockResolvedValue(mockResult);

      const result = await controller.getLoginHistory(mockUser, {
        limit: 10,
        offset: 10,
      });

      expect(mockLoginHistoryService.getLoginHistory).toHaveBeenCalledWith(
        'user-uuid-123',
        expect.objectContaining({
          limit: 10,
          offset: 10,
        })
      );
      expect(result.pagination).toEqual({
        total: 25,
        limit: 10,
        offset: 10,
      });
    });

    it('should filter by success status', async () => {
      const mockResult: LoginHistoryResult = {
        data: [mockLoginHistory],
        total: 1,
        limit: 20,
        offset: 0,
      };

      mockLoginHistoryService.getLoginHistory.mockResolvedValue(mockResult);

      await controller.getLoginHistory(mockUser, { success: true });

      expect(mockLoginHistoryService.getLoginHistory).toHaveBeenCalledWith(
        'user-uuid-123',
        expect.objectContaining({
          success: true,
        })
      );
    });

    it('should filter by date range', async () => {
      const mockResult: LoginHistoryResult = {
        data: [mockLoginHistory],
        total: 1,
        limit: 20,
        offset: 0,
      };

      mockLoginHistoryService.getLoginHistory.mockResolvedValue(mockResult);

      await controller.getLoginHistory(mockUser, {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      });

      expect(mockLoginHistoryService.getLoginHistory).toHaveBeenCalledWith(
        'user-uuid-123',
        expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        })
      );
    });

    it('should return empty array when no login history', async () => {
      const mockResult: LoginHistoryResult = {
        data: [],
        total: 0,
        limit: 20,
        offset: 0,
      };

      mockLoginHistoryService.getLoginHistory.mockResolvedValue(mockResult);

      const result = await controller.getLoginHistory(mockUser, {});

      expect(result).toEqual({
        data: [],
        pagination: {
          total: 0,
          limit: 20,
          offset: 0,
        },
      });
    });

    it('should include failed login attempts in response', async () => {
      const mockResult: LoginHistoryResult = {
        data: [mockFailedLoginHistory],
        total: 1,
        limit: 20,
        offset: 0,
      };

      mockLoginHistoryService.getLoginHistory.mockResolvedValue(mockResult);

      const result = await controller.getLoginHistory(mockUser, { success: false });

      expect(result.data[0]).toEqual({
        id: 'uuid-456',
        ipAddress: '192.168.1.2',
        userAgent: 'Mozilla/5.0 Chrome/119.0',
        deviceFingerprint: 'fingerprint-456',
        loginMethod: LoginMethod.PASSWORD,
        success: false,
        failureReason: 'invalid_password',
        createdAt: '2024-01-14T10:30:00.000Z',
      });
    });
  });

  describe('toLoginHistoryItem', () => {
    it('should transform LoginHistory entity to response item', async () => {
      const mockResult: LoginHistoryResult = {
        data: [mockLoginHistory],
        total: 1,
        limit: 20,
        offset: 0,
      };

      mockLoginHistoryService.getLoginHistory.mockResolvedValue(mockResult);

      const result = await controller.getLoginHistory(mockUser, {});

      expect(result.data[0]).toHaveProperty('id');
      expect(result.data[0]).toHaveProperty('ipAddress');
      expect(result.data[0]).toHaveProperty('userAgent');
      expect(result.data[0]).toHaveProperty('deviceFingerprint');
      expect(result.data[0]).toHaveProperty('loginMethod');
      expect(result.data[0]).toHaveProperty('success');
      expect(result.data[0]).toHaveProperty('failureReason');
      expect(result.data[0]).toHaveProperty('createdAt');
      expect(typeof result.data[0].createdAt).toBe('string');
    });

    it('should handle null values in login history', async () => {
      const loginWithNulls: LoginHistory = {
        id: 'uuid-789',
        userId: 'user-uuid-123',
        ipAddress: null,
        userAgent: null,
        deviceFingerprint: null,
        loginMethod: null,
        success: true,
        failureReason: null,
        createdAt: new Date('2024-01-15T10:30:00Z'),
        user: null,
      } as LoginHistory;

      const mockResult: LoginHistoryResult = {
        data: [loginWithNulls],
        total: 1,
        limit: 20,
        offset: 0,
      };

      mockLoginHistoryService.getLoginHistory.mockResolvedValue(mockResult);

      const result = await controller.getLoginHistory(mockUser, {});

      expect(result.data[0].ipAddress).toBeNull();
      expect(result.data[0].userAgent).toBeNull();
      expect(result.data[0].deviceFingerprint).toBeNull();
      expect(result.data[0].loginMethod).toBeNull();
      expect(result.data[0].failureReason).toBeNull();
    });
  });
});
