import { NotFoundException } from '@nestjs/common';
import { AbacService } from './abac.service';
import { Permission } from '../entities/permission.entity';
import { Policy, PolicyEffect } from '../entities/policy.entity';
import { Role } from '../entities/role.entity';
import { User, UserStatus } from '../entities/user.entity';

describe('AbacService', () => {
  let service: AbacService;
  let mockPermissionRepo: { find: jest.Mock };
  let mockPolicyRepo: { find: jest.Mock };
  let mockRoleRepo: { find: jest.Mock };
  let mockUserRepo: { find: jest.Mock; findOne: jest.Mock };
  let mockPolicyEvaluator: { evaluateWithDetails: jest.Mock };

  const mockPermissions: Permission[] = [
    { id: '1', name: 'user:read', resource: 'user', action: 'read', description: 'Read users' },
    {
      id: '2',
      name: 'user:create',
      resource: 'user',
      action: 'create',
      description: 'Create users',
    },
    { id: '3', name: 'file:read', resource: 'file', action: 'read', description: 'Read files' },
  ];

  const mockPolicies: Policy[] = [
    {
      id: 'p1',
      name: 'Admin Full Access',
      description: 'Admin has full access',
      effect: PolicyEffect.ALLOW,
      subject: 'role:admin',
      resource: '*',
      action: '*',
      conditions: null,
      priority: 100,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      policyAttributes: [],
    },
    {
      id: 'p2',
      name: 'User Read Access',
      description: 'Users can read',
      subject: 'role:user',
      resource: 'user',
      action: 'read',
      effect: PolicyEffect.ALLOW,
      conditions: null,
      priority: 50,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      policyAttributes: [],
    },
    {
      id: 'p3',
      name: 'Disabled Policy',
      description: 'This is disabled',
      subject: 'role:guest',
      resource: 'file',
      action: 'read',
      effect: PolicyEffect.ALLOW,
      conditions: null,
      priority: 10,
      enabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      policyAttributes: [],
    },
  ];

  const mockRoles: Role[] = [
    {
      id: 'r1',
      name: 'admin',
      description: 'Administrator',
      isSuperAdmin: true,
      permissions: mockPermissions,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'r2',
      name: 'user',
      description: 'Regular user',
      isSuperAdmin: false,
      permissions: [mockPermissions[0]],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    mockPermissionRepo = { find: jest.fn() };
    mockPolicyRepo = { find: jest.fn() };
    mockRoleRepo = { find: jest.fn() };
    mockUserRepo = { find: jest.fn(), findOne: jest.fn() };
    mockPolicyEvaluator = { evaluateWithDetails: jest.fn() };

    // Create service instance directly with mocked repositories
    service = new AbacService(
      mockPermissionRepo as any,
      mockPolicyRepo as any,
      mockRoleRepo as any,
      mockUserRepo as any,
      mockPolicyEvaluator as any
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCoverage', () => {
    it('should return correct coverage when all permissions are covered', async () => {
      mockPermissionRepo.find.mockResolvedValue(mockPermissions);
      mockPolicyRepo.find.mockResolvedValue(mockPolicies);
      mockRoleRepo.find.mockResolvedValue(mockRoles);

      const result = await service.getCoverage();

      expect(result.rbac_count).toBe(3);
      expect(result.abac_count).toBe(3);
      expect(result.enabled_abac_count).toBe(2);
      // Admin wildcard policy covers all, so coverage should be 100
      expect(result.coverage_percent).toBe(100);
      expect(result.missing_policies).toHaveLength(0);
      expect(result.role_coverage).toHaveLength(2);
    });

    it('should identify missing policies correctly', async () => {
      // Create policies that don't cover everything
      const partialPolicies: Policy[] = [
        {
          ...mockPolicies[1], // Only covers user:read
        },
      ];

      mockPermissionRepo.find.mockResolvedValue(mockPermissions);
      mockPolicyRepo.find.mockResolvedValue(partialPolicies);
      mockRoleRepo.find.mockResolvedValue(mockRoles);

      const result = await service.getCoverage();

      expect(result.rbac_count).toBe(3);
      expect(result.enabled_abac_count).toBe(1);
      // Only user:read is covered
      expect(result.coverage_percent).toBe(33.3);
      expect(result.missing_policies).toHaveLength(2);
      expect(result.missing_policies.map((m) => m.permission_name)).toContain('user:create');
      expect(result.missing_policies.map((m) => m.permission_name)).toContain('file:read');
    });

    it('should handle empty permissions', async () => {
      mockPermissionRepo.find.mockResolvedValue([]);
      mockPolicyRepo.find.mockResolvedValue(mockPolicies);
      mockRoleRepo.find.mockResolvedValue([]);

      const result = await service.getCoverage();

      expect(result.rbac_count).toBe(0);
      expect(result.coverage_percent).toBe(0);
      expect(result.missing_policies).toHaveLength(0);
      expect(result.role_coverage).toHaveLength(0);
    });

    it('should calculate role coverage correctly', async () => {
      mockPermissionRepo.find.mockResolvedValue(mockPermissions);
      mockPolicyRepo.find.mockResolvedValue(mockPolicies);
      mockRoleRepo.find.mockResolvedValue(mockRoles);

      const result = await service.getCoverage();

      expect(result.role_coverage).toHaveLength(2);

      const adminRole = result.role_coverage.find((r) => r.role === 'admin');
      expect(adminRole).toBeDefined();
      expect(adminRole?.permissions).toBe(3);

      const userRole = result.role_coverage.find((r) => r.role === 'user');
      expect(userRole).toBeDefined();
      expect(userRole?.permissions).toBe(1);
    });

    it('should match policy resource patterns correctly', async () => {
      const patternPolicies: Policy[] = [
        {
          id: 'p1',
          name: 'File Access',
          description: '',
          effect: PolicyEffect.ALLOW,
          subject: 'role:user',
          resource: 'file:*', // Wildcard resource pattern
          action: 'read',
          conditions: null,
          priority: 50,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          policyAttributes: [],
        },
      ];

      const filePermissions: Permission[] = [
        { id: '1', name: 'file:read', resource: 'file', action: 'read', description: '' },
        { id: '2', name: 'document:read', resource: 'document', action: 'read', description: '' },
      ];

      mockPermissionRepo.find.mockResolvedValue(filePermissions);
      mockPolicyRepo.find.mockResolvedValue(patternPolicies);
      mockRoleRepo.find.mockResolvedValue([]);

      const result = await service.getCoverage();

      // file:* should match file resource
      expect(result.missing_policies.map((m) => m.resource)).not.toContain('file');
      // file:* should NOT match document resource
      expect(result.missing_policies.map((m) => m.resource)).toContain('document');
    });

    it('should match policy action patterns correctly', async () => {
      const patternPolicies: Policy[] = [
        {
          id: 'p1',
          name: 'All Actions',
          description: '',
          effect: PolicyEffect.ALLOW,
          subject: 'role:user',
          resource: 'user',
          action: 'read,write', // Comma-separated actions
          conditions: null,
          priority: 50,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          policyAttributes: [],
        },
      ];

      const userPermissions: Permission[] = [
        { id: '1', name: 'user:read', resource: 'user', action: 'read', description: '' },
        { id: '2', name: 'user:write', resource: 'user', action: 'write', description: '' },
        { id: '3', name: 'user:delete', resource: 'user', action: 'delete', description: '' },
      ];

      mockPermissionRepo.find.mockResolvedValue(userPermissions);
      mockPolicyRepo.find.mockResolvedValue(patternPolicies);
      mockRoleRepo.find.mockResolvedValue([]);

      const result = await service.getCoverage();

      // read and write should be covered
      expect(result.missing_policies).toHaveLength(1);
      expect(result.missing_policies[0].action).toBe('delete');
    });
  });

  describe('testPermission', () => {
    const mockUser: Partial<User> = {
      id: 'user-1',
      username: 'testuser',
      email: 'test@example.com',
      phone: null,
      passwordHash: 'hash',
      status: UserStatus.ACTIVE,
      roles: [
        {
          id: 'role-1',
          name: 'admin',
          description: 'Admin',
          isSuperAdmin: true,
          permissions: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };

    it('should return permission result when user has access', async () => {
      mockUserRepo.findOne.mockResolvedValue(mockUser);
      mockPolicyEvaluator.evaluateWithDetails.mockResolvedValue({
        allowed: true,
        matchedPolicy: {
          id: 'policy-1',
          name: 'Admin Full Access',
          effect: PolicyEffect.ALLOW,
          subject: 'role:admin',
          resource: '*',
          action: '*',
          conditions: null,
          priority: 100,
          enabled: true,
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          policyAttributes: [],
        },
        reason: 'Policy "Admin Full Access" allows * on *',
      });

      const result = await service.testPermission({
        userId: 'user-1',
        resource: 'user',
        action: 'read',
      });

      expect(result.allowed).toBe(true);
      expect(result.user.id).toBe('user-1');
      expect(result.user.username).toBe('testuser');
      expect(result.user.roles).toContain('admin');
      expect(result.resource).toBe('user');
      expect(result.action).toBe('read');
      expect(result.matchedPolicies).toHaveLength(1);
      expect(result.matchedPolicies[0].id).toBe('policy-1');
      expect(result.evaluationTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should return denied result when user has no access', async () => {
      mockUserRepo.findOne.mockResolvedValue(mockUser);
      mockPolicyEvaluator.evaluateWithDetails.mockResolvedValue({
        allowed: false,
        reason: 'No matching policy found',
      });

      const result = await service.testPermission({
        userId: 'user-1',
        resource: 'sensitive',
        action: 'delete',
      });

      expect(result.allowed).toBe(false);
      expect(result.matchedPolicies).toHaveLength(0);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(
        service.testPermission({
          userId: 'non-existent',
          resource: 'user',
          action: 'read',
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('should return user roles in response', async () => {
      const userWithRoles = {
        ...mockUser,
        roles: [
          {
            id: 'role-1',
            name: 'admin',
            description: 'Admin',
            isSuperAdmin: true,
            permissions: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'role-2',
            name: 'user',
            description: 'User',
            isSuperAdmin: false,
            permissions: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };
      mockUserRepo.findOne.mockResolvedValue(userWithRoles);
      mockPolicyEvaluator.evaluateWithDetails.mockResolvedValue({
        allowed: true,
        matchedPolicy: {
          id: 'policy-1',
          name: 'Test',
          effect: PolicyEffect.ALLOW,
          subject: 'role:admin',
          resource: 'user',
          action: 'read',
          conditions: null,
          priority: 50,
          enabled: true,
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          policyAttributes: [],
        },
        reason: 'Test',
      });

      const result = await service.testPermission({
        userId: 'user-1',
        resource: 'user',
        action: 'read',
      });

      expect(result.user.roles).toEqual(['admin', 'user']);
    });
  });
});
