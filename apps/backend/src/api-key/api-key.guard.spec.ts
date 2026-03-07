import { UnauthorizedException } from '@nestjs/common';
import { mock, describe, it, expect, beforeEach, afterEach } from 'bun:test';

import { ApiKeyGuard } from './api-key.guard';
import { User, UserStatus } from '../entities/user.entity';
import { ApiKey } from '../entities/api-key.entity';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let mockReflector: { getAllAndOverride: ReturnType<typeof mock> };
  let mockApiKeyService: {
    findByKey: ReturnType<typeof mock>;
    updateLastUsed: ReturnType<typeof mock>;
  };

  const mockUser = {
    id: 'user-uuid-123',
    username: 'testuser',
    email: 'test@example.com',
    phone: null,
    passwordHash: 'hashed_password',
    nickname: null,
    avatarUrl: null,
    status: UserStatus.ACTIVE,
    locale: 'zh-CN',
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
  } as unknown as User;

  const createMockApiKey = (overrides?: Partial<ApiKey>): ApiKey => {
    return {
      id: 'api-key-uuid-123',
      name: 'Test API Key',
      key: 'hashed_key_value',
      userId: 'user-uuid-123',
      scopes: null,
      expiresAt: null,
      lastUsedAt: null,
      createdAt: new Date(),
      revokedAt: null,
      user: mockUser,
      ...overrides,
    } as ApiKey;
  };

  const mockExecutionContext = (headers: Record<string, string> = {}, user?: any) => {
    const request = {
      headers,
      user,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    };
  };

  beforeEach(() => {
    mockReflector = {
      getAllAndOverride: mock(),
    };

    mockApiKeyService = {
      findByKey: mock(),
      updateLastUsed: mock().mockResolvedValue(undefined),
    };

    guard = new ApiKeyGuard(mockReflector as any, mockApiKeyService as any);
  });

  afterEach(() => {
    (mockReflector.getAllAndOverride as ReturnType<typeof mock>).mockClear();
    (mockApiKeyService.findByKey as ReturnType<typeof mock>).mockClear();
    (mockApiKeyService.updateLastUsed as ReturnType<typeof mock>).mockClear();
  });

  afterEach(() => {
    mockReflector.getAllAndOverride.mockClear();
    mockApiKeyService.findByKey.mockClear();
    mockApiKeyService.updateLastUsed.mockClear();
  });

  describe('canActivate', () => {
    describe('metadata check', () => {
      it('should return false when route is not marked with @ApiKey()', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(false);

        const context = mockExecutionContext({ 'x-api-key': 'valid-key' });
        const result = await guard.canActivate(context as any);

        expect(result).toBe(false);
        expect(mockApiKeyService.findByKey).not.toHaveBeenCalled();
      });

      it('should return false when no metadata is present', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(undefined);

        const context = mockExecutionContext({ 'x-api-key': 'valid-key' });
        const result = await guard.canActivate(context as any);

        expect(result).toBe(false);
      });
    });

    describe('API key validation', () => {
      beforeEach(() => {
        mockReflector.getAllAndOverride.mockReturnValue(true);
      });

      it('should throw when X-API-Key header is missing', async () => {
        const context = mockExecutionContext({});

        await expect(guard.canActivate(context as any)).rejects.toThrow(
          new UnauthorizedException('API key is missing')
        );
      });

      it('should throw when API key is invalid', async () => {
        mockApiKeyService.findByKey.mockResolvedValue(null);

        const context = mockExecutionContext({ 'x-api-key': 'invalid-key' });

        await expect(guard.canActivate(context as any)).rejects.toThrow(
          new UnauthorizedException('Invalid API key')
        );
      });
    });

    describe('revocation check', () => {
      beforeEach(() => {
        mockReflector.getAllAndOverride.mockReturnValue(true);
      });

      it('should throw when API key has been revoked', async () => {
        const revokedKey = createMockApiKey({ revokedAt: new Date() });
        mockApiKeyService.findByKey.mockResolvedValue(revokedKey);

        const context = mockExecutionContext({ 'x-api-key': 'revoked-key' });

        await expect(guard.canActivate(context as any)).rejects.toThrow(
          new UnauthorizedException('API key has been revoked')
        );
      });
    });

    describe('expiration check', () => {
      beforeEach(() => {
        mockReflector.getAllAndOverride.mockReturnValue(true);
      });

      it('should throw when API key has expired', async () => {
        const expiredKey = createMockApiKey({ expiresAt: new Date(Date.now() - 1000) });
        mockApiKeyService.findByKey.mockResolvedValue(expiredKey);

        const context = mockExecutionContext({ 'x-api-key': 'expired-key' });

        await expect(guard.canActivate(context as any)).rejects.toThrow(
          new UnauthorizedException('API key has expired')
        );
      });

      it('should allow when API key has not expired yet', async () => {
        const validKey = createMockApiKey({ expiresAt: new Date(Date.now() + 3600000) });
        mockApiKeyService.findByKey.mockResolvedValue(validKey);

        const context = mockExecutionContext({ 'x-api-key': 'valid-key' });
        const result = await guard.canActivate(context as any);

        expect(result).toBe(true);
      });

      it('should allow when expiration date is not set', async () => {
        const keyWithoutExpiration = createMockApiKey({ expiresAt: null });
        mockApiKeyService.findByKey.mockResolvedValue(keyWithoutExpiration);

        const context = mockExecutionContext({ 'x-api-key': 'valid-key' });
        const result = await guard.canActivate(context as any);

        expect(result).toBe(true);
      });
    });

    describe('user validation', () => {
      beforeEach(() => {
        mockReflector.getAllAndOverride.mockReturnValue(true);
      });

      it('should throw when user is not associated with API key', async () => {
        const keyWithoutUser = createMockApiKey({ user: undefined as any });
        mockApiKeyService.findByKey.mockResolvedValue(keyWithoutUser);

        const context = mockExecutionContext({ 'x-api-key': 'valid-key' });

        await expect(guard.canActivate(context as any)).rejects.toThrow(
          new UnauthorizedException('User associated with API key not found')
        );
      });
    });

    describe('successful authentication', () => {
      beforeEach(() => {
        mockReflector.getAllAndOverride.mockReturnValue(true);
      });

      it('should authenticate successfully with valid API key', async () => {
        const validKey = createMockApiKey();
        mockApiKeyService.findByKey.mockResolvedValue(validKey);

        const context = mockExecutionContext({ 'x-api-key': 'valid-key' });
        const result = await guard.canActivate(context as any);

        expect(result).toBe(true);
        expect(mockApiKeyService.findByKey).toHaveBeenCalledWith('valid-key');
      });

      it('should inject user into request object', async () => {
        const validKey = createMockApiKey();
        mockApiKeyService.findByKey.mockResolvedValue(validKey);

        const context = mockExecutionContext({ 'x-api-key': 'valid-key' });
        await guard.canActivate(context as any);

        const request = context.switchToHttp().getRequest();
        expect(request.user).toEqual(mockUser);
      });

      it('should update lastUsedAt timestamp', async () => {
        const validKey = createMockApiKey();
        mockApiKeyService.findByKey.mockResolvedValue(validKey);

        const context = mockExecutionContext({ 'x-api-key': 'valid-key' });
        await guard.canActivate(context as any);

        expect(mockApiKeyService.updateLastUsed).toHaveBeenCalledWith('api-key-uuid-123');
      });

      it('should not block request if updateLastUsed fails', async () => {
        const validKey = createMockApiKey();
        mockApiKeyService.findByKey.mockResolvedValue(validKey);
        mockApiKeyService.updateLastUsed.mockRejectedValue(new Error('Database error'));

        const context = mockExecutionContext({ 'x-api-key': 'valid-key' });
        const result = await guard.canActivate(context as any);

        expect(result).toBe(true);
      });
    });

    describe('error handling', () => {
      beforeEach(() => {
        mockReflector.getAllAndOverride.mockReturnValue(true);
      });

      it('should rethrow UnauthorizedException as-is', async () => {
        const error = new UnauthorizedException('Custom error');
        mockApiKeyService.findByKey.mockRejectedValue(error);

        const context = mockExecutionContext({ 'x-api-key': 'valid-key' });

        await expect(guard.canActivate(context as any)).rejects.toThrow(error);
      });

      it('should wrap unexpected errors in UnauthorizedException', async () => {
        mockApiKeyService.findByKey.mockRejectedValue(new Error('Unexpected error'));

        const context = mockExecutionContext({ 'x-api-key': 'valid-key' });

        await expect(guard.canActivate(context as any)).rejects.toThrow(
          new UnauthorizedException('API key validation failed')
        );
      });
    });

    describe('edge cases', () => {
      beforeEach(() => {
        mockReflector.getAllAndOverride.mockReturnValue(true);
      });

      it('should handle empty string API key', async () => {
        const context = mockExecutionContext({ 'x-api-key': '' });

        await expect(guard.canActivate(context as any)).rejects.toThrow(
          new UnauthorizedException('API key is missing')
        );
      });

      it('should handle API key with whitespace', async () => {
        mockApiKeyService.findByKey.mockResolvedValue(null);

        const context = mockExecutionContext({ 'x-api-key': '   ' });

        await expect(guard.canActivate(context as any)).rejects.toThrow(
          new UnauthorizedException('Invalid API key')
        );
      });

      it('should handle case-sensitive API key header', async () => {
        const validKey = createMockApiKey();
        mockApiKeyService.findByKey.mockResolvedValue(validKey);

        const context = mockExecutionContext({ 'X-API-KEY': 'should-not-work' });

        await expect(guard.canActivate(context as any)).rejects.toThrow(
          new UnauthorizedException('API key is missing')
        );
      });
    });
  });
});
