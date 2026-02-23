import { Test, TestingModule } from '@nestjs/testing';
import { PolicyEvaluatorService, UserAttributes } from './policy-evaluator.service';
import { PolicyService } from './policy.service';
import { Policy, PolicyEffect } from '../entities/policy.entity';
import { User, UserStatus } from '../entities/user.entity';
import type { PolicySubject, ConditionExpression } from './types/policy.types';

describe('PolicyEvaluatorService', () => {
  let service: PolicyEvaluatorService;

  const mockUser: User = {
    id: 'user-uuid-123',
    username: 'testuser',
    email: 'test@example.com',
    phone: '+1234567890',
    passwordHash: 'hashed',
    nickname: 'Test User',
    avatarUrl: null,
    status: UserStatus.ACTIVE,
    locale: 'en-US',
    lastLoginAt: null,
    lastLoginIp: null,
    emailVerifiedAt: null,
    phoneVerifiedAt: null,
    mfaEnabled: false,
    mfaSecret: null,
    recoveryCodes: null,
    isSuperuser: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    socialAccounts: [],
    notifications: [],
    files: [],
    oauthTokens: [],
    verificationTokens: [],
    roles: [],
  };

  const mockPolicies: Policy[] = [
    {
      id: 'policy-1',
      name: 'Admin Full Access',
      description: 'Admins have full access',
      effect: PolicyEffect.ALLOW,
      subject: { type: 'role', value: 'admin' } as PolicySubject,
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
      id: 'policy-2',
      name: 'User Read Access',
      description: 'Users can read resources',
      effect: PolicyEffect.ALLOW,
      subject: { type: 'role', value: 'user' } as PolicySubject,
      resource: 'user:profile',
      action: 'read',
      conditions: null,
      priority: 50,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      policyAttributes: [],
    },
    {
      id: 'policy-3',
      name: 'Default Allow - User Profile Read',
      description: 'Allows all authenticated users to read user profile (low priority fallback)',
      effect: PolicyEffect.ALLOW,
      subject: { type: 'all', value: '*' } as PolicySubject,
      resource: 'user:profile',
      action: 'read',
      conditions: null,
      priority: 10,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      policyAttributes: [],
    },
    {
      id: 'policy-4',
      name: 'Default Deny - Delete Action',
      description:
        'Denies delete action for all users by default (allows role-based policies to override)',
      effect: PolicyEffect.DENY,
      subject: { type: 'all', value: '*' } as PolicySubject,
      resource: '*',
      action: 'delete',
      conditions: null,
      priority: 5,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      policyAttributes: [],
    },
  ];

  const mockPolicyService = {
    getEnabledPolicies: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PolicyEvaluatorService,
        {
          provide: PolicyService,
          useValue: mockPolicyService,
        },
      ],
    }).compile();

    service = module.get<PolicyEvaluatorService>(PolicyEvaluatorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    service.invalidateCache();
  });

  describe('evaluate', () => {
    it('should return true when user has matching allow policy', async () => {
      mockPolicyService.getEnabledPolicies.mockResolvedValue(mockPolicies);

      const userWithAdminRole: UserAttributes = {
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        phone: mockUser.phone,
        status: UserStatus.ACTIVE,
        roles: ['admin'],
      };

      const result = await service.evaluate(userWithAdminRole, 'any-resource', 'any-action');

      expect(result).toBe(true);
    });

    it('should return false when user has matching deny policy', async () => {
      mockPolicyService.getEnabledPolicies.mockResolvedValue(mockPolicies);

      const userWithUserRole: UserAttributes = {
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        phone: mockUser.phone,
        status: UserStatus.ACTIVE,
        roles: ['user'],
      };

      const result = await service.evaluate(userWithUserRole, 'any-resource', 'delete');

      expect(result).toBe(false);
    });

    it('should return false when no matching policy exists', async () => {
      mockPolicyService.getEnabledPolicies.mockResolvedValue(mockPolicies);

      const userWithUserRole: UserAttributes = {
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        phone: mockUser.phone,
        status: UserStatus.ACTIVE,
        roles: ['user'],
      };

      const result = await service.evaluate(userWithUserRole, 'admin-panel', 'write');

      expect(result).toBe(false);
    });

    it('should return false when user is not active', async () => {
      mockPolicyService.getEnabledPolicies.mockResolvedValue(mockPolicies);

      const inactiveUser: UserAttributes = {
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        phone: mockUser.phone,
        status: UserStatus.DISABLED,
        roles: ['admin'],
      };

      const result = await service.evaluate(inactiveUser, 'any-resource', 'any-action');

      expect(result).toBe(false);
    });

    it('should evaluate User entity directly', async () => {
      // Policy that matches user by username
      const policies: Policy[] = [
        {
          id: 'policy-user',
          name: 'User Specific Access',
          description: 'Specific user access',
          effect: PolicyEffect.ALLOW,
          subject: { type: 'user', value: mockUser.username } as PolicySubject,
          resource: 'profile',
          action: 'read',
          conditions: null,
          priority: 100,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          policyAttributes: [],
        },
      ];

      mockPolicyService.getEnabledPolicies.mockResolvedValue(policies);

      const result = await service.evaluate(mockUser, 'profile', 'read');

      expect(result).toBe(true);
    });
  });

  describe('evaluateWithDetails', () => {
    it('should return detailed result with matched policy', async () => {
      mockPolicyService.getEnabledPolicies.mockResolvedValue(mockPolicies);

      const userWithAdminRole: UserAttributes = {
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        phone: mockUser.phone,
        status: UserStatus.ACTIVE,
        roles: ['admin'],
      };

      const result = await service.evaluateWithDetails(userWithAdminRole, 'resource', 'action');

      expect(result.allowed).toBe(true);
      expect(result.matchedPolicy).toBeDefined();
      expect(result.matchedPolicy?.name).toBe('Admin Full Access');
      expect(result.reason).toContain('Admin Full Access');
    });

    it('should return reason when no policy matches', async () => {
      mockPolicyService.getEnabledPolicies.mockResolvedValue(mockPolicies);

      const userWithUserRole: UserAttributes = {
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        phone: mockUser.phone,
        status: UserStatus.ACTIVE,
        roles: ['user'],
      };

      const result = await service.evaluateWithDetails(
        userWithUserRole,
        'unauthorized-resource',
        'unauthorized-action'
      );

      expect(result.allowed).toBe(false);
      expect(result.matchedPolicy).toBeUndefined();
      expect(result.reason).toContain('No matching policy');
    });
  });

  describe('subject matching', () => {
    beforeEach(() => {
      mockPolicyService.getEnabledPolicies.mockResolvedValue(mockPolicies);
    });

    it('should match wildcard subject (type: all)', async () => {
      const userWithUserRole: UserAttributes = {
        id: mockUser.id,
        username: mockUser.username,
        status: UserStatus.ACTIVE,
        roles: ['user'],
      };

      // Deny policy has wildcard subject
      const result = await service.evaluate(userWithUserRole, 'resource', 'delete');
      expect(result).toBe(false);
    });

    it('should match role subject', async () => {
      const userWithAdminRole: UserAttributes = {
        id: mockUser.id,
        username: mockUser.username,
        status: UserStatus.ACTIVE,
        roles: ['admin'],
      };

      const result = await service.evaluate(userWithAdminRole, 'any', 'any');
      expect(result).toBe(true);
    });

    it('should match user ID subject', async () => {
      const policies: Policy[] = [
        {
          id: 'policy-1',
          name: 'User Access',
          description: '',
          effect: PolicyEffect.ALLOW,
          subject: { type: 'user', value: mockUser.id } as PolicySubject,
          resource: 'own-data',
          action: 'read',
          conditions: null,
          priority: 100,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          policyAttributes: [],
        },
      ];

      mockPolicyService.getEnabledPolicies.mockResolvedValue(policies);

      const result = await service.evaluate(mockUser, 'own-data', 'read');
      expect(result).toBe(true);
    });

    it('should match user with multiple roles when policy has array value', async () => {
      const policies: Policy[] = [
        {
          id: 'policy-1',
          name: 'Multi Role Access',
          description: '',
          effect: PolicyEffect.ALLOW,
          subject: { type: 'role', value: ['admin', 'editor'] } as PolicySubject,
          resource: 'content',
          action: 'write',
          conditions: null,
          priority: 100,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          policyAttributes: [],
        },
      ];

      mockPolicyService.getEnabledPolicies.mockResolvedValue(policies);

      const userWithEditorRole: UserAttributes = {
        id: mockUser.id,
        username: mockUser.username,
        status: UserStatus.ACTIVE,
        roles: ['editor'],
      };

      const result = await service.evaluate(userWithEditorRole, 'content', 'write');
      expect(result).toBe(true);
    });

    it('should match department subject', async () => {
      const policies: Policy[] = [
        {
          id: 'policy-1',
          name: 'Department Access',
          description: '',
          effect: PolicyEffect.ALLOW,
          subject: { type: 'department', value: 'engineering' } as PolicySubject,
          resource: 'internal-docs',
          action: 'read',
          conditions: null,
          priority: 100,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          policyAttributes: [],
        },
      ];

      mockPolicyService.getEnabledPolicies.mockResolvedValue(policies);

      const userInEngineering: UserAttributes = {
        id: mockUser.id,
        username: mockUser.username,
        status: UserStatus.ACTIVE,
        roles: ['user'],
        departments: ['engineering'],
      };

      const result = await service.evaluate(userInEngineering, 'internal-docs', 'read');
      expect(result).toBe(true);
    });
  });

  describe('resource matching', () => {
    const testPolicies: Policy[] = [
      {
        id: 'policy-1',
        name: 'Test',
        description: '',
        effect: PolicyEffect.ALLOW,
        subject: { type: 'all', value: '*' } as PolicySubject,
        resource: 'user:*',
        action: 'read',
        conditions: null,
        priority: 100,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        policyAttributes: [],
      },
    ];

    beforeEach(() => {
      mockPolicyService.getEnabledPolicies.mockResolvedValue(testPolicies);
    });

    it('should match exact resource', async () => {
      // Add exact match policy
      const exactPolicy: Policy = {
        ...testPolicies[0],
        resource: 'profile',
      };
      mockPolicyService.getEnabledPolicies.mockResolvedValue([exactPolicy]);

      const result = await service.evaluate(mockUser, 'profile', 'read');
      expect(result).toBe(true);
    });

    it('should match wildcard resource', async () => {
      const wildcardPolicy: Policy = {
        ...testPolicies[0],
        resource: '*',
      };
      mockPolicyService.getEnabledPolicies.mockResolvedValue([wildcardPolicy]);

      const result = await service.evaluate(mockUser, 'any-resource', 'read');
      expect(result).toBe(true);
    });

    it('should match prefix wildcard resource', async () => {
      const result = await service.evaluate(mockUser, 'user:profile', 'read');
      expect(result).toBe(true);
    });

    it('should match base resource for prefix wildcard', async () => {
      const result = await service.evaluate(mockUser, 'user', 'read');
      expect(result).toBe(true);
    });
  });

  describe('action matching', () => {
    const testPolicies: Policy[] = [
      {
        id: 'policy-1',
        name: 'Test',
        description: '',
        effect: PolicyEffect.ALLOW,
        subject: { type: 'all', value: '*' } as PolicySubject,
        resource: '*',
        action: 'read,write',
        conditions: null,
        priority: 100,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        policyAttributes: [],
      },
    ];

    beforeEach(() => {
      mockPolicyService.getEnabledPolicies.mockResolvedValue(testPolicies);
    });

    it('should match exact action', async () => {
      const singleActionPolicy: Policy = {
        ...testPolicies[0],
        action: 'read',
      };
      mockPolicyService.getEnabledPolicies.mockResolvedValue([singleActionPolicy]);

      const result = await service.evaluate(mockUser, 'resource', 'read');
      expect(result).toBe(true);
    });

    it('should match wildcard action', async () => {
      const wildcardPolicy: Policy = {
        ...testPolicies[0],
        action: '*',
      };
      mockPolicyService.getEnabledPolicies.mockResolvedValue([wildcardPolicy]);

      const result = await service.evaluate(mockUser, 'resource', 'any-action');
      expect(result).toBe(true);
    });

    it('should match comma-separated actions', async () => {
      const result = await service.evaluate(mockUser, 'resource', 'read');
      expect(result).toBe(true);
    });

    it('should not match action not in list', async () => {
      const result = await service.evaluate(mockUser, 'resource', 'delete');
      expect(result).toBe(false);
    });
  });

  describe('condition evaluation', () => {
    it('should evaluate single condition (condition shorthand)', async () => {
      const policies: Policy[] = [
        {
          id: 'policy-1',
          name: 'Conditional Access',
          description: '',
          effect: PolicyEffect.ALLOW,
          subject: { type: 'all', value: '*' } as PolicySubject,
          resource: 'resource',
          action: 'read',
          conditions: {
            condition: {
              field: 'status',
              operator: 'eq',
              value: 'active',
            },
          } as ConditionExpression,
          priority: 100,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          policyAttributes: [],
        },
      ];

      mockPolicyService.getEnabledPolicies.mockResolvedValue(policies);

      const activeUser: UserAttributes = {
        id: mockUser.id,
        username: mockUser.username,
        status: UserStatus.ACTIVE,
        roles: [],
      };

      const result = await service.evaluate(activeUser, 'resource', 'read');
      expect(result).toBe(true);
    });

    it('should evaluate AND conditions', async () => {
      const policies: Policy[] = [
        {
          id: 'policy-1',
          name: 'Conditional Access',
          description: '',
          effect: PolicyEffect.ALLOW,
          subject: { type: 'all', value: '*' } as PolicySubject,
          resource: 'resource',
          action: 'read',
          conditions: {
            and: [
              { field: 'status', operator: 'eq', value: 'active' },
              { field: 'roles', operator: 'in', value: ['admin', 'user'] },
            ],
          } as ConditionExpression,
          priority: 100,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          policyAttributes: [],
        },
      ];

      mockPolicyService.getEnabledPolicies.mockResolvedValue(policies);

      const userWithRole: UserAttributes = {
        id: mockUser.id,
        username: mockUser.username,
        status: UserStatus.ACTIVE,
        roles: ['user'],
      };

      const result = await service.evaluate(userWithRole, 'resource', 'read');
      expect(result).toBe(true);
    });

    it('should fail when condition not satisfied', async () => {
      const policies: Policy[] = [
        {
          id: 'policy-1',
          name: 'Conditional Access',
          description: '',
          effect: PolicyEffect.ALLOW,
          subject: { type: 'all', value: '*' } as PolicySubject,
          resource: 'resource',
          action: 'read',
          conditions: {
            condition: {
              field: 'roles',
              operator: 'in',
              value: ['admin'],
            },
          } as ConditionExpression,
          priority: 100,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          policyAttributes: [],
        },
      ];

      mockPolicyService.getEnabledPolicies.mockResolvedValue(policies);

      const userWithoutAdmin: UserAttributes = {
        id: mockUser.id,
        username: mockUser.username,
        status: UserStatus.ACTIVE,
        roles: ['user'],
      };

      const result = await service.evaluate(userWithoutAdmin, 'resource', 'read');
      expect(result).toBe(false);
    });

    it('should evaluate userAttr valueType', async () => {
      const policies: Policy[] = [
        {
          id: 'policy-1',
          name: 'Own Resource Access',
          description: '',
          effect: PolicyEffect.ALLOW,
          subject: { type: 'all', value: '*' } as PolicySubject,
          resource: 'own-resource',
          action: 'read',
          conditions: {
            condition: {
              field: 'id',
              operator: 'eq',
              value: 'id', // Reference to user's id attribute
              valueType: 'userAttr',
            },
          } as ConditionExpression,
          priority: 100,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          policyAttributes: [],
        },
      ];

      mockPolicyService.getEnabledPolicies.mockResolvedValue(policies);

      const user: UserAttributes = {
        id: 'user-123',
        username: mockUser.username,
        status: UserStatus.ACTIVE,
        roles: [],
      };

      // Condition checks if user.id === user.id (always true for same user)
      const result = await service.evaluate(user, 'own-resource', 'read');
      expect(result).toBe(true);
    });

    it('should evaluate env valueType with environment context', async () => {
      const policies: Policy[] = [
        {
          id: 'policy-1',
          name: 'Environment Based',
          description: '',
          effect: PolicyEffect.ALLOW,
          subject: { type: 'all', value: '*' } as PolicySubject,
          resource: 'resource',
          action: 'read',
          conditions: {
            condition: {
              field: 'env.ENVIRONMENT',
              operator: 'eq',
              value: 'production',
              valueType: 'literal',
            },
          } as ConditionExpression,
          priority: 100,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          policyAttributes: [],
        },
      ];

      mockPolicyService.getEnabledPolicies.mockResolvedValue(policies);

      const user: UserAttributes = {
        id: mockUser.id,
        username: mockUser.username,
        status: UserStatus.ACTIVE,
        roles: [],
      };

      // Pass environment context
      const result = await service.evaluateWithDetails(user, 'resource', 'read', {
        ENVIRONMENT: 'production',
      });
      expect(result.allowed).toBe(true);
    });
  });

  describe('policy cache', () => {
    it('should cache policies', async () => {
      mockPolicyService.getEnabledPolicies.mockResolvedValue(mockPolicies);

      const userWithAdminRole: UserAttributes = {
        id: mockUser.id,
        username: mockUser.username,
        status: UserStatus.ACTIVE,
        roles: ['admin'],
      };

      // First call
      await service.evaluate(userWithAdminRole, 'resource', 'action');
      // Second call
      await service.evaluate(userWithAdminRole, 'resource', 'action');

      // Should only call getEnabledPolicies once due to caching
      expect(mockPolicyService.getEnabledPolicies).toHaveBeenCalledTimes(1);
    });

    it('should invalidate cache', async () => {
      mockPolicyService.getEnabledPolicies.mockResolvedValue(mockPolicies);

      const userWithAdminRole: UserAttributes = {
        id: mockUser.id,
        username: mockUser.username,
        status: UserStatus.ACTIVE,
        roles: ['admin'],
      };

      // First call
      await service.evaluate(userWithAdminRole, 'resource', 'action');

      // Invalidate cache
      service.invalidateCache();

      // Second call should fetch again
      await service.evaluate(userWithAdminRole, 'resource', 'action');

      expect(mockPolicyService.getEnabledPolicies).toHaveBeenCalledTimes(2);
    });
  });

  describe('evaluateBulk', () => {
    it('should evaluate multiple permissions at once', async () => {
      mockPolicyService.getEnabledPolicies.mockResolvedValue(mockPolicies);

      const userWithUserRole: UserAttributes = {
        id: mockUser.id,
        username: mockUser.username,
        status: UserStatus.ACTIVE,
        roles: ['user'],
      };

      const requests = [
        { resource: 'user:profile', action: 'read' },
        { resource: 'any-resource', action: 'delete' },
      ];

      const result = await service.evaluateBulk(userWithUserRole, requests);

      expect(result['user:profile:read']).toBe(true);
      expect(result['any-resource:delete']).toBe(false);
    });
  });

  describe('extractUserAttributes', () => {
    it('should extract roles from User entity when roles are loaded', async () => {
      mockPolicyService.getEnabledPolicies.mockResolvedValue(mockPolicies);

      const userWithRoles: User = {
        ...mockUser,
        roles: [
          {
            id: 'role-1',
            name: 'admin',
            description: 'Admin role',
            isSuperAdmin: false,
            permissions: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'role-2',
            name: 'editor',
            description: 'Editor role',
            isSuperAdmin: false,
            permissions: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      const result = await service.evaluateWithDetails(userWithRoles, 'any-resource', 'any-action');

      // Admin policy should match because user has 'admin' role
      expect(result.allowed).toBe(true);
      expect(result.matchedPolicy?.name).toBe('Admin Full Access');
    });

    it('should handle User entity without loaded roles', async () => {
      mockPolicyService.getEnabledPolicies.mockResolvedValue(mockPolicies);

      const userWithoutRoles: User = {
        ...mockUser,
        roles: undefined as unknown as never[],
      };

      // Should not match admin role policy since roles are not loaded
      const result = await service.evaluateWithDetails(
        userWithoutRoles,
        'any-resource',
        'any-action'
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('No matching policy');
    });

    it('should handle User entity with empty roles array', async () => {
      mockPolicyService.getEnabledPolicies.mockResolvedValue(mockPolicies);

      const userWithEmptyRoles: User = {
        ...mockUser,
        roles: [],
      };

      // Should not match any role-based policy since roles array is empty
      const result = await service.evaluateWithDetails(
        userWithEmptyRoles,
        'any-resource',
        'any-action'
      );

      expect(result.allowed).toBe(false);
    });
  });

  describe('getDataFilterConditions', () => {
    it('should return empty array for now (placeholder)', async () => {
      mockPolicyService.getEnabledPolicies.mockResolvedValue(mockPolicies);

      const userWithAdminRole: UserAttributes = {
        id: mockUser.id,
        username: mockUser.username,
        status: UserStatus.ACTIVE,
        roles: ['admin'],
      };

      const result = await service.getDataFilterConditions(userWithAdminRole, 'resource', 'read');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });

  describe('canAccessData', () => {
    it('should return true when user has basic permission', async () => {
      mockPolicyService.getEnabledPolicies.mockResolvedValue(mockPolicies);

      const userWithAdminRole: UserAttributes = {
        id: mockUser.id,
        username: mockUser.username,
        status: UserStatus.ACTIVE,
        roles: ['admin'],
      };

      const result = await service.canAccessData(
        userWithAdminRole,
        'any-resource',
        'read',
        'data-id-123'
      );

      expect(result).toBe(true);
    });

    it('should return false when user does not have permission', async () => {
      mockPolicyService.getEnabledPolicies.mockResolvedValue(mockPolicies);

      const userWithUserRole: UserAttributes = {
        id: mockUser.id,
        username: mockUser.username,
        status: UserStatus.ACTIVE,
        roles: ['user'],
      };

      const result = await service.canAccessData(
        userWithUserRole,
        'any-resource',
        'delete',
        'data-id-123'
      );

      expect(result).toBe(false);
    });
  });

  describe('validateInputData', () => {
    it('should return valid when user has write permission', async () => {
      mockPolicyService.getEnabledPolicies.mockResolvedValue(mockPolicies);

      const userWithAdminRole: UserAttributes = {
        id: mockUser.id,
        username: mockUser.username,
        status: UserStatus.ACTIVE,
        roles: ['admin'],
      };

      const result = await service.validateInputData(userWithAdminRole, 'resource', {
        name: 'test',
      });

      expect(result.valid).toBe(true);
    });

    it('should return invalid when user does not have write permission', async () => {
      // Policy that only allows read, not write
      const policies: Policy[] = [
        {
          id: 'policy-1',
          name: 'Read Only',
          description: '',
          effect: PolicyEffect.ALLOW,
          subject: { type: 'role', value: 'user' } as PolicySubject,
          resource: 'resource',
          action: 'read',
          conditions: null,
          priority: 100,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          policyAttributes: [],
        },
      ];

      mockPolicyService.getEnabledPolicies.mockResolvedValue(policies);

      const userWithUserRole: UserAttributes = {
        id: mockUser.id,
        username: mockUser.username,
        status: UserStatus.ACTIVE,
        roles: ['user'],
      };

      const result = await service.validateInputData(userWithUserRole, 'resource', {
        name: 'test',
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('does not have write permission');
    });
  });
});
