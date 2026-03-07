import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { mock, describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { OAuthTokenService } from './oauth-token.service';
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
    accessToken: 'access_token_123',
    refreshToken: 'refresh_token_123',
    scopes: ['openid', 'profile'],
    expiresAt: new Date(Date.now() + 3600000),
    revokedAt: null,
    createdAt: new Date(),
    client: null as any,
    user: null as any,
  };

  beforeEach(async () => {
    mockTokenRepository = {
      createQueryBuilder: mock(() => ({
        andWhere: mock().mockReturnThis(),
        orderBy: mock().mockReturnThis(),
        getCount: mock().mockResolvedValue(1),
        skip: mock().mockReturnThis(),
        take: mock().mockReturnThis(),
        getMany: mock().mockResolvedValue([mockToken]),
      })),
      findOne: mock().mockResolvedValue(mockToken),
      find: mock().mockResolvedValue([mockToken]),
      update: mock().mockResolvedValue(undefined),
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
});
