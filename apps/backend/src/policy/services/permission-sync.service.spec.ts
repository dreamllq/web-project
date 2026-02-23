import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PermissionSyncService } from './permission-sync.service';
import { Permission } from '../../entities/permission.entity';
// PERMISSION_KEY is used internally by the service

describe('PermissionSyncService', () => {
  let service: PermissionSyncService;
  let mockRepository: { find: typeof mock; create: typeof mock; save: typeof mock };
  let mockDiscoveryService: { getControllers: typeof mock };
  let mockReflector: { get: typeof mock };

  beforeEach(async () => {
    mockRepository = {
      find: mock(),
      create: mock(),
      save: mock(),
    };

    mockDiscoveryService = {
      getControllers: mock(),
    };

    mockReflector = {
      get: mock(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionSyncService,
        {
          provide: 'DiscoveryService',
          useValue: mockDiscoveryService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
        {
          provide: getRepositoryToken(Permission),
          useValue: mockRepository,
        },
      ],
    }).compile();

    // Override the discoveryService injection
    service = module.get<PermissionSyncService>(PermissionSyncService);
    // @ts-expect-error - accessing private for testing
    service['discoveryService'] = mockDiscoveryService;
    // @ts-expect-error - accessing private for testing
    service['reflector'] = mockReflector;
    // @ts-expect-error - accessing private for testing
    service['permissionRepository'] = mockRepository;
  });

  describe('syncPermissions', () => {
    it('should return early when no controllers have @RequirePermission', async () => {
      mockDiscoveryService.getControllers.mockReturnValue([]);
      mockRepository.find.mockResolvedValue([]);

      const result = await service.syncPermissions();

      expect(result).toEqual({ total: 0, created: 0 });
    });

    it('should create missing permissions from decorators', async () => {
      const mockInstance = {
        method1: () => {},
        method2: () => {},
      };

      mockDiscoveryService.getControllers.mockReturnValue([{ instance: mockInstance }]);

      mockReflector.get
        .mockReturnValueOnce({ resource: 'user', action: 'read' })
        .mockReturnValueOnce({ resource: 'user', action: 'write' });

      mockRepository.find.mockResolvedValue([]);
      mockRepository.create.mockImplementation((data: unknown) => data);
      mockRepository.save.mockImplementation((data: unknown) => Promise.resolve({ ...(data as object), id: 'uuid' }));

      const result = await service.syncPermissions();

      expect(result.total).toBe(2);
      expect(result.created).toBe(2);
      expect(mockRepository.save).toHaveBeenCalledTimes(2);
    });

    it('should not create permissions that already exist', async () => {
      const mockInstance = {
        method1: () => {},
      };

      mockDiscoveryService.getControllers.mockReturnValue([{ instance: mockInstance }]);

      mockReflector.get.mockReturnValue({ resource: 'user', action: 'read' });

      mockRepository.find.mockResolvedValue([
        {
          id: 'existing-id',
          resource: 'user',
          action: 'read',
          name: 'user:read',
          description: null,
        },
      ]);

      const result = await service.syncPermissions();

      expect(result.total).toBe(1);
      expect(result.created).toBe(0);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should handle controllers without instance', async () => {
      mockDiscoveryService.getControllers.mockReturnValue([
        { instance: null },
        { instance: undefined },
      ]);
      mockRepository.find.mockResolvedValue([]);

      const result = await service.syncPermissions();

      expect(result).toEqual({ total: 0, created: 0 });
    });

    it('should handle methods without @RequirePermission decorator', async () => {
      const mockInstance = {
        publicMethod: () => {},
      };

      mockDiscoveryService.getControllers.mockReturnValue([{ instance: mockInstance }]);

      mockReflector.get.mockReturnValue(undefined);
      mockRepository.find.mockResolvedValue([]);

      const result = await service.syncPermissions();

      expect(result).toEqual({ total: 0, created: 0 });
    });

    it('should deduplicate permissions from multiple methods', async () => {
      const mockInstance = {
        method1: () => {},
        method2: () => {},
        method3: () => {},
      };

      mockDiscoveryService.getControllers.mockReturnValue([{ instance: mockInstance }]);

      // Same permission on multiple methods
      mockReflector.get
        .mockReturnValueOnce({ resource: 'user', action: 'read' })
        .mockReturnValueOnce({ resource: 'user', action: 'read' })
        .mockReturnValueOnce({ resource: 'user', action: 'write' });

      mockRepository.find.mockResolvedValue([]);
      mockRepository.create.mockImplementation((data: unknown) => data);
      mockRepository.save.mockImplementation((data: unknown) => Promise.resolve({ ...(data as object), id: 'uuid' }));

      const result = await service.syncPermissions();

      expect(result.total).toBe(2);
      expect(result.created).toBe(2);
    });
  });

  describe('onModuleInit', () => {
    it('should call syncPermissions on module init', async () => {
      mockDiscoveryService.getControllers.mockReturnValue([]);
      mockRepository.find.mockResolvedValue([]);

      await service.onModuleInit();

      expect(mockRepository.find).toHaveBeenCalled();
    });
  });
});
