import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { AuditService, sanitizeRequestData, extractResourceId } from './audit.service';
import { AuditLog } from '../entities/audit-log.entity';

describe('AuditService', () => {
  let service: AuditService;

  const mockAuditLog: AuditLog = {
    id: 'uuid-123',
    userId: 'user-uuid',
    action: 'create',
    resourceType: 'user',
    resourceId: 'resource-uuid',
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    requestData: { name: 'test' },
    responseStatus: 201,
    errorMessage: null,
    createdAt: new Date(),
    user: null,
  };

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('should create an audit log entry successfully', async () => {
      const logData = {
        userId: 'user-uuid',
        action: 'create',
        resourceType: 'user',
        resourceId: 'resource-uuid',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        requestData: { name: 'test' },
        responseStatus: 201,
      };

      mockRepository.create.mockReturnValue(mockAuditLog);
      mockRepository.save.mockResolvedValue(mockAuditLog);

      await service.log(logData);

      expect(mockRepository.create).toHaveBeenCalledWith({
        userId: logData.userId,
        action: logData.action,
        resourceType: logData.resourceType,
        resourceId: logData.resourceId,
        ipAddress: logData.ipAddress,
        userAgent: logData.userAgent,
        requestData: logData.requestData,
        responseStatus: logData.responseStatus,
        errorMessage: null,
      });
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should handle null values correctly', async () => {
      const logData = {
        action: 'login',
        resourceType: 'session',
        ipAddress: '127.0.0.1',
        responseStatus: 200,
      };

      mockRepository.create.mockReturnValue(mockAuditLog);
      mockRepository.save.mockResolvedValue(mockAuditLog);

      await service.log(logData);

      expect(mockRepository.create).toHaveBeenCalledWith({
        userId: null,
        action: logData.action,
        resourceType: logData.resourceType,
        resourceId: null,
        ipAddress: logData.ipAddress,
        userAgent: null,
        requestData: null,
        responseStatus: logData.responseStatus,
        errorMessage: null,
      });
    });

    it('should not throw when saving fails', async () => {
      const logData = {
        action: 'test',
        resourceType: 'test',
        ipAddress: '127.0.0.1',
        responseStatus: 200,
      };

      mockRepository.create.mockReturnValue(mockAuditLog);
      mockRepository.save.mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(service.log(logData)).resolves.toBeUndefined();
    });
  });

  describe('findAll', () => {
    it('should return paginated audit logs', async () => {
      mockRepository.findAndCount.mockResolvedValue([[mockAuditLog], 1]);

      const result = await service.findAll({});

      expect(result).toEqual({ data: [mockAuditLog], total: 1 });
      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: {},
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
        relations: ['user'],
      });
    });

    it('should filter by userId', async () => {
      mockRepository.findAndCount.mockResolvedValue([[mockAuditLog], 1]);

      await service.findAll({ userId: 'user-uuid' });

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-uuid' },
        }),
      );
    });

    it('should filter by action', async () => {
      mockRepository.findAndCount.mockResolvedValue([[mockAuditLog], 1]);

      await service.findAll({ action: 'create' });

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { action: 'create' },
        }),
      );
    });

    it('should filter by resourceType', async () => {
      mockRepository.findAndCount.mockResolvedValue([[mockAuditLog], 1]);

      await service.findAll({ resourceType: 'user' });

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { resourceType: 'user' },
        }),
      );
    });

    it('should apply pagination correctly', async () => {
      mockRepository.findAndCount.mockResolvedValue([[mockAuditLog], 50]);

      const result = await service.findAll({ page: 2, limit: 10 });

      expect(result).toEqual({ data: [mockAuditLog], total: 50 });
      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: {},
        order: { createdAt: 'DESC' },
        skip: 10,
        take: 10,
        relations: ['user'],
      });
    });

    it('should filter by date range', async () => {
      mockRepository.findAndCount.mockResolvedValue([[mockAuditLog], 1]);

      const startDate = '2024-01-01T00:00:00.000Z';
      const endDate = '2024-12-31T23:59:59.999Z';

      await service.findAll({ startDate, endDate });

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            createdAt: expect.anything(),
          },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return an audit log by ID', async () => {
      mockRepository.findOne.mockResolvedValue(mockAuditLog);

      const result = await service.findOne('uuid-123');

      expect(result).toEqual(mockAuditLog);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'uuid-123' },
        relations: ['user'],
      });
    });

    it('should throw NotFoundException if audit log not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByUserId', () => {
    it('should return audit logs for a specific user', async () => {
      mockRepository.find.mockResolvedValue([mockAuditLog]);

      const result = await service.findByUserId('user-uuid');

      expect(result).toEqual([mockAuditLog]);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-uuid' },
        order: { createdAt: 'DESC' },
        take: 50,
      });
    });

    it('should accept custom limit', async () => {
      mockRepository.find.mockResolvedValue([mockAuditLog]);

      await service.findByUserId('user-uuid', 10);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-uuid' },
        order: { createdAt: 'DESC' },
        take: 10,
      });
    });
  });

  describe('findByResource', () => {
    it('should return audit logs for a specific resource', async () => {
      mockRepository.find.mockResolvedValue([mockAuditLog]);

      const result = await service.findByResource('user', 'resource-uuid');

      expect(result).toEqual([mockAuditLog]);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { resourceType: 'user', resourceId: 'resource-uuid' },
        order: { createdAt: 'DESC' },
        take: 50,
      });
    });
  });

  describe('sanitizeRequestData', () => {
    it('should return null for null input', () => {
      expect(sanitizeRequestData(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(sanitizeRequestData(undefined)).toBeNull();
    });

    it('should redact password fields', () => {
      const data = { username: 'test', password: 'secret123' };
      const result = sanitizeRequestData(data);

      expect(result).toEqual({ username: 'test', password: '[REDACTED]' });
    });

    it('should redact token fields', () => {
      const data = { accessToken: 'abc123', refreshToken: 'xyz789' };
      const result = sanitizeRequestData(data);

      expect(result).toEqual({ accessToken: '[REDACTED]', refreshToken: '[REDACTED]' });
    });

    it('should redact case-insensitive sensitive fields', () => {
      const data = { Password: 'secret', ACCESS_TOKEN: 'token' };
      const result = sanitizeRequestData(data);

      expect(result).toEqual({ Password: '[REDACTED]', ACCESS_TOKEN: '[REDACTED]' });
    });

    it('should recursively sanitize nested objects', () => {
      const data = {
        user: {
          name: 'test',
          password: 'secret',
        },
      };
      const result = sanitizeRequestData(data);

      expect(result).toEqual({
        user: {
          name: 'test',
          password: '[REDACTED]',
        },
      });
    });

    it('should preserve non-sensitive fields', () => {
      const data = { name: 'test', email: 'test@example.com', age: 25 };
      const result = sanitizeRequestData(data);

      expect(result).toEqual(data);
    });
  });

  describe('extractResourceId', () => {
    it('should extract id from response with id field', () => {
      const response = { id: 'resource-uuid', name: 'test' };
      expect(extractResourceId(response)).toBe('resource-uuid');
    });

    it('should extract id from nested data object', () => {
      const response = { data: { id: 'resource-uuid' }, message: 'success' };
      expect(extractResourceId(response)).toBe('resource-uuid');
    });

    it('should return undefined for null input', () => {
      expect(extractResourceId(null)).toBeUndefined();
    });

    it('should return undefined for undefined input', () => {
      expect(extractResourceId(undefined)).toBeUndefined();
    });

    it('should return undefined for non-object input', () => {
      expect(extractResourceId('string')).toBeUndefined();
    });

    it('should return undefined if no id field exists', () => {
      const response = { name: 'test', message: 'success' };
      expect(extractResourceId(response)).toBeUndefined();
    });
  });
});
