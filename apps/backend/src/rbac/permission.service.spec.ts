import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PermissionService } from './permission.service';
import { Permission } from '../entities/permission.entity';
import { PolicyPermission } from '../entities/policy-permission.entity';
import { CreatePermissionDto, UpdatePermissionDto } from './dto/permission.dto';

describe('PermissionService', () => {
  let service: PermissionService;

  const mockPermission: Permission = {
    id: 'uuid-permission-123',
    name: 'user:create',
    resource: 'user',
    action: 'create',
    description: 'Create new users',
  };

  const mockPolicyPermission = {
    id: 'uuid-pp-1',
    permissionId: 'uuid-permission-123',
    policyId: 'uuid-policy-1',
    createdAt: new Date(),
    policy: {
      id: 'uuid-policy-1',
      name: 'Admin Policy',
    },
  };

  // Mock repositories
  const mockPermissionRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  const mockPolicyPermissionRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  // Mock query builder for policy permissions
  const mockQueryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
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

    // Setup mock query builder
    mockPolicyPermissionRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionService,
        {
          provide: getRepositoryToken(Permission),
          useValue: mockPermissionRepo,
        },
        {
          provide: getRepositoryToken(PolicyPermission),
          useValue: mockPolicyPermissionRepo,
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
      policyIds: ['uuid-policy-1', 'uuid-policy-2'],
    };

    it('should create a new permission successfully', async () => {
      // Setup mocks
      mockPermissionRepo.findOne.mockResolvedValueOnce(null); // No existing permission
      mockQueryRunner.manager.create.mockReturnValue(mockPermission);
      mockQueryRunner.manager.save.mockResolvedValue(mockPermission);
      mockQueryRunner.manager.getRepository.mockReturnValue({
        create: jest.fn().mockReturnValue(mockPolicyPermission),
        save: jest.fn().mockResolvedValue(mockPolicyPermission),
      });

      // Mock getPermissionById call after creation
      mockPermissionRepo.findOne.mockResolvedValueOnce(mockPermission);
      mockPolicyPermissionRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.getMany.mockResolvedValue([mockPolicyPermission]);

      const result = await service.createPermission(createDto);

      expect(result).toBeDefined();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(Permission, {
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

    it('should create permission without policy associations', async () => {
      const dtoWithoutPolicies: CreatePermissionDto = {
        name: 'custom:delete',
        resource: 'custom',
        action: 'delete',
      };

      mockPermissionRepo.findOne.mockResolvedValueOnce(null);
      mockQueryRunner.manager.create.mockReturnValue({
        ...mockPermission,
        name: 'custom:delete',
      });
      mockQueryRunner.manager.save.mockResolvedValue({
        ...mockPermission,
        name: 'custom:delete',
      });

      // Mock getPermissionById
      mockPermissionRepo.findOne.mockResolvedValueOnce({
        ...mockPermission,
        name: 'custom:delete',
      });
      mockQueryBuilder.getMany.mockResolvedValue([]);

      const result = await service.createPermission(dtoWithoutPolicies);

      expect(result).toBeDefined();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      mockPermissionRepo.findOne.mockResolvedValueOnce(null);
      mockQueryRunner.manager.create.mockReturnValue(mockPermission);
      mockQueryRunner.manager.save.mockRejectedValue(new Error('Database error'));

      await expect(service.createPermission(createDto)).rejects.toThrow('Database error');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe('getPermissions', () => {
    it('should return all permissions with their associated policies', async () => {
      const permissions = [
        mockPermission,
        { ...mockPermission, id: 'uuid-456', name: 'user:read' },
      ];
      mockPermissionRepo.find.mockResolvedValue(permissions);

      const policyPermissions = [
        { ...mockPolicyPermission, permissionId: 'uuid-permission-123' },
        {
          ...mockPolicyPermission,
          id: 'uuid-pp-2',
          permissionId: 'uuid-permission-123',
          policyId: 'uuid-policy-2',
          policy: { id: 'uuid-policy-2', name: 'User Policy' },
        },
      ];
      mockPolicyPermissionRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.getMany.mockResolvedValue(policyPermissions);

      const result = await service.getPermissions();

      expect(result).toHaveLength(2);
      expect(result[0].policies).toBeDefined();
      expect(mockPermissionRepo.find).toHaveBeenCalledWith({
        order: { resource: 'ASC', action: 'ASC' },
      });
    });

    it('should return empty policies array for permissions without associations', async () => {
      mockPermissionRepo.find.mockResolvedValue([mockPermission]);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      const result = await service.getPermissions();

      expect(result).toHaveLength(1);
      expect(result[0].policies).toEqual([]);
    });
  });

  describe('getPermissionById', () => {
    it('should return permission with policies by ID', async () => {
      mockPermissionRepo.findOne.mockResolvedValue(mockPermission);
      mockPolicyPermissionRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.getMany.mockResolvedValue([mockPolicyPermission]);

      const result = await service.getPermissionById('uuid-permission-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('uuid-permission-123');
      expect(result?.policies).toHaveLength(1);
      expect(result?.policies?.[0]).toEqual({
        id: 'uuid-policy-1',
        name: 'Admin Policy',
      });
    });

    it('should return null if permission not found', async () => {
      mockPermissionRepo.findOne.mockResolvedValue(null);

      const result = await service.getPermissionById('non-existent');

      expect(result).toBeNull();
    });

    it('should return permission with empty policies array when no associations', async () => {
      mockPermissionRepo.findOne.mockResolvedValue(mockPermission);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      const result = await service.getPermissionById('uuid-permission-123');

      expect(result).toBeDefined();
      expect(result?.policies).toEqual([]);
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

  describe('updatePermission', () => {
    const updateDto: UpdatePermissionDto = {
      name: 'user:create:all',
      description: 'Updated description',
    };

    it('should update permission fields successfully', async () => {
      // First findOne: get the permission
      mockPermissionRepo.findOne.mockResolvedValueOnce(mockPermission);
      // Second findOne: check for duplicate name (should return null since name is different)
      mockPermissionRepo.findOne.mockResolvedValueOnce(null);
      mockQueryRunner.manager.save.mockResolvedValue({
        ...mockPermission,
        ...updateDto,
      });

      // Mock getPermissionById
      mockPermissionRepo.findOne.mockResolvedValueOnce({
        ...mockPermission,
        ...updateDto,
      });
      mockQueryBuilder.getMany.mockResolvedValue([]);

      const result = await service.updatePermission('uuid-permission-123', updateDto);

      expect(result).toBeDefined();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException if permission not found', async () => {
      mockPermissionRepo.findOne.mockResolvedValue(null);

      await expect(service.updatePermission('non-existent', updateDto)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw BadRequestException for duplicate name on update', async () => {
      // First findOne: get the permission
      mockPermissionRepo.findOne.mockResolvedValueOnce(mockPermission);
      // Second findOne: check for duplicate name - should find an existing permission
      mockPermissionRepo.findOne.mockResolvedValueOnce({
        ...mockPermission,
        id: 'different-uuid',
        name: 'duplicate-name',
      });

      // Using a different name than the current permission name to trigger duplicate check
      const dtoWithDuplicateName: UpdatePermissionDto = { name: 'duplicate-name' };

      await expect(
        service.updatePermission('uuid-permission-123', dtoWithDuplicateName)
      ).rejects.toThrow(BadRequestException);
    });

    it('should update policy associations when policyIds provided', async () => {
      const updateWithPolicies: UpdatePermissionDto = {
        policyIds: ['uuid-policy-1', 'uuid-policy-2'],
      };

      mockPermissionRepo.findOne.mockResolvedValueOnce(mockPermission);
      mockQueryRunner.manager.save.mockResolvedValue(mockPermission);

      const mockPolicyPermRepo = {
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
        create: jest.fn().mockReturnValue(mockPolicyPermission),
        save: jest.fn().mockResolvedValue(mockPolicyPermission),
      };
      mockQueryRunner.manager.getRepository.mockReturnValue(mockPolicyPermRepo);

      // Mock getPermissionById
      mockPermissionRepo.findOne.mockResolvedValueOnce(mockPermission);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.updatePermission('uuid-permission-123', updateWithPolicies);

      expect(mockPolicyPermRepo.delete).toHaveBeenCalledWith({
        permissionId: 'uuid-permission-123',
      });
    });

    it('should not update policy associations when policyIds not provided', async () => {
      // First findOne: get the permission
      mockPermissionRepo.findOne.mockResolvedValueOnce(mockPermission);
      // Second findOne: check for duplicate name (should return null)
      mockPermissionRepo.findOne.mockResolvedValueOnce(null);
      mockQueryRunner.manager.save.mockResolvedValue(mockPermission);

      // Mock getPermissionById
      mockPermissionRepo.findOne.mockResolvedValueOnce(mockPermission);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.updatePermission('uuid-permission-123', updateDto);

      expect(mockQueryRunner.manager.getRepository).not.toHaveBeenCalled();
    });

    it('should rollback transaction on error during update', async () => {
      // First findOne: get the permission
      mockPermissionRepo.findOne.mockResolvedValueOnce(mockPermission);
      // Second findOne: check for duplicate name (should return null)
      mockPermissionRepo.findOne.mockResolvedValueOnce(null);
      mockQueryRunner.manager.save.mockRejectedValue(new Error('Update failed'));

      await expect(service.updatePermission('uuid-permission-123', updateDto)).rejects.toThrow(
        'Update failed'
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
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
