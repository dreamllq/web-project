import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { mock, describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { BadRequestException } from '@nestjs/common';
import { OAuthTokenService, BatchOperationResult } from './oauth-token.service';
import { OAuthToken } from '../entities/oauth-token.entity';
import { CustomCacheService } from '../custom-cache/custom-cache.service';

describe('OAuthTokenService', () => {
  let service: OAuthTokenService;
  let mockTokenRepository: any;
  let mockCacheService: any;

  const mockToken: OAuthToken = {
    id: 'test-id',
    clientId: 'client-id',
    userId: 'user-id',
    accessToken: 'access_token_1234567890abcdefghijklmnopqrstuvwxyz',
    refreshToken: 'refresh_token_123',
    scopes: ['openid', 'profile'],
    expiresAt: new Date(Date.now() + 3600000),
    revokedAt: null,
    createdAt: new Date(),
    client: null as any,
    user: null as any,
  };

  const mockQueryBuilder = {
    andWhere: mock().mockReturnThis(),
    orderBy: mock().mockReturnThis(),
    getCount: mock().mockResolvedValue(1),
    skip: mock().mockReturnThis(),
    take: mock().mockReturnThis(),
    getMany: mock().mockResolvedValue([mockToken]),
  };

  beforeEach(async () => {
    mockTokenRepository = {
      createQueryBuilder: mock(() => mockQueryBuilder),
      findOne: mock().mockResolvedValue(mockToken),
      find: mock().mockResolvedValue([mockToken]),
      update: mock().mockResolvedValue(undefined),
      count: mock().mockResolvedValue(0),
    };

    mockCacheService = {
      del: mock().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthTokenService,
        {
          provide: getRepositoryToken(OAuthToken),
          useValue: mockTokenRepository,
        },
        {
          provide: CustomCacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<OAuthTokenService>(OAuthTokenService);
  });

  afterEach(() => {
    mockTokenRepository.findOne.mockClear();
    mockTokenRepository.createQueryBuilder.mockClear();
  });

  it('should list tokens with pagination', async () => {
    const result = await service.list({ limit: 10, offset: 0 });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('should find token by id', async () => {
    const result = await service.findById('test-id');

    expect(result).toEqual(mockToken);
  });

  it('should find tokens by client', async () => {
    const result = await service.findByClient('client-id');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(mockToken);
  });

  it('should find tokens by user', async () => {
    const result = await service.findByUser('user-id');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(mockToken);
  });

  it('should revoke token', async () => {
    await service.revoke('test-id');

    expect(mockTokenRepository.update).toHaveBeenCalled();
    expect(mockCacheService.del).toHaveBeenCalled();
  });

  it('should revoke all tokens for user', async () => {
    await service.revokeByUser('user-id');

    expect(mockTokenRepository.update).toHaveBeenCalled();
    expect(mockCacheService.del).toHaveBeenCalled();
  });

  it('should count tokens by client id', async () => {
    mockTokenRepository.count = mock().mockResolvedValue(5);

    const count = await service.countByClientId('client-id');

    expect(count).toBe(5);
    expect(mockTokenRepository.count).toHaveBeenCalledWith({
      where: { clientId: 'client-id' },
    });
  });

  it('should return 0 when no tokens exist for client', async () => {
    mockTokenRepository.count = mock().mockResolvedValue(0);

    const count = await service.countByClientId('non-existent-client');

    expect(count).toBe(0);
  });

  // ============ batchRevoke Tests ============

  describe('batchRevoke', () => {
    it('should successfully revoke all tokens', async () => {
      const ids = ['id-1', 'id-2', 'id-3'];

      const longToken1 = { ...mockToken, id: 'id-1', accessToken: 'abcdefghijklmnopqrst' };
      const longToken2 = { ...mockToken, id: 'id-2', accessToken: 'abcdefghijklmnopqrst' };
      const longToken3 = { ...mockToken, id: 'id-3', accessToken: 'abcdefghijklmnopqrst' };

      mockTokenRepository.findOne = mock()
        .mockResolvedValueOnce(longToken1)
        .mockResolvedValueOnce(longToken2)
        .mockResolvedValueOnce(longToken3);

      const result = await service.batchRevoke(ids);

      expect(result.success).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.success).toContain('id-1');
      expect(result.success).toContain('id-2');
      expect(result.success).toContain('id-3');
    });

    it('should handle partial failures', async () => {
      const ids = ['id-1', 'id-2', 'id-3'];

      mockTokenRepository.findOne = mock()
        .mockResolvedValueOnce({ ...mockToken, id: 'id-1', revokedAt: false })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...mockToken, id: 'id-3', revokedAt: false });

      const result = await service.batchRevoke(ids);

      expect(result.success).toHaveLength(2);
      expect(result.success).toContain('id-1');
      expect(result.success).toContain('id-3');
      expect(result.failed).toHaveLength(1);
      expect(result.failed).toContain('id-2');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('id-2');
    });

    it('should throw BadRequestException when exceeding 100 tokens', async () => {
      const ids = Array.from({ length: 101 }, (_, i) => `id-${i}`);

      await expect(service.batchRevoke(ids)).rejects.toThrow(BadRequestException);
      await expect(service.batchRevoke(ids)).rejects.toThrow(
        'Cannot revoke more than 100 tokens at once'
      );
    });

    it('should return empty result for empty array', async () => {
      const result = await service.batchRevoke([]);

      expect(result.success).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should allow exactly 100 tokens', async () => {
      const ids = Array.from({ length: 100 }, (_, i) => `id-${i}`);

      mockTokenRepository.findOne = mock().mockResolvedValue(mockToken);

      const result = await service.batchRevoke(ids);

      expect(result.success).toHaveLength(100);
      expect(result.failed).toHaveLength(0);
    });

    it('should handle partial failures', async () => {
      const ids = ['id-1', 'id-2', 'id-3'];

      // Mock: id-1 and id-3 succeed, id-2 fails (not found)
      mockTokenRepository.findOne = mock()
        .mockResolvedValueOnce({ ...mockToken, id: 'id-1' })
        .mockResolvedValueOnce(null) // id-2 not found
        .mockResolvedValueOnce({ ...mockToken, id: 'id-3' });

      const result = await service.batchRevoke(ids);

      expect(result.success).toHaveLength(2);
      expect(result.success).toContain('id-1');
      expect(result.success).toContain('id-3');
      expect(result.failed).toHaveLength(1);
      expect(result.failed).toContain('id-2');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('id-2');
    });

    it('should throw BadRequestException when exceeding 100 tokens', async () => {
      const ids = Array.from({ length: 101 }, (_, i) => `id-${i}`);

      await expect(service.batchRevoke(ids)).rejects.toThrow(BadRequestException);
      await expect(service.batchRevoke(ids)).rejects.toThrow(
        'Cannot revoke more than 100 tokens at once'
      );
    });

    it('should return empty result for empty array', async () => {
      const result = await service.batchRevoke([]);

      expect(result.success).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should allow exactly 100 tokens', async () => {
      const ids = Array.from({ length: 100 }, (_, i) => `id-${i}`);

      // Mock all tokens found
      mockTokenRepository.findOne = mock().mockResolvedValue(mockToken);

      const result = await service.batchRevoke(ids);

      expect(result.success).toHaveLength(100);
      expect(result.failed).toHaveLength(0);
    });
  });

  // ============ export Tests ============

  describe('export', () => {
    it('should generate CSV with correct format', async () => {
      const csv = await service.export({ limit: 10, offset: 0 });

      const lines = csv.split('\n');
      expect(lines.length).toBeGreaterThan(0);

      // Check headers
      const headers = lines[0].split(',');
      expect(headers).toContain('Access Token');
      expect(headers).toContain('Client ID');
      expect(headers).toContain('User ID');
      expect(headers).toContain('Scope');
      expect(headers).toContain('Expires At');
      expect(headers).toContain('Created At');
    });

    it('should mask access tokens in CSV', async () => {
      const longToken = {
        ...mockToken,
        accessToken: 'abcdefghijklmnopqrstuvwxyz1234567890',
      };

      const mockQueryBuilder = {
        andWhere: mock().mockReturnThis(),
        orderBy: mock().mockReturnThis(),
        getCount: mock().mockResolvedValue(1),
        skip: mock().mockReturnThis(),
        take: mock().mockReturnThis(),
        getMany: mock().mockResolvedValue([longToken]),
      };

      mockTokenRepository.createQueryBuilder = mock(() => mockQueryBuilder);

      const csv = await service.export({ limit: 10, offset: 0 });

      expect(csv).not.toContain('abcdefghijklmnopqrstuvwxyz1234567890');

      const lines = csv.split('\n');
      const dataLine = lines[1];
      expect(dataLine).toMatch(/\w{10}\.\.\.\w{10}/);
    });

    it('should not include user PII in CSV', async () => {
      const csv = await service.export({ limit: 10, offset: 0 });

      // Should not contain PII fields
      const headers = csv.split('\n')[0].split(',');
      expect(headers).not.toContain('Email');
      expect(headers).not.toContain('Phone');
      expect(headers).not.toContain('Username');
    });

    it('should limit export to 10000 records', async () => {
      const customMockQueryBuilder = {
        andWhere: mock().mockReturnThis(),
        orderBy: mock().mockReturnThis(),
        getCount: mock().mockResolvedValue(15000),
        skip: mock().mockReturnThis(),
        take: mock().mockReturnThis(),
        getMany: mock().mockResolvedValue(
          Array.from({ length: 10000 }, (_, i) => ({
            ...mockToken,
            id: `id-${i}`,
            accessToken: `token_${i}_abcdefghijklmnopqrst`,
          }))
        ),
      };

      mockTokenRepository.createQueryBuilder = mock(() => customMockQueryBuilder);

      const csv = await service.export({ limit: 10, offset: 0 });

      const lines = csv.split('\n');
      expect(lines.length).toBe(10001);
    });

    it('should handle empty results', async () => {
      const customMockQueryBuilder = {
        andWhere: mock().mockReturnThis(),
        orderBy: mock().mockReturnThis(),
        getCount: mock().mockResolvedValue(0),
        skip: mock().mockReturnThis(),
        take: mock().mockReturnThis(),
        getMany: mock().mockResolvedValue([]),
      };

      mockTokenRepository.createQueryBuilder = mock(() => customMockQueryBuilder);

      const csv = await service.export({ limit: 10, offset: 0 });

      const lines = csv.split('\n');
      expect(lines.length).toBe(1);
      expect(lines[0]).toContain('Access Token');
    });
  });
});
