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
  isSuperuser: boolean;
}

describe('PermissionGuard', () => {
  let guard: PermissionGuard;
  let mockReflector: { getAllAndOverride: jest.Mock };
  let mockPolicyEvaluator: { canAccessData: jest.Mock };
  let mockPermissionCache: { getUserPermissions: jest.Mock };

  const mockUser: MockUser = {
    id: 'uuid-123',
    username: 'testuser',
    email: 'test@example.com',
    status: UserStatus.ACTIVE,
    isSuperuser: false,
  };

  const mockSuperuser: MockUser = {
    id: 'uuid-super',
    username: 'superuser',
    email: 'super@example.com',
    status: UserStatus.ACTIVE,
    isSuperuser: true,
  };

  const mockExecutionContext = (user?: MockUser, params?: Record<string, string>) => ({
    switchToHttp: () => ({
      getRequest: () => ({
        user,
        params: params || {},
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
      canAccessData: jest.fn(),
    };

    mockPermissionCache = {
      getUserPermissions: jest.fn(),
    };

    // Manually construct the guard with mock dependencies
    guard = new PermissionGuard(
      mockReflector as any,
      mockPolicyEvaluator as any,
      mockPermissionCache as any
    );
  });

  afterEach(() => {
    mockReflector.getAllAndOverride.mockClear();
    mockPolicyEvaluator.canAccessData.mockClear();
    mockPermissionCache.getUserPermissions.mockClear();
  });

  describe('canActivate', () => {
    const readPermission: PermissionMetadata = {
      resource: 'policy',
      action: 'read',
    };

    const writePermission: PermissionMetadata = {
      resource: 'policy',
      action: 'update',
    };

    describe('basic scenarios', () => {
      it('should allow access when no permission metadata is required', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(null);

        const context = mockExecutionContext(mockUser);
        const result = await guard.canActivate(context as any);

        expect(result).toBe(true);
      });

      it('should deny access when no user is authenticated', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(readPermission);

        const context = mockExecutionContext(undefined);
        await expect(guard.canActivate(context as any)).rejects.toThrow(ForbiddenException);
      });
    });

    describe('superuser bypass', () => {
      it('should allow access for superuser without checking permissions', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(readPermission);

        const context = mockExecutionContext(mockSuperuser);
        const result = await guard.canActivate(context as any);

        expect(result).toBe(true);
        expect(mockPermissionCache.getUserPermissions).not.toHaveBeenCalled();
      });

      it('should allow superuser for write operations without ABAC check', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(writePermission);

        const context = mockExecutionContext(mockSuperuser, { id: 'policy-123' });
        const result = await guard.canActivate(context as any);

        expect(result).toBe(true);
        expect(mockPolicyEvaluator.canAccessData).not.toHaveBeenCalled();
      });
    });

    describe('RBAC check', () => {
      it('should deny access when permission cache is empty (cache miss)', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(readPermission);
        mockPermissionCache.getUserPermissions.mockResolvedValue(null);

        const context = mockExecutionContext(mockUser);
        await expect(guard.canActivate(context as any)).rejects.toThrow(ForbiddenException);

        expect(mockPermissionCache.getUserPermissions).toHaveBeenCalledWith('uuid-123');
      });

      it('should allow access when user has exact RBAC permission', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(readPermission);
        mockPermissionCache.getUserPermissions.mockResolvedValue(['policy:read']);

        const context = mockExecutionContext(mockUser);
        const result = await guard.canActivate(context as any);

        expect(result).toBe(true);
      });

      it('should allow access when user has resource wildcard permission', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(readPermission);
        mockPermissionCache.getUserPermissions.mockResolvedValue(['policy:*']);

        const context = mockExecutionContext(mockUser);
        const result = await guard.canActivate(context as any);

        expect(result).toBe(true);
      });

      it('should allow access when user has action wildcard permission', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(readPermission);
        mockPermissionCache.getUserPermissions.mockResolvedValue(['*:read']);

        const context = mockExecutionContext(mockUser);
        const result = await guard.canActivate(context as any);

        expect(result).toBe(true);
      });

      it('should allow access when user has full wildcard permission', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(readPermission);
        mockPermissionCache.getUserPermissions.mockResolvedValue(['*:*']);

        const context = mockExecutionContext(mockUser);
        const result = await guard.canActivate(context as any);

        expect(result).toBe(true);
      });

      it('should deny access when RBAC permission is missing', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(readPermission);
        mockPermissionCache.getUserPermissions.mockResolvedValue(['other:action']);

        const context = mockExecutionContext(mockUser);
        await expect(guard.canActivate(context as any)).rejects.toThrow(ForbiddenException);
      });

      it('should deny access (403) when RBAC fails without checking ABAC', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(writePermission);
        mockPermissionCache.getUserPermissions.mockResolvedValue(['other:action']);

        const context = mockExecutionContext(mockUser, { id: 'policy-123' });
        await expect(guard.canActivate(context as any)).rejects.toThrow(ForbiddenException);

        // ABAC should NOT be called when RBAC fails
        expect(mockPolicyEvaluator.canAccessData).not.toHaveBeenCalled();
      });
    });

    describe('ABAC check for write operations', () => {
      beforeEach(() => {
        mockPermissionCache.getUserPermissions.mockResolvedValue(['policy:update']);
      });

      it('should check ABAC for create operation with dataId', async () => {
        mockReflector.getAllAndOverride.mockReturnValue({
          resource: 'policy',
          action: 'create',
        });
        mockPolicyEvaluator.canAccessData.mockResolvedValue(true);

        const context = mockExecutionContext(mockUser, { id: 'policy-123' });
        const result = await guard.canActivate(context as any);

        expect(result).toBe(true);
        expect(mockPolicyEvaluator.canAccessData).toHaveBeenCalledWith(
          mockUser,
          'policy',
          'create',
          'policy-123'
        );
      });

      it('should check ABAC for update operation with dataId', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(writePermission);
        mockPolicyEvaluator.canAccessData.mockResolvedValue(true);

        const context = mockExecutionContext(mockUser, { id: 'policy-456' });
        const result = await guard.canActivate(context as any);

        expect(result).toBe(true);
        expect(mockPolicyEvaluator.canAccessData).toHaveBeenCalledWith(
          mockUser,
          'policy',
          'update',
          'policy-456'
        );
      });

      it('should check ABAC for delete operation with dataId', async () => {
        mockReflector.getAllAndOverride.mockReturnValue({
          resource: 'policy',
          action: 'delete',
        });
        mockPolicyEvaluator.canAccessData.mockResolvedValue(true);

        const context = mockExecutionContext(mockUser, { id: 'policy-789' });
        const result = await guard.canActivate(context as any);

        expect(result).toBe(true);
        expect(mockPolicyEvaluator.canAccessData).toHaveBeenCalledWith(
          mockUser,
          'policy',
          'delete',
          'policy-789'
        );
      });

      it('should check ABAC for write action with dataId', async () => {
        mockReflector.getAllAndOverride.mockReturnValue({
          resource: 'policy',
          action: 'write',
        });
        mockPolicyEvaluator.canAccessData.mockResolvedValue(true);

        const context = mockExecutionContext(mockUser, { id: 'policy-abc' });
        const result = await guard.canActivate(context as any);

        expect(result).toBe(true);
        expect(mockPolicyEvaluator.canAccessData).toHaveBeenCalledWith(
          mockUser,
          'policy',
          'write',
          'policy-abc'
        );
      });

      it('should skip ABAC check when no dataId in params', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(writePermission);

        const context = mockExecutionContext(mockUser);
        const result = await guard.canActivate(context as any);

        expect(result).toBe(true);
        expect(mockPolicyEvaluator.canAccessData).not.toHaveBeenCalled();
      });

      it('should deny access when ABAC denies for write operation', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(writePermission);
        mockPolicyEvaluator.canAccessData.mockResolvedValue(false);

        const context = mockExecutionContext(mockUser, { id: 'policy-123' });
        await expect(guard.canActivate(context as any)).rejects.toThrow(ForbiddenException);
      });

      it('should allow access when ABAC allows for write operation', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(writePermission);
        mockPolicyEvaluator.canAccessData.mockResolvedValue(true);

        const context = mockExecutionContext(mockUser, { id: 'policy-123' });
        const result = await guard.canActivate(context as any);

        expect(result).toBe(true);
      });
    });

    describe('read operations (no ABAC check)', () => {
      it('should skip ABAC check for read operation', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(readPermission);
        mockPermissionCache.getUserPermissions.mockResolvedValue(['policy:read']);

        const context = mockExecutionContext(mockUser, { id: 'policy-123' });
        const result = await guard.canActivate(context as any);

        expect(result).toBe(true);
        expect(mockPolicyEvaluator.canAccessData).not.toHaveBeenCalled();
      });
    });
  });
});
