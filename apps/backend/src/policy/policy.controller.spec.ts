import { Test, TestingModule } from '@nestjs/testing';
import { PolicyController } from './policy.controller';
import { PolicyService } from './policy.service';
import { PolicyEvaluatorService } from './policy-evaluator.service';
import { Policy, PolicyEffect } from '../entities/policy.entity';
import { User, UserStatus } from '../entities/user.entity';
import { RoleService } from '../rbac/role.service';

describe('PolicyController', () => {
  let controller: PolicyController;

  const mockUser: User = {
    id: 'user-uuid-123',
    username: 'testuser',
    email: 'test@example.com',
    phone: null,
    passwordHash: 'hash',
    nickname: null,
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

  const mockPolicy: Policy = {
    id: 'policy-uuid-123',
    name: 'Test Policy',
    description: 'Test description',
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
  };

  const mockPolicyService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockPolicyEvaluator = {
    evaluate: jest.fn(),
    evaluateBulk: jest.fn(),
    invalidateCache: jest.fn(),
  };

  const mockRoleService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByName: jest.fn(),
    getUserRoles: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PolicyController],
      providers: [
        {
          provide: PolicyService,
          useValue: mockPolicyService,
        },
        {
          provide: PolicyEvaluatorService,
          useValue: mockPolicyEvaluator,
        },
        {
          provide: RoleService,
          useValue: mockRoleService,
        },
      ],
    }).compile();

    controller = module.get<PolicyController>(PolicyController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      name: 'New Policy',
      effect: PolicyEffect.ALLOW,
      subject: 'role:user',
      resource: 'file',
      action: 'read',
    };

    it('should create a policy and invalidate cache', async () => {
      mockPolicyService.create.mockResolvedValue(mockPolicy);

      const result = await controller.create(createDto);

      expect(result).toEqual(mockPolicy);
      expect(mockPolicyService.create).toHaveBeenCalledWith(createDto);
      expect(mockPolicyEvaluator.invalidateCache).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated policies', async () => {
      const query = { page: 1, limit: 10 };
      mockPolicyService.findAll.mockResolvedValue({
        data: [mockPolicy],
        total: 1,
      });

      const result = await controller.findAll(query);

      expect(result).toEqual({
        data: [mockPolicy],
        total: 1,
        page: 1,
        limit: 10,
      });
      expect(mockPolicyService.findAll).toHaveBeenCalledWith(query);
    });

    it('should use default pagination values', async () => {
      mockPolicyService.findAll.mockResolvedValue({
        data: [],
        total: 0,
      });

      const result = await controller.findAll({});

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });

  describe('findOne', () => {
    it('should return a policy by ID', async () => {
      mockPolicyService.findOne.mockResolvedValue(mockPolicy);

      const result = await controller.findOne('policy-uuid-123');

      expect(result).toEqual(mockPolicy);
      expect(mockPolicyService.findOne).toHaveBeenCalledWith('policy-uuid-123');
    });
  });

  describe('update', () => {
    const updateDto = { name: 'Updated Policy' };

    it('should update a policy and invalidate cache', async () => {
      const updatedPolicy = { ...mockPolicy, name: 'Updated Policy' };
      mockPolicyService.update.mockResolvedValue(updatedPolicy);

      const result = await controller.update('policy-uuid-123', updateDto);

      expect(result).toEqual(updatedPolicy);
      expect(mockPolicyService.update).toHaveBeenCalledWith('policy-uuid-123', updateDto);
      expect(mockPolicyEvaluator.invalidateCache).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete a policy and invalidate cache', async () => {
      mockPolicyService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('policy-uuid-123');

      expect(result).toEqual({ message: 'Policy deleted successfully' });
      expect(mockPolicyService.remove).toHaveBeenCalledWith('policy-uuid-123');
      expect(mockPolicyEvaluator.invalidateCache).toHaveBeenCalled();
    });
  });

  describe('checkPermission', () => {
    it('should check user permission', async () => {
      mockPolicyEvaluator.evaluate.mockResolvedValue(true);

      const result = await controller.checkPermission(mockUser, 'policy', 'read');

      expect(result).toEqual({
        allowed: true,
        resource: 'policy',
        action: 'read',
      });
      expect(mockPolicyEvaluator.evaluate).toHaveBeenCalledWith(mockUser, 'policy', 'read');
    });

    it('should return false when permission denied', async () => {
      mockPolicyEvaluator.evaluate.mockResolvedValue(false);

      const result = await controller.checkPermission(mockUser, 'policy', 'delete');

      expect(result.allowed).toBe(false);
    });
  });

  describe('checkBulkPermissions', () => {
    it('should check multiple permissions at once', async () => {
      mockPolicyEvaluator.evaluateBulk.mockResolvedValue({
        'policy:read': true,
        'policy:write': false,
      });

      const requests = [
        { resource: 'policy', action: 'read' },
        { resource: 'policy', action: 'write' },
      ];

      const result = await controller.checkBulkPermissions(mockUser, requests);

      expect(result).toEqual({
        'policy:read': true,
        'policy:write': false,
      });
      expect(mockPolicyEvaluator.evaluateBulk).toHaveBeenCalledWith(mockUser, requests);
    });
  });
});
