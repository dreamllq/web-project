import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PermissionService } from './permission.service';
import { Permission } from '../entities/permission.entity';
import { CreatePermissionDto } from './dto/permission.dto';

describe('PermissionService', () => {
  let service: PermissionService;

  const mockPermission: Permission = {
    id: 'uuid-permission-123',
    name: 'user:create',
    resource: 'user',
    action: 'create',
    description: 'Create new users',
  };

  // Mock repositories
  const mockPermissionRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  // Mock DataSource and QueryRunner
  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      create: jest.fn(),
      save: jest.fn(),
      getRepository: jest.fn(),
    },
  };

  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
  };

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionService,
        {
          provide: getRepositoryToken(Permission),
          useValue: mockPermissionRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<PermissionService>(PermissionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPermission', () => {
    const createDto: CreatePermissionDto = {
      name: 'custom:view',
      resource: 'custom',
      action: 'view',
      description: 'View custom resource',
    };

    it('should create a new permission successfully', async () => {
      mockPermissionRepo.findOne.mockResolvedValueOnce(null); // No existing permission
      mockPermissionRepo.create.mockReturnValue(mockPermission);
      mockPermissionRepo.save.mockResolvedValue(mockPermission);

      const result = await service.createPermission(createDto);

      expect(result).toBeDefined();
      expect(mockPermissionRepo.create).toHaveBeenCalledWith({
        name: createDto.name,
        resource: createDto.resource,
        action: createDto.action,
        description: createDto.description,
      });
    });

    it('should throw BadRequestException for duplicate permission name', async () => {
      mockPermissionRepo.findOne.mockResolvedValue(mockPermission);

      await expect(service.createPermission(createDto)).rejects.toThrow(BadRequestException);
      await expect(service.createPermission(createDto)).rejects.toThrow(
        "Permission 'custom:view' already exists"
      );
    });
  });

  describe('getPermissions', () => {
    it('should return all permissions', async () => {
      const permissions = [
        mockPermission,
        { ...mockPermission, id: 'uuid-456', name: 'user:read' },
      ];
      mockPermissionRepo.find.mockResolvedValue(permissions);

      const result = await service.getPermissions();

      expect(result).toHaveLength(2);
      expect(mockPermissionRepo.find).toHaveBeenCalledWith({
        order: { resource: 'ASC', action: 'ASC' },
      });
    });

    it('should return empty array if no permissions', async () => {
      mockPermissionRepo.find.mockResolvedValue([]);

      const result = await service.getPermissions();

      expect(result).toEqual([]);
    });
  });

  describe('getPermissionById', () => {
    it('should return permission by ID', async () => {
      mockPermissionRepo.findOne.mockResolvedValue(mockPermission);

      const result = await service.getPermissionById('uuid-permission-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('uuid-permission-123');
    });

    it('should return null if permission not found', async () => {
      mockPermissionRepo.findOne.mockResolvedValue(null);

      const result = await service.getPermissionById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getPermissionsByResource', () => {
    it('should return permissions filtered by resource', async () => {
      const userPermissions = [
        mockPermission,
        { ...mockPermission, id: 'uuid-456', name: 'user:read', action: 'read' },
      ];
      mockPermissionRepo.find.mockResolvedValue(userPermissions);

      const result = await service.getPermissionsByResource('user');

      expect(result).toEqual(userPermissions);
      expect(mockPermissionRepo.find).toHaveBeenCalledWith({
        where: { resource: 'user' },
        order: { action: 'ASC' },
      });
    });

    it('should return empty array if no permissions for resource', async () => {
      mockPermissionRepo.find.mockResolvedValue([]);

      const result = await service.getPermissionsByResource('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('deletePermission', () => {
    it('should delete permission successfully', async () => {
      mockPermissionRepo.findOne.mockResolvedValue(mockPermission);
      mockPermissionRepo.remove.mockResolvedValue(mockPermission);

      await service.deletePermission('uuid-permission-123');

      expect(mockPermissionRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'uuid-permission-123' },
      });
      expect(mockPermissionRepo.remove).toHaveBeenCalledWith(mockPermission);
    });

    it('should throw NotFoundException if permission not found', async () => {
      mockPermissionRepo.findOne.mockResolvedValue(null);

      await expect(service.deletePermission('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('checkPermission', () => {
    const mockGetUserPermissions = jest.fn();

    it('should return true for exact permission match', async () => {
      mockGetUserPermissions.mockResolvedValue(['user:create', 'user:read']);

      const result = await service.checkPermission(
        'user-123',
        'user',
        'create',
        mockGetUserPermissions
      );

      expect(result).toBe(true);
    });

    it('should return true for resource wildcard permission', async () => {
      mockGetUserPermissions.mockResolvedValue(['user:*', 'role:read']);

      const result = await service.checkPermission(
        'user-123',
        'user',
        'delete',
        mockGetUserPermissions
      );

      expect(result).toBe(true);
    });

    it('should return true for action wildcard permission', async () => {
      mockGetUserPermissions.mockResolvedValue(['*:create', 'role:read']);

      const result = await service.checkPermission(
        'user-123',
        'policy',
        'create',
        mockGetUserPermissions
      );

      expect(result).toBe(true);
    });

    it('should return true for full wildcard permission', async () => {
      mockGetUserPermissions.mockResolvedValue(['*:*']);

      const result = await service.checkPermission(
        'user-123',
        'any-resource',
        'any-action',
        mockGetUserPermissions
      );

      expect(result).toBe(true);
    });

    it('should return false when permission not found', async () => {
      mockGetUserPermissions.mockResolvedValue(['user:read', 'role:read']);

      const result = await service.checkPermission(
        'user-123',
        'user',
        'delete',
        mockGetUserPermissions
      );

      expect(result).toBe(false);
    });

    it('should return false when user has no permissions', async () => {
      mockGetUserPermissions.mockResolvedValue([]);

      const result = await service.checkPermission(
        'user-123',
        'user',
        'create',
        mockGetUserPermissions
      );

      expect(result).toBe(false);
    });
  });
});
