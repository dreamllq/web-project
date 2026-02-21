import { ForbiddenException } from '@nestjs/common';

import { PermissionGuard } from './permission.guard';
import { PermissionMetadata } from '../decorators/require-permission.decorator';

// Define UserStatus enum locally to avoid circular dependency from entity imports
const UserStatus = {
  PENDING: 'pending',
  ACTIVE: 'active',
  DISABLED: 'disabled',
} as const;

type UserStatusType = (typeof UserStatus)[keyof typeof UserStatus];

// Mock User type to avoid circular dependency issues
interface MockUser {
  id: string;
  username: string;
  email: string;
  status: UserStatusType;
}

describe('PermissionGuard', () => {
  let guard: PermissionGuard;
  let mockReflector: { getAllAndOverride: jest.Mock };
  let mockPolicyEvaluator: { evaluate: jest.Mock };
  let mockRoleService: { getUserPermissions: jest.Mock };
  let mockConfigService: { get: jest.Mock };

  const mockUser: MockUser = {
    id: 'uuid-123',
    username: 'testuser',
    email: 'test@example.com',
    status: UserStatus.ACTIVE,
  };

  const mockExecutionContext = (user?: MockUser, _permission?: PermissionMetadata) => ({
    switchToHttp: () => ({
      getRequest: () => ({
        user,
      }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  });

  beforeEach(() => {
    mockReflector = {
      getAllAndOverride: jest.fn(),
    };

    mockPolicyEvaluator = {
      evaluate: jest.fn(),
    };

    mockRoleService = {
      getUserPermissions: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn(),
    };

    // Manually construct the guard with mock dependencies
    guard = new PermissionGuard(
      mockReflector as any,
      mockPolicyEvaluator as any,
      mockRoleService as any,
      mockConfigService as any
    );
  });

  afterEach(() => {
    mockReflector.getAllAndOverride.mockClear();
    mockPolicyEvaluator.evaluate.mockClear();
    mockRoleService.getUserPermissions.mockClear();
    mockConfigService.get.mockClear();
  });

  describe('canActivate', () => {
    const permission: PermissionMetadata = {
      resource: 'policy',
      action: 'read',
    };

    describe('when useAbacOnly is false (default mode - backward compatible)', () => {
      beforeEach(() => {
        mockConfigService.get.mockReturnValue({ useAbacOnly: false });
      });

      it('should allow access when no permission metadata is required', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(null);

        const context = mockExecutionContext(mockUser);
        const result = await guard.canActivate(context as any);

        expect(result).toBe(true);
      });

      it('should deny access when no user is authenticated', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(permission);

        const context = mockExecutionContext(undefined);
        await expect(guard.canActivate(context as any)).rejects.toThrow(ForbiddenException);
      });

      it('should allow access when ABAC grants permission', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(permission);
        mockPolicyEvaluator.evaluate.mockResolvedValue(true);

        const context = mockExecutionContext(mockUser);
        const result = await guard.canActivate(context as any);

        expect(result).toBe(true);
        expect(mockPolicyEvaluator.evaluate).toHaveBeenCalledWith(mockUser, 'policy', 'read');
      });

      it('should allow access when RBAC grants permission (ABAC denied)', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(permission);
        mockPolicyEvaluator.evaluate.mockResolvedValue(false);
        mockRoleService.getUserPermissions.mockResolvedValue(['policy:read']);

        const context = mockExecutionContext(mockUser);
        const result = await guard.canActivate(context as any);

        expect(result).toBe(true);
        expect(mockRoleService.getUserPermissions).toHaveBeenCalledWith('uuid-123');
      });

      it('should deny access when both ABAC and RBAC deny', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(permission);
        mockPolicyEvaluator.evaluate.mockResolvedValue(false);
        mockRoleService.getUserPermissions.mockResolvedValue(['other:action']);

        const context = mockExecutionContext(mockUser);
        await expect(guard.canActivate(context as any)).rejects.toThrow(ForbiddenException);
      });

      it('should check wildcard permissions in RBAC', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(permission);
        mockPolicyEvaluator.evaluate.mockResolvedValue(false);
        mockRoleService.getUserPermissions.mockResolvedValue(['policy:*']);

        const context = mockExecutionContext(mockUser);
        const result = await guard.canActivate(context as any);

        expect(result).toBe(true);
      });

      it('should check full wildcard permissions in RBAC', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(permission);
        mockPolicyEvaluator.evaluate.mockResolvedValue(false);
        mockRoleService.getUserPermissions.mockResolvedValue(['*:*']);

        const context = mockExecutionContext(mockUser);
        const result = await guard.canActivate(context as any);

        expect(result).toBe(true);
      });
    });

    describe('when useAbacOnly is true (ABAC-only mode)', () => {
      beforeEach(() => {
        mockConfigService.get.mockReturnValue({ useAbacOnly: true });
      });

      it('should allow access when ABAC grants permission', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(permission);
        mockPolicyEvaluator.evaluate.mockResolvedValue(true);

        const context = mockExecutionContext(mockUser);
        const result = await guard.canActivate(context as any);

        expect(result).toBe(true);
        expect(mockPolicyEvaluator.evaluate).toHaveBeenCalledWith(mockUser, 'policy', 'read');
      });

      it('should skip RBAC check when ABAC denies (ABAC-only mode)', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(permission);
        mockPolicyEvaluator.evaluate.mockResolvedValue(false);
        mockRoleService.getUserPermissions.mockResolvedValue(['policy:read']);

        const context = mockExecutionContext(mockUser);
        await expect(guard.canActivate(context as any)).rejects.toThrow(ForbiddenException);

        // RBAC should NOT be called in ABAC-only mode
        expect(mockRoleService.getUserPermissions).not.toHaveBeenCalled();
      });

      it('should deny access when ABAC denies, even if RBAC would allow', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(permission);
        mockPolicyEvaluator.evaluate.mockResolvedValue(false);
        // User has RBAC permission but it should be ignored
        mockRoleService.getUserPermissions.mockResolvedValue(['policy:*', '*:*']);

        const context = mockExecutionContext(mockUser);
        await expect(guard.canActivate(context as any)).rejects.toThrow(ForbiddenException);
      });
    });

    describe('config defaults', () => {
      it('should default to useAbacOnly=false when config is undefined', async () => {
        mockConfigService.get.mockReturnValue(undefined);
        mockReflector.getAllAndOverride.mockReturnValue(permission);
        mockPolicyEvaluator.evaluate.mockResolvedValue(false);
        mockRoleService.getUserPermissions.mockResolvedValue(['policy:read']);

        const context = mockExecutionContext(mockUser);
        const result = await guard.canActivate(context as any);

        // Should fallback to RBAC (default mode)
        expect(result).toBe(true);
        expect(mockRoleService.getUserPermissions).toHaveBeenCalled();
      });

      it('should default to useAbacOnly=false when permission config is null', async () => {
        mockConfigService.get.mockReturnValue(null);
        mockReflector.getAllAndOverride.mockReturnValue(permission);
        mockPolicyEvaluator.evaluate.mockResolvedValue(false);
        mockRoleService.getUserPermissions.mockResolvedValue(['policy:read']);

        const context = mockExecutionContext(mockUser);
        const result = await guard.canActivate(context as any);

        // Should fallback to RBAC (default mode)
        expect(result).toBe(true);
        expect(mockRoleService.getUserPermissions).toHaveBeenCalled();
      });

      it('should default to useAbacOnly=false when useAbacOnly is not set', async () => {
        mockConfigService.get.mockReturnValue({});
        mockReflector.getAllAndOverride.mockReturnValue(permission);
        mockPolicyEvaluator.evaluate.mockResolvedValue(false);
        mockRoleService.getUserPermissions.mockResolvedValue(['policy:read']);

        const context = mockExecutionContext(mockUser);
        const result = await guard.canActivate(context as any);

        // Should fallback to RBAC (default mode)
        expect(result).toBe(true);
        expect(mockRoleService.getUserPermissions).toHaveBeenCalled();
      });
    });
  });
});
