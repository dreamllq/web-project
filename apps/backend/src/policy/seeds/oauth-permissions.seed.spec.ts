import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { mock, describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Permission } from '../../entities/permission.entity';
import { OAuthPermissionsSeed, PermissionDefinition } from './oauth-permissions.seed';

interface MockFindOneOptions {
  where: {
    name: string;
  };
}

describe('OAuthPermissionsSeed', () => {
  let seed: OAuthPermissionsSeed;
  let mockRepository: {
    findOne: ReturnType<typeof mock>;
    create: ReturnType<typeof mock>;
    save: ReturnType<typeof mock>;
    find: ReturnType<typeof mock>;
  };

  const expectedPermissions = [
    // oauth-provider permissions
    {
      name: 'oauth-provider:read',
      resource: 'oauth-provider',
      action: 'read',
      description: '查看 OAuth 提供商',
    },
    {
      name: 'oauth-provider:create',
      resource: 'oauth-provider',
      action: 'create',
      description: '创建 OAuth 提供商',
    },
    {
      name: 'oauth-provider:update',
      resource: 'oauth-provider',
      action: 'update',
      description: '更新 OAuth 提供商',
    },
    {
      name: 'oauth-provider:delete',
      resource: 'oauth-provider',
      action: 'delete',
      description: '删除 OAuth 提供商',
    },
    // oauth-client permissions
    {
      name: 'oauth-client:read',
      resource: 'oauth-client',
      action: 'read',
      description: '查看 OAuth 客户端',
    },
    {
      name: 'oauth-client:create',
      resource: 'oauth-client',
      action: 'create',
      description: '创建 OAuth 客户端',
    },
    {
      name: 'oauth-client:update',
      resource: 'oauth-client',
      action: 'update',
      description: '更新 OAuth 客户端',
    },
    {
      name: 'oauth-client:delete',
      resource: 'oauth-client',
      action: 'delete',
      description: '删除 OAuth 客户端',
    },
    {
      name: 'oauth-client:regenerate_secret',
      resource: 'oauth-client',
      action: 'regenerate_secret',
      description: '重新生成 OAuth 客户端密钥',
    },
    // oauth-token permissions
    {
      name: 'oauth-token:read',
      resource: 'oauth-token',
      action: 'read',
      description: '查看 OAuth 令牌',
    },
    {
      name: 'oauth-token:delete',
      resource: 'oauth-token',
      action: 'delete',
      description: '撤销 OAuth 令牌',
    },
    // social-account permissions
    {
      name: 'social-account:read',
      resource: 'social-account',
      action: 'read',
      description: '查看社交账号',
    },
    {
      name: 'social-account:delete',
      resource: 'social-account',
      action: 'delete',
      description: '解绑社交账号',
    },
  ];

  beforeEach(async () => {
    mockRepository = {
      findOne: mock(),
      create: mock(),
      save: mock(),
      find: mock(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthPermissionsSeed,
        {
          provide: getRepositoryToken(Permission),
          useValue: mockRepository,
        },
      ],
    }).compile();

    seed = module.get<OAuthPermissionsSeed>(OAuthPermissionsSeed);
  });

  afterEach(() => {
    mockRepository.findOne.mockClear();
    mockRepository.create.mockClear();
    mockRepository.save.mockClear();
    mockRepository.find.mockClear();
  });

  describe('seed()', () => {
    it('应该插入所有 OAuth 权限点（首次运行）', async () => {
      // Mock: 所有权限都不存在
      mockRepository.findOne.mockResolvedValue(null);

      mockRepository.create.mockImplementation((data: PermissionDefinition) => data);

      mockRepository.save.mockImplementation(async (permission: PermissionDefinition) => ({
        id: 'uuid-' + permission.name,
        ...permission,
      }));

      const result = await seed.seed();

      // 验证：应该尝试查询每个权限
      expect(mockRepository.findOne).toHaveBeenCalledTimes(expectedPermissions.length);

      // 验证：应该创建并保存每个权限
      expect(mockRepository.create).toHaveBeenCalledTimes(expectedPermissions.length);
      expect(mockRepository.save).toHaveBeenCalledTimes(expectedPermissions.length);

      // 验证：返回插入的权限数量
      expect(result.inserted).toBe(expectedPermissions.length);
      expect(result.skipped).toBe(0);
    });

    it('应该跳过已存在的权限（幂等性）', async () => {
      mockRepository.findOne.mockImplementation(async (options: MockFindOneOptions) => {
        const name = options.where.name;
        return { id: 'existing-' + name, name };
      });

      const result = await seed.seed();

      expect(mockRepository.findOne).toHaveBeenCalledTimes(expectedPermissions.length);
      expect(mockRepository.create).not.toHaveBeenCalled();
      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(result.inserted).toBe(0);
      expect(result.skipped).toBe(expectedPermissions.length);
    });

    it('应该部分插入、部分跳过（混合场景）', async () => {
      mockRepository.findOne.mockImplementation(async (options: MockFindOneOptions) => {
        const name = options.where.name;
        const index = expectedPermissions.findIndex((p: PermissionDefinition) => p.name === name);
        if (index < expectedPermissions.length / 2) {
          return null;
        }
        return { id: 'existing-' + name, name };
      });

      mockRepository.create.mockImplementation((data: PermissionDefinition) => data);
      mockRepository.save.mockImplementation(async (permission: PermissionDefinition) => ({
        id: 'uuid-' + permission.name,
        ...permission,
      }));

      const result = await seed.seed();

      const expectedInserted = Math.ceil(expectedPermissions.length / 2);
      expect(result.inserted).toBe(expectedInserted);
      expect(result.skipped).toBe(expectedPermissions.length - expectedInserted);
    });

    it('权限格式应该正确（resource:action）', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockImplementation((data: PermissionDefinition) => data);
      mockRepository.save.mockImplementation(async (permission: PermissionDefinition) => ({
        id: 'uuid-' + permission.name,
        ...permission,
      }));

      await seed.seed();

      const createCalls = mockRepository.create.mock.calls;
      createCalls.forEach((call: PermissionDefinition[]) => {
        const permission = call[0];
        expect(permission.name).toBe(`${permission.resource}:${permission.action}`);
        expect(permission.name).toMatch(/^[a-z-]+:[a-z_]+$/);
      });
    });

    it('应该定义所有预期的权限', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockImplementation((data: PermissionDefinition) => data);
      mockRepository.save.mockImplementation(async (permission: PermissionDefinition) => ({
        id: 'uuid-' + permission.name,
        ...permission,
      }));

      await seed.seed();

      const createdPermissions = mockRepository.create.mock.calls.map(
        (call: PermissionDefinition[]) => call[0]
      );

      expectedPermissions.forEach((expected: PermissionDefinition) => {
        const found = createdPermissions.find(
          (p: PermissionDefinition) => p.name === expected.name
        );
        expect(found).toBeDefined();
        expect(found!.resource).toBe(expected.resource);
        expect(found!.action).toBe(expected.action);
        expect(found!.description).toBe(expected.description);
      });
    });
  });

  describe('getDefinedPermissions()', () => {
    it('应该返回所有定义的权限（不执行插入）', () => {
      const permissions = seed.getDefinedPermissions();

      // 验证：返回的权限列表与预期一致
      expect(permissions).toHaveLength(expectedPermissions.length);
      expect(permissions).toEqual(expectedPermissions);
    });
  });
});
