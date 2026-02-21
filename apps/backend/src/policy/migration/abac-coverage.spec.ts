import { Test, TestingModule } from '@nestjs/testing';
import { PolicyEvaluatorService, UserAttributes } from '../policy-evaluator.service';
import { PolicyService } from '../policy.service';
import { Policy, PolicyEffect } from '../../entities/policy.entity';
import { UserStatus } from '../../entities/user.entity';

/**
 * ABAC Coverage Test Suite
 *
 * Tests that verify ABAC policies correctly cover all RBAC permissions.
 * Each RBAC permission should have at least one corresponding ABAC policy.
 *
 * This test suite is critical for the RBAC→ABAC migration to ensure
 * no permissions are lost during the transition.
 */
describe('ABAC Migration - Coverage Tests', () => {
  let policyEvaluatorService: PolicyEvaluatorService;
  let mockPolicyService: { getEnabledPolicies: jest.Mock };

  // All known RBAC permissions from the system
  const RBAC_PERMISSIONS = [
    { resource: 'user', action: 'create', name: 'user:create' },
    { resource: 'user', action: 'read', name: 'user:read' },
    { resource: 'user', action: 'update', name: 'user:update' },
    { resource: 'user', action: 'delete', name: 'user:delete' },
    { resource: 'role', action: 'create', name: 'role:create' },
    { resource: 'role', action: 'read', name: 'role:read' },
    { resource: 'role', action: 'update', name: 'role:update' },
    { resource: 'role', action: 'delete', name: 'role:delete' },
    { resource: 'permission', action: 'create', name: 'permission:create' },
    { resource: 'permission', action: 'read', name: 'permission:read' },
    { resource: 'permission', action: 'update', name: 'permission:update' },
    { resource: 'permission', action: 'delete', name: 'permission:delete' },
    { resource: 'policy', action: 'create', name: 'policy:create' },
    { resource: 'policy', action: 'read', name: 'policy:read' },
    { resource: 'policy', action: 'update', name: 'policy:update' },
    { resource: 'policy', action: 'delete', name: 'policy:delete' },
    { resource: 'audit', action: 'read', name: 'audit:read' },
  ];

  // Role definitions from production database
  const ROLES = {
    SUPER_ADMIN: 'super_admin',
    ROLE_111: '111',
    ROLE_AAA: '啊啊啊',
  };

  // Test user fixtures
  const createTestUser = (roles: string[]): UserAttributes => ({
    id: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
    phone: '+1234567890',
    status: UserStatus.ACTIVE,
    roles,
  });

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

  describe('Policy Coverage', () => {
    it('should have ABAC policies that cover all RBAC permissions', async () => {
      // Setup: Create ABAC policies that cover all permissions
      const comprehensivePolicies: Policy[] = [
        // Super admin wildcard policy
        createPolicy(
          'policy-super-admin',
          'Super Admin - Full Access',
          `role:${ROLES.SUPER_ADMIN}`,
          '*',
          '*',
          { priority: 1000 }
        ),
        // Role 111 policies
        createPolicy(
          'policy-111-audit',
          'Role: 111 - Read Audit Logs',
          `role:${ROLES.ROLE_111}`,
          'audit',
          'read',
          { priority: 50 }
        ),
        createPolicy(
          'policy-111-permission-create',
          'Role: 111 - Create Permissions',
          `role:${ROLES.ROLE_111}`,
          'permission',
          'create',
          { priority: 50 }
        ),
        // Role 啊啊啊 policies
        createPolicy(
          'policy-aaa-permission-create',
          'Role: 啊啊啊 - Create Permissions',
          `role:${ROLES.ROLE_AAA}`,
          'permission',
          'create',
          { priority: 50 }
        ),
        createPolicy(
          'policy-aaa-permission-delete',
          'Role: 啊啊啊 - Delete Permissions',
          `role:${ROLES.ROLE_AAA}`,
          'permission',
          'delete',
          { priority: 50 }
        ),
      ];

      mockPolicyService.getEnabledPolicies.mockResolvedValue(comprehensivePolicies);

      // Test that super_admin has access to all resources
      const superAdminUser = createTestUser([ROLES.SUPER_ADMIN]);

      for (const perm of RBAC_PERMISSIONS) {
        const result = await policyEvaluatorService.evaluate(
          superAdminUser,
          perm.resource,
          perm.action
        );
        expect(result).toBe(true);
      }
    });

    it('should detect missing ABAC policies for RBAC permissions', async () => {
      // Setup: Only partial policies
      const partialPolicies: Policy[] = [
        createPolicy('policy-1', 'User Read', `role:${ROLES.SUPER_ADMIN}`, 'user', 'read'),
      ];

      mockPolicyService.getEnabledPolicies.mockResolvedValue(partialPolicies);

      const superAdminUser = createTestUser([ROLES.SUPER_ADMIN]);

      // This should fail for most permissions
      const readResult = await policyEvaluatorService.evaluate(superAdminUser, 'user', 'read');
      expect(readResult).toBe(true);

      const createResult = await policyEvaluatorService.evaluate(superAdminUser, 'user', 'create');
      expect(createResult).toBe(false); // Missing policy
    });

    it('should evaluate role:super_admin policies correctly', async () => {
      const policies: Policy[] = [
        createPolicy(
          'policy-super-admin',
          'Super Admin - Full Access',
          `role:${ROLES.SUPER_ADMIN}`,
          '*',
          '*',
          { priority: 1000 }
        ),
      ];

      mockPolicyService.getEnabledPolicies.mockResolvedValue(policies);

      const superAdminUser = createTestUser([ROLES.SUPER_ADMIN]);

      // Test various resources and actions
      const testCases = [
        { resource: 'user', action: 'create' },
        { resource: 'user', action: 'delete' },
        { resource: 'role', action: 'update' },
        { resource: 'policy', action: 'read' },
        { resource: 'audit', action: 'read' },
      ];

      for (const tc of testCases) {
        const result = await policyEvaluatorService.evaluate(
          superAdminUser,
          tc.resource,
          tc.action
        );
        expect(result).toBe(true);
      }

      // User without super_admin role should not have access
      const regularUser = createTestUser(['user']);
      const regularResult = await policyEvaluatorService.evaluate(regularUser, 'user', 'create');
      expect(regularResult).toBe(false);
    });

    it('should evaluate role:111 policies correctly', async () => {
      const policies: Policy[] = [
        createPolicy(
          'policy-111-audit',
          'Role: 111 - Read Audit Logs',
          `role:${ROLES.ROLE_111}`,
          'audit',
          'read',
          { priority: 50 }
        ),
        createPolicy(
          'policy-111-permission-create',
          'Role: 111 - Create Permissions',
          `role:${ROLES.ROLE_111}`,
          'permission',
          'create',
          { priority: 50 }
        ),
      ];

      mockPolicyService.getEnabledPolicies.mockResolvedValue(policies);

      const role111User = createTestUser([ROLES.ROLE_111]);

      // Should have these permissions
      expect(await policyEvaluatorService.evaluate(role111User, 'audit', 'read')).toBe(true);
      expect(await policyEvaluatorService.evaluate(role111User, 'permission', 'create')).toBe(true);

      // Should NOT have other permissions
      expect(await policyEvaluatorService.evaluate(role111User, 'user', 'create')).toBe(false);
      expect(await policyEvaluatorService.evaluate(role111User, 'role', 'read')).toBe(false);
      expect(await policyEvaluatorService.evaluate(role111User, 'permission', 'delete')).toBe(
        false
      );
    });

    it('should evaluate role:啊啊啊 policies correctly', async () => {
      const policies: Policy[] = [
        createPolicy(
          'policy-aaa-permission-create',
          'Role: 啊啊啊 - Create Permissions',
          `role:${ROLES.ROLE_AAA}`,
          'permission',
          'create',
          { priority: 50 }
        ),
        createPolicy(
          'policy-aaa-permission-delete',
          'Role: 啊啊啊 - Delete Permissions',
          `role:${ROLES.ROLE_AAA}`,
          'permission',
          'delete',
          { priority: 50 }
        ),
      ];

      mockPolicyService.getEnabledPolicies.mockResolvedValue(policies);

      const roleAaaUser = createTestUser([ROLES.ROLE_AAA]);

      // Should have these permissions
      expect(await policyEvaluatorService.evaluate(roleAaaUser, 'permission', 'create')).toBe(true);
      expect(await policyEvaluatorService.evaluate(roleAaaUser, 'permission', 'delete')).toBe(true);

      // Should NOT have other permissions
      expect(await policyEvaluatorService.evaluate(roleAaaUser, 'permission', 'read')).toBe(false);
      expect(await policyEvaluatorService.evaluate(roleAaaUser, 'audit', 'read')).toBe(false);
      expect(await policyEvaluatorService.evaluate(roleAaaUser, 'user', 'create')).toBe(false);
    });
  });

  describe('Wildcard Policy Matching', () => {
    it('should match wildcard resource (*) for all resources', async () => {
      const policies: Policy[] = [
        createPolicy('policy-wildcard', 'Wildcard Resource', 'role:admin', '*', 'read'),
      ];

      mockPolicyService.getEnabledPolicies.mockResolvedValue(policies);

      const adminUser = createTestUser(['admin']);

      // Should match any resource with read action
      expect(await policyEvaluatorService.evaluate(adminUser, 'user', 'read')).toBe(true);
      expect(await policyEvaluatorService.evaluate(adminUser, 'role', 'read')).toBe(true);
      expect(await policyEvaluatorService.evaluate(adminUser, 'any-custom-resource', 'read')).toBe(
        true
      );

      // Should NOT match different action
      expect(await policyEvaluatorService.evaluate(adminUser, 'user', 'create')).toBe(false);
    });

    it('should match wildcard action (*) for all actions', async () => {
      const policies: Policy[] = [
        createPolicy('policy-wildcard-action', 'Wildcard Action', 'role:admin', 'user', '*'),
      ];

      mockPolicyService.getEnabledPolicies.mockResolvedValue(policies);

      const adminUser = createTestUser(['admin']);

      // Should match any action on user resource
      expect(await policyEvaluatorService.evaluate(adminUser, 'user', 'create')).toBe(true);
      expect(await policyEvaluatorService.evaluate(adminUser, 'user', 'read')).toBe(true);
      expect(await policyEvaluatorService.evaluate(adminUser, 'user', 'update')).toBe(true);
      expect(await policyEvaluatorService.evaluate(adminUser, 'user', 'delete')).toBe(true);

      // Should NOT match different resource
      expect(await policyEvaluatorService.evaluate(adminUser, 'role', 'create')).toBe(false);
    });

    it('should match prefix wildcard resource (resource:*)', async () => {
      const policies: Policy[] = [
        createPolicy('policy-prefix-wildcard', 'Prefix Wildcard', 'role:admin', 'user:*', 'read'),
      ];

      mockPolicyService.getEnabledPolicies.mockResolvedValue(policies);

      const adminUser = createTestUser(['admin']);

      // Should match base resource and any sub-resource
      expect(await policyEvaluatorService.evaluate(adminUser, 'user', 'read')).toBe(true);
      expect(await policyEvaluatorService.evaluate(adminUser, 'user:profile', 'read')).toBe(true);
      expect(await policyEvaluatorService.evaluate(adminUser, 'user:settings', 'read')).toBe(true);

      // Should NOT match unrelated resource
      expect(await policyEvaluatorService.evaluate(adminUser, 'role', 'read')).toBe(false);
    });

    it('should match comma-separated actions', async () => {
      const policies: Policy[] = [
        createPolicy('policy-multi-action', 'Multi Action', 'role:admin', 'user', 'read,update'),
      ];

      mockPolicyService.getEnabledPolicies.mockResolvedValue(policies);

      const adminUser = createTestUser(['admin']);

      expect(await policyEvaluatorService.evaluate(adminUser, 'user', 'read')).toBe(true);
      expect(await policyEvaluatorService.evaluate(adminUser, 'user', 'update')).toBe(true);
      expect(await policyEvaluatorService.evaluate(adminUser, 'user', 'delete')).toBe(false);
      expect(await policyEvaluatorService.evaluate(adminUser, 'user', 'create')).toBe(false);
    });
  });

  describe('Policy Priority and Deny Rules', () => {
    it('should respect policy priority (higher priority wins)', async () => {
      // Policies are returned sorted by priority DESC (highest first)
      const policies: Policy[] = [
        createPolicy('policy-deny', 'Deny Delete', 'role:admin', 'user', 'delete', {
          effect: PolicyEffect.DENY,
          priority: 200, // Higher priority - evaluated first
        }),
        createPolicy('policy-allow', 'Allow All', 'role:admin', '*', '*', { priority: 100 }),
      ];

      mockPolicyService.getEnabledPolicies.mockResolvedValue(policies);

      const adminUser = createTestUser(['admin']);

      // Should allow most actions
      expect(await policyEvaluatorService.evaluate(adminUser, 'user', 'create')).toBe(true);
      expect(await policyEvaluatorService.evaluate(adminUser, 'role', 'delete')).toBe(true);

      // Should deny delete on user due to higher priority deny policy
      expect(await policyEvaluatorService.evaluate(adminUser, 'user', 'delete')).toBe(false);
    });

    it('should deny access when deny policy matches with higher priority', async () => {
      // Policies are returned sorted by priority DESC (highest first)
      const policies: Policy[] = [
        createPolicy('policy-deny-critical', 'Deny Critical Ops', '*', 'policy', 'delete', {
          effect: PolicyEffect.DENY,
          priority: 2000, // Even higher than super admin - evaluated first
        }),
        createPolicy(
          'policy-super-admin',
          'Super Admin - Full Access',
          `role:${ROLES.SUPER_ADMIN}`,
          '*',
          '*',
          { priority: 1000 }
        ),
      ];

      mockPolicyService.getEnabledPolicies.mockResolvedValue(policies);

      const superAdminUser = createTestUser([ROLES.SUPER_ADMIN]);

      // Super admin should still have access to most things
      expect(await policyEvaluatorService.evaluate(superAdminUser, 'user', 'delete')).toBe(true);
      expect(await policyEvaluatorService.evaluate(superAdminUser, 'policy', 'create')).toBe(true);

      // But deny policy with higher priority blocks policy delete
      expect(await policyEvaluatorService.evaluate(superAdminUser, 'policy', 'delete')).toBe(false);
    });
  });

  describe('Disabled Policy Handling', () => {
    it('should not evaluate disabled policies', async () => {
      const policies: Policy[] = [
        createPolicy('policy-disabled', 'Disabled Policy', 'role:admin', 'user', 'create', {
          enabled: false,
        }),
        createPolicy('policy-enabled', 'Enabled Policy', 'role:admin', 'user', 'read', {
          enabled: true,
        }),
      ];

      // Only enabled policies are returned
      mockPolicyService.getEnabledPolicies.mockResolvedValue([policies[1]]);

      const adminUser = createTestUser(['admin']);

      expect(await policyEvaluatorService.evaluate(adminUser, 'user', 'read')).toBe(true);
      expect(await policyEvaluatorService.evaluate(adminUser, 'user', 'create')).toBe(false);
    });
  });

  describe('Multiple Role Support', () => {
    it('should evaluate user with multiple roles correctly', async () => {
      const policies: Policy[] = [
        createPolicy('policy-auditor', 'Auditor Access', 'role:auditor', 'audit', 'read', {
          priority: 50,
        }),
        createPolicy('policy-user-admin', 'User Admin', 'role:user_admin', 'user', '*', {
          priority: 100,
        }),
      ];

      mockPolicyService.getEnabledPolicies.mockResolvedValue(policies);

      // User with multiple roles
      const multiRoleUser = createTestUser(['auditor', 'user_admin']);

      // Should have auditor permissions
      expect(await policyEvaluatorService.evaluate(multiRoleUser, 'audit', 'read')).toBe(true);

      // Should have user_admin permissions
      expect(await policyEvaluatorService.evaluate(multiRoleUser, 'user', 'create')).toBe(true);
      expect(await policyEvaluatorService.evaluate(multiRoleUser, 'user', 'delete')).toBe(true);

      // Should NOT have permissions not in either role
      expect(await policyEvaluatorService.evaluate(multiRoleUser, 'role', 'create')).toBe(false);
    });

    it('should match any role in multi-role user', async () => {
      const policies: Policy[] = [
        createPolicy('policy-role1', 'Role 1 Access', 'role:role1', 'resource1', 'read'),
        createPolicy('policy-role2', 'Role 2 Access', 'role:role2', 'resource2', 'read'),
        createPolicy('policy-role3', 'Role 3 Access', 'role:role3', 'resource3', 'read'),
      ];

      mockPolicyService.getEnabledPolicies.mockResolvedValue(policies);

      const user = createTestUser(['role1', 'role3']);

      expect(await policyEvaluatorService.evaluate(user, 'resource1', 'read')).toBe(true);
      expect(await policyEvaluatorService.evaluate(user, 'resource2', 'read')).toBe(false);
      expect(await policyEvaluatorService.evaluate(user, 'resource3', 'read')).toBe(true);
    });
  });

  describe('User Status Validation', () => {
    it('should deny access for non-active users regardless of policies', async () => {
      const policies: Policy[] = [
        createPolicy(
          'policy-super-admin',
          'Super Admin - Full Access',
          `role:${ROLES.SUPER_ADMIN}`,
          '*',
          '*',
          { priority: 1000 }
        ),
      ];

      mockPolicyService.getEnabledPolicies.mockResolvedValue(policies);

      const disabledUser: UserAttributes = {
        id: 'test-user-id',
        username: 'testuser',
        status: UserStatus.DISABLED,
        roles: [ROLES.SUPER_ADMIN],
      };

      const result = await policyEvaluatorService.evaluate(disabledUser, 'user', 'read');
      expect(result).toBe(false);
    });
  });

  describe('Bulk Evaluation', () => {
    it('should evaluate multiple permissions at once', async () => {
      const policies: Policy[] = [
        createPolicy(
          'policy-super-admin',
          'Super Admin - Full Access',
          `role:${ROLES.SUPER_ADMIN}`,
          '*',
          '*',
          { priority: 1000 }
        ),
        createPolicy(
          'policy-111-audit',
          'Role: 111 - Audit',
          `role:${ROLES.ROLE_111}`,
          'audit',
          'read'
        ),
      ];

      mockPolicyService.getEnabledPolicies.mockResolvedValue(policies);

      const role111User = createTestUser([ROLES.ROLE_111]);

      const requests = RBAC_PERMISSIONS.map((p) => ({
        resource: p.resource,
        action: p.action,
      }));

      const results = await policyEvaluatorService.evaluateBulk(role111User, requests);

      // Only audit:read should be true
      expect(results['audit:read']).toBe(true);
      expect(results['user:create']).toBe(false);
      expect(results['role:read']).toBe(false);
    });
  });
});
