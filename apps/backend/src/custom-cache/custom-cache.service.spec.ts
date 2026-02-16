import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CustomCacheService } from './custom-cache.service';
import { CacheKeyPrefix, CacheTTL } from './custom-cache.constants';

describe('CustomCacheService', () => {
  let service: CustomCacheService;
  let mockCacheManager: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
  };

  beforeEach(async () => {
    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomCacheService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<CustomCacheService>(CustomCacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('should get a value from cache', async () => {
      const key = 'test-key';
      const expectedValue = { data: 'test-data' };
      mockCacheManager.get.mockResolvedValue(expectedValue);

      const result = await service.get(key);

      expect(mockCacheManager.get).toHaveBeenCalledWith(key);
      expect(result).toEqual(expectedValue);
    });

    it('should return undefined when key does not exist', async () => {
      const key = 'non-existent-key';
      mockCacheManager.get.mockResolvedValue(undefined);

      const result = await service.get(key);

      expect(mockCacheManager.get).toHaveBeenCalledWith(key);
      expect(result).toBeUndefined();
    });

    it('should return typed value', async () => {
      interface TestType {
        id: string;
        name: string;
      }
      const key = 'typed-key';
      const expectedValue: TestType = { id: '123', name: 'test' };
      mockCacheManager.get.mockResolvedValue(expectedValue);

      const result = await service.get<TestType>(key);

      expect(result).toEqual(expectedValue);
    });
  });

  describe('set', () => {
    it('should set a value in cache without TTL', async () => {
      const key = 'test-key';
      const value = { data: 'test-data' };
      mockCacheManager.set.mockResolvedValue(undefined);

      await service.set(key, value);

      expect(mockCacheManager.set).toHaveBeenCalledWith(key, value, undefined);
    });

    it('should set a value in cache with TTL', async () => {
      const key = 'test-key';
      const value = { data: 'test-data' };
      const ttl = 900000; // 15 minutes in ms
      mockCacheManager.set.mockResolvedValue(undefined);

      await service.set(key, value, ttl);

      expect(mockCacheManager.set).toHaveBeenCalledWith(key, value, ttl);
    });

    it('should set value with CacheTTL constant', async () => {
      const key = 'test-key';
      const value = 'token-data';
      const ttl = CacheTTL.ACCESS_TOKEN * 1000; // Convert to ms
      mockCacheManager.set.mockResolvedValue(undefined);

      await service.set(key, value, ttl);

      expect(mockCacheManager.set).toHaveBeenCalledWith(key, value, ttl);
    });
  });

  describe('del', () => {
    it('should delete a value from cache', async () => {
      const key = 'test-key';
      mockCacheManager.del.mockResolvedValue(undefined);

      await service.del(key);

      expect(mockCacheManager.del).toHaveBeenCalledWith(key);
    });
  });

  describe('key prefix integration', () => {
    it('should construct blacklist key using CacheKeyPrefix', () => {
      const token = 'abc123';
      const key = `${CacheKeyPrefix.BLACKLIST}:${token}`;

      expect(key).toBe('blacklist:abc123');
    });

    it('should construct oauth client key using CacheKeyPrefix', () => {
      const clientId = 'client-xyz';
      const key = `${CacheKeyPrefix.OAUTH_CLIENT}:${clientId}`;

      expect(key).toBe('oauth:client:client-xyz');
    });

    it('should construct oauth code key using CacheKeyPrefix', () => {
      const code = 'auth-code-123';
      const key = `${CacheKeyPrefix.OAUTH_CODE}:${code}`;

      expect(key).toBe('oauth:code:auth-code-123');
    });

    it('should construct oauth token key using CacheKeyPrefix', () => {
      const token = 'access-token-xyz';
      const key = `${CacheKeyPrefix.OAUTH_TOKEN}:${token}`;

      expect(key).toBe('oauth:token:access-token-xyz');
    });
  });
});
