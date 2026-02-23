import { Test, TestingModule } from '@nestjs/testing';
import { mock, describe, it, expect, beforeEach } from 'bun:test';
import { PermissionCacheService } from './permission-cache.service';
import { CustomCacheService } from '../../custom-cache/custom-cache.service';

describe('PermissionCacheService', () => {
  let service: PermissionCacheService;
  let mockCacheService: {
    get: ReturnType<typeof mock>;
    set: ReturnType<typeof mock>;
    del: ReturnType<typeof mock>;
  };

  beforeEach(async () => {
    mockCacheService = {
      get: mock(),
      set: mock(),
      del: mock(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionCacheService,
        {
          provide: CustomCacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<PermissionCacheService>(PermissionCacheService);
  });

  describe('getUserPermissions', () => {
    it('should return cached permissions when available', async () => {
      const userId = 'user-123';
      const permissions = ['user:read', 'user:create'];
      mockCacheService.get.mockResolvedValue(permissions);

      const result = await service.getUserPermissions(userId);

      expect(result).toEqual(permissions);
      expect(mockCacheService.get).toHaveBeenCalledWith('user:permissions:user-123');
    });

    it('should return null when no cached permissions', async () => {
      const userId = 'user-456';
      mockCacheService.get.mockResolvedValue(undefined);

      const result = await service.getUserPermissions(userId);

      expect(result).toBeNull();
    });
  });

  describe('setUserPermissions', () => {
    it('should cache permissions with correct TTL', async () => {
      const userId = 'user-123';
      const permissions = ['user:read', 'user:create'];

      await service.setUserPermissions(userId, permissions);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        'user:permissions:user-123',
        permissions,
        30 * 60 * 1000 // 30 minutes TTL
      );
    });
  });

  describe('invalidateUser', () => {
    it('should delete cached permissions', async () => {
      const userId = 'user-123';

      await service.invalidateUser(userId);

      expect(mockCacheService.del).toHaveBeenCalledWith('user:permissions:user-123');
    });
  });
});
