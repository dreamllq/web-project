import { Test, TestingModule } from '@nestjs/testing';
import { PolicyEvaluatorService, UserAttributes } from '../policy-evaluator.service';
import { PolicyService } from '../policy.service';
import { Policy, PolicyEffect } from '../../entities/policy.entity';
import { UserStatus } from '../../entities/user.entity';

/**
 * Permission Consistency Test Suite
 *
 * Tests that verify RBAC and ABAC produce consistent permission results.
 * During migration, both systems should produce the same authorization decisions.
 *
 * These tests ensure:
 * 1. Users with specific roles get the same permissions via RBAC and ABAC
 * 2. Behavior is consistent across both authorization models
 * 3. Migration to ABAC-only mode is safe
 */
describe('ABAC Migration - Permission Consistency Tests', () => {
  let policyEvaluatorService: PolicyEvaluatorService;
  let mockPolicyService: { getEnabledPolicies: jest.Mock };

  // All RBAC permissions mapped to role permissions
  const RBAC_ROLE_PERMISSIONS: Record<string, string[]> = {
    super_admin: [
      'user:create',
      'user:read',
      'user:update',
      'user:delete',
      'role:create',
      'role:read',
      'role:update',
      'role:delete',
      'permission:create',
      'permission:read',
      'permission:update',
      'permission:delete',
      'policy:create',
      'policy:read',
      'policy:update',
      'policy:delete',
      'audit:read',
    ],
    '111': ['audit:read', 'permission:create'],
    啊啊啊: ['permission:create', 'permission:delete'],
  };

  // Convert permission string (e.g., "user:read") to resource/action
  const parsePermission = (perm: string): { resource: string; action: string } => {
    const [resource, action] = perm.split(':');
    return { resource, action };
  };

  // Create test user with roles
  const createTestUser = (roles: string[]): UserAttributes => ({
    id: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
    phone: '+1234567890',
    status: UserStatus.ACTIVE,
    roles,
  });

  // Simulate RBAC permission check
  const checkRbacPermission = (role: string, resource: string, action: string): boolean => {
    const permissions = RBAC_ROLE_PERMISSIONS[role] || [];
    const exactPerm = `${resource}:${action}`;

    // Check for exact match
    if (permissions.includes(exactPerm)) {
      return true;
    }

    // Check for resource wildcard (resource:*)
    if (permissions.includes(`${resource}:*`)) {
      return true;
    }

    // Check for action wildcard (*:action)
    if (permissions.includes(`*:${action}`)) {
      return true;
    }

    // Check for full wildcard (*:*)
    if (permissions.includes('*:*')) {
      return true;
    }

    return false;
  };

  // Helper to create policy objects
  const createPolicy = (
    id: string,
    name: string,
    subject: string,
    resource: string,
    action: string,
    options: {
      effect?: PolicyEffect;
      priority?: number;
      enabled?: boolean;
    } = {}
  ): Policy => ({
    id,
    name,
    description: `Policy for ${name}`,
    effect: options.effect ?? PolicyEffect.ALLOW,
    subject,
    resource,
    action,
    conditions: null,
    priority: options.priority ?? 100,
    enabled: options.enabled ?? true,
    createdAt: new Date(),
    updatedAt: new Date(),
    policyAttributes: [],
  });

  // Create ABAC policies that mirror RBAC permissions
  const createAbacPoliciesForRole = (roleName: string, permissions: string[]): Policy[] => {
    return permissions.map((perm, index) => {
      const { resource, action } = parsePermission(perm);
      return createPolicy(
        `policy-${roleName}-${index}`,
        `Role: ${roleName} - ${perm}`,
        `role:${roleName}`,
        resource,
        action,
        { priority: roleName === 'super_admin' ? 1000 : 50 }
      );
    });
  };

  beforeEach(async () => {
    mockPolicyService = {
      getEnabledPolicies: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PolicyEvaluatorService,
        {
          provide: PolicyService,
          useValue: mockPolicyService,
        },
      ],
    }).compile();

    policyEvaluatorService = module.get<PolicyEvaluatorService>(PolicyEvaluatorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    policyEvaluatorService.invalidateCache();
  });

  describe('Super Admin Consistency', () => {
    it('should produce consistent results for super_admin role', async () => {
      // Setup ABAC policies for super_admin (using wildcard)
      const policies: Policy[] = [
        createPolicy(
          'policy-super-admin',
          'Super Admin - Full Access',
          'role:super_admin',
          '*',
          '*',
          { priority: 1000 }
        ),
      ];

      mockPolicyService.getEnabledPolicies.mockResolvedValue(policies);

      const superAdminUser = createTestUser(['super_admin']);
      const allPermissions = RBAC_ROLE_PERMISSIONS['super_admin'];

      for (const perm of allPermissions) {
        const { resource, action } = parsePermission(perm);

        // RBAC check
        const rbacResult = checkRbacPermission('super_admin', resource, action);

        // ABAC check
        const abacResult = await policyEvaluatorService.evaluate(superAdminUser, resource, action);

        // Should be consistent
        expect(abacResult).toBe(rbacResult);
        expect(abacResult).toBe(true);
      }
    });

    it('should deny super_admin permissions to non-super_admin users', async () => {
      const policies: Policy[] = [
        createPolicy(
          'policy-super-admin',
          'Super Admin - Full Access',
          'role:super_admin',
          '*',
          '*',
          { priority: 1000 }
        ),
      ];

      mockPolicyService.getEnabledPolicies.mockResolvedValue(policies);

      const regularUser = createTestUser(['user']);
      const superAdminPerms = RBAC_ROLE_PERMISSIONS['super_admin'];

      for (const perm of superAdminPerms) {
        const { resource, action } = parsePermission(perm);
        const result = await policyEvaluatorService.evaluate(regularUser, resource, action);
        expect(result).toBe(false);
      }
    });
  });

  describe('Custom Role Consistency', () => {
    it('should produce consistent results for role "111"', async () => {
      const roleName = '111';
      const rolePermissions = RBAC_ROLE_PERMISSIONS[roleName];

      // Setup ABAC policies for role 111
      const policies = createAbacPoliciesForRole(roleName, rolePermissions);
      mockPolicyService.getEnabledPolicies.mockResolvedValue(policies);

      const user = createTestUser([roleName]);

      // Test permissions that the role has
      for (const perm of rolePermissions) {
        const { resource, action } = parsePermission(perm);

        const rbacResult = checkRbacPermission(roleName, resource, action);
        const abacResult = await policyEvaluatorService.evaluate(user, resource, action);

        expect(abacResult).toBe(rbacResult);
        expect(abacResult).toBe(true);
      }
    });

    it('should deny permissions not in role "111"', async () => {
      const roleName = '111';
      const rolePermissions = RBAC_ROLE_PERMISSIONS[roleName];

      const policies = createAbacPoliciesForRole(roleName, rolePermissions);
      mockPolicyService.getEnabledPolicies.mockResolvedValue(policies);

      const user = createTestUser([roleName]);

      // Test permissions that the role does NOT have
      const allPermissions = RBAC_ROLE_PERMISSIONS['super_admin'];
      const deniedPerms = allPermissions.filter((p) => !rolePermissions.includes(p));

      for (const perm of deniedPerms) {
        const { resource, action } = parsePermission(perm);

        const rbacResult = checkRbacPermission(roleName, resource, action);
        const abacResult = await policyEvaluatorService.evaluate(user, resource, action);

        expect(abacResult).toBe(rbacResult);
        expect(abacResult).toBe(false);
      }
    });

    it('should produce consistent results for role "啊啊啊"', async () => {
      const roleName = '啊啊啊';
      const rolePermissions = RBAC_ROLE_PERMISSIONS[roleName];

      const policies = createAbacPoliciesForRole(roleName, rolePermissions);
      mockPolicyService.getEnabledPolicies.mockResolvedValue(policies);

      const user = createTestUser([roleName]);

      // Test permissions that the role has
      for (const perm of rolePermissions) {
        const { resource, action } = parsePermission(perm);

        const rbacResult = checkRbacPermission(roleName, resource, action);
        const abacResult = await policyEvaluatorService.evaluate(user, resource, action);

        expect(abacResult).toBe(rbacResult);
        expect(abacResult).toBe(true);
      }

      // Test permissions that the role does NOT have
      const allPermissions = RBAC_ROLE_PERMISSIONS['super_admin'];
      const deniedPerms = allPermissions.filter((p) => !rolePermissions.includes(p));

      for (const perm of deniedPerms) {
        const { resource, action } = parsePermission(perm);

        const rbacResult = checkRbacPermission(roleName, resource, action);
        const abacResult = await policyEvaluatorService.evaluate(user, resource, action);

        expect(abacResult).toBe(rbacResult);
        expect(abacResult).toBe(false);
      }
    });
  });

  describe('Cross-Role Consistency', () => {
    it('should handle role with no permissions correctly', async () => {
      // No policies for this role
      mockPolicyService.getEnabledPolicies.mockResolvedValue([]);

      const userWithNoPerms = createTestUser(['no_permissions_role']);

      const allPermissions = RBAC_ROLE_PERMISSIONS['super_admin'];

      for (const perm of allPermissions) {
        const { resource, action } = parsePermission(perm);
        const result = await policyEvaluatorService.evaluate(userWithNoPerms, resource, action);
        expect(result).toBe(false);
      }
    });

    it('should handle user with no roles correctly', async () => {
      mockPolicyService.getEnabledPolicies.mockResolvedValue([]);

      const userWithNoRoles = createTestUser([]);

      const result = await policyEvaluatorService.evaluate(userWithNoRoles, 'user', 'read');
      expect(result).toBe(false);
    });
  });

  describe('Full System Consistency Check', () => {
    it('should verify all roles produce consistent results for all permissions', async () => {
      // Setup comprehensive ABAC policies for all roles
      const allPolicies: Policy[] = [
        // Super admin wildcard
        createPolicy(
          'policy-super-admin',
          'Super Admin - Full Access',
          'role:super_admin',
          '*',
          '*',
          { priority: 1000 }
        ),
        // Role 111
        ...createAbacPoliciesForRole('111', RBAC_ROLE_PERMISSIONS['111']),
        // Role 啊啊啊
        ...createAbacPoliciesForRole('啊啊啊', RBAC_ROLE_PERMISSIONS['啊啊啊']),
      ];

      mockPolicyService.getEnabledPolicies.mockResolvedValue(allPolicies);

      const allPermissions = RBAC_ROLE_PERMISSIONS['super_admin'];
      const roles = Object.keys(RBAC_ROLE_PERMISSIONS);

      for (const role of roles) {
        const user = createTestUser([role]);

        for (const perm of allPermissions) {
          const { resource, action } = parsePermission(perm);

          const rbacResult = checkRbacPermission(role, resource, action);
          const abacResult = await policyEvaluatorService.evaluate(user, resource, action);

          // CRITICAL: RBAC and ABAC must produce identical results
          expect({
            role,
            permission: perm,
            rbacResult,
            abacResult,
          }).toEqual({
            role,
            permission: perm,
            rbacResult,
            abacResult: rbacResult, // ABAC must match RBAC
          });
        }
      }
    });
  });

  describe('Behavior Edge Cases', () => {
    it('should handle invalid permission format gracefully', async () => {
      mockPolicyService.getEnabledPolicies.mockResolvedValue([]);

      const user = createTestUser(['test']);

      // These should return false (no matching policy)
      const result1 = await policyEvaluatorService.evaluate(user, '', 'read');
      const result2 = await policyEvaluatorService.evaluate(user, 'user', '');
      const result3 = await policyEvaluatorService.evaluate(user, '', '');

      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(result3).toBe(false);
    });

    it('should handle special characters in role names', async () => {
      const policies: Policy[] = [
        createPolicy('policy-special', 'Special Role', 'role:special-role_123', 'user', 'read'),
      ];

      mockPolicyService.getEnabledPolicies.mockResolvedValue(policies);

      const user = createTestUser(['special-role_123']);
      const result = await policyEvaluatorService.evaluate(user, 'user', 'read');

      expect(result).toBe(true);
    });

    it('should handle unicode role names', async () => {
      const policies: Policy[] = [
        createPolicy('policy-unicode', 'Unicode Role', 'role:测试角色', 'user', 'read'),
      ];

      mockPolicyService.getEnabledPolicies.mockResolvedValue(policies);

      const user = createTestUser(['测试角色']);
      const result = await policyEvaluatorService.evaluate(user, 'user', 'read');

      expect(result).toBe(true);
    });

    it('should handle case sensitivity in role matching', async () => {
      const policies: Policy[] = [
        createPolicy('policy-admin', 'Admin', 'role:Admin', 'user', 'read'),
      ];

      mockPolicyService.getEnabledPolicies.mockResolvedValue(policies);

      // Role names are case-sensitive
      const user1 = createTestUser(['Admin']);
      const user2 = createTestUser(['admin']);

      const result1 = await policyEvaluatorService.evaluate(user1, 'user', 'read');
      const result2 = await policyEvaluatorService.evaluate(user2, 'user', 'read');

      expect(result1).toBe(true);
      expect(result2).toBe(false); // 'admin' != 'Admin'
    });
  });

  describe('Performance and Caching', () => {
    it('should cache policies for bulk evaluation', async () => {
      const policies: Policy[] = [
        createPolicy('policy-test', 'Test Policy', 'role:user', 'resource', 'read'),
      ];

      mockPolicyService.getEnabledPolicies.mockResolvedValue(policies);

      const user = createTestUser(['user']);

      // Multiple evaluations should only fetch policies once
      await policyEvaluatorService.evaluate(user, 'resource', 'read');
      await policyEvaluatorService.evaluate(user, 'resource', 'read');
      await policyEvaluatorService.evaluate(user, 'resource', 'read');

      expect(mockPolicyService.getEnabledPolicies).toHaveBeenCalledTimes(1);
    });

    it('should refetch policies after cache invalidation', async () => {
      const policies: Policy[] = [
        createPolicy('policy-test', 'Test Policy', 'role:user', 'resource', 'read'),
      ];

      mockPolicyService.getEnabledPolicies.mockResolvedValue(policies);

      const user = createTestUser(['user']);

      await policyEvaluatorService.evaluate(user, 'resource', 'read');
      expect(mockPolicyService.getEnabledPolicies).toHaveBeenCalledTimes(1);

      // Invalidate cache
      policyEvaluatorService.invalidateCache();

      await policyEvaluatorService.evaluate(user, 'resource', 'read');
      expect(mockPolicyService.getEnabledPolicies).toHaveBeenCalledTimes(2);
    });
  });

  describe('Evaluation Details', () => {
    it('should provide detailed evaluation results for debugging', async () => {
      const policies: Policy[] = [
        createPolicy('policy-admin', 'Admin Access', 'role:admin', 'user', 'read'),
      ];

      mockPolicyService.getEnabledPolicies.mockResolvedValue(policies);

      const adminUser = createTestUser(['admin']);

      const result = await policyEvaluatorService.evaluateWithDetails(adminUser, 'user', 'read');

      expect(result.allowed).toBe(true);
      expect(result.matchedPolicy).toBeDefined();
      expect(result.matchedPolicy?.name).toBe('Admin Access');
      expect(result.reason).toContain('Admin Access');
    });

    it('should provide reason when access is denied', async () => {
      mockPolicyService.getEnabledPolicies.mockResolvedValue([]);

      const user = createTestUser(['user']);

      const result = await policyEvaluatorService.evaluateWithDetails(user, 'user', 'delete');

      expect(result.allowed).toBe(false);
      expect(result.matchedPolicy).toBeUndefined();
      expect(result.reason).toContain('No matching policy');
    });
  });
});
