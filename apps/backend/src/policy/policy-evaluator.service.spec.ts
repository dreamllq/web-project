import { Test, TestingModule } from '@nestjs/testing';
import { PolicyEvaluatorService, UserAttributes } from './policy-evaluator.service';
import { PolicyService } from './policy.service';
import { Policy, PolicyEffect } from '../entities/policy.entity';
import { User, UserStatus } from '../entities/user.entity';

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
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    socialAccounts: [],
    notifications: [],
    files: [],
    oauthTokens: [],
  };

  const mockPolicies: Policy[] = [
    {
      id: 'policy-1',
      name: 'Admin Full Access',
      description: 'Admins have full access',
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
      id: 'policy-2',
      name: 'User Read Access',
      description: 'Users can read resources',
      effect: PolicyEffect.ALLOW,
      subject: 'role:user',
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
      name: 'Deny Delete',
      description: 'Deny delete for non-admins',
      effect: PolicyEffect.DENY,
      subject: '*',
      resource: '*',
      action: 'delete',
      conditions: null,
      priority: 10,
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
      mockPolicyService.getEnabledPolicies.mockResolvedValue(mockPolicies);

      // Policy that matches user by username
      const policies: Policy[] = [
        {
          id: 'policy-user',
          name: 'User Specific Access',
          description: 'Specific user access',
          effect: PolicyEffect.ALLOW,
          subject: `user:${mockUser.username}`,
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
        'unauthorized-action',
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

    it('should match wildcard subject', async () => {
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
          subject: `user:${mockUser.id}`,
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
  });

  describe('resource matching', () => {
    const testPolicies: Policy[] = [
      {
        id: 'policy-1',
        name: 'Test',
        description: '',
        effect: PolicyEffect.ALLOW,
        subject: '*',
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
        subject: '*',
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
});
