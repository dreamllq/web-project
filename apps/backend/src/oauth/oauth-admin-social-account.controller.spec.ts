import { describe, it, expect, beforeEach, mock, afterEach } from 'bun:test';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AUDIT_LOG_KEY, AuditLogMetadata } from '../audit/decorators/audit-log.decorator';
import {
  PERMISSION_KEY,
  PermissionMetadata,
} from '../policy/decorators/require-permission.decorator';

describe('OAuthAdminController - Social Account Management', () => {
  let controller: any;
  let socialAccountService: any;

  const mockUser = {
    id: 'user-uuid-123',
    username: 'testuser',
    email: 'test@example.com',
    phone: '+1234567890',
    passwordHash: 'hashedpassword',
    nickname: 'Test User',
    avatarUrl: 'http://example.com/avatar.jpg',
    status: 'active',
    locale: 'zh-CN',
    lastLoginAt: new Date(),
    lastLoginIp: '192.168.1.1',
    emailVerifiedAt: new Date(),
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

  const mockSocialAccount = {
    id: 'social-account-uuid-123',
    userId: 'user-uuid-123',
    provider: 'wechat',
    providerUserId: 'wechat-openid-123',
    providerData: { nickname: '微信用户' },
    accessToken: 'access-token-xyz',
    refreshToken: 'refresh-token-xyz',
    status: 'linked',
    createdAt: new Date(),
    updatedAt: new Date(),
    tokenExpiresAt: new Date(Date.now() + 3600000),
    unboundAt: null,
    user: mockUser,
  };

  const mockSocialAccountDetail = {
    id: 'social-account-uuid-123',
    userId: 'user-uuid-123',
    provider: 'wechat',
    providerUserId: 'wechat-openid-123',
    providerData: { nickname: '微信用户' },
    status: 'linked',
    createdAt: new Date(),
    updatedAt: new Date(),
    user: {
      id: 'user-uuid-123',
      username: 'testuser',
      email: 'test@example.com',
    },
    loginHistory: {
      lastLoginAt: new Date(),
      lastLoginIp: '192.168.1.1',
      loginCount: 5,
    },
  };

  const mockSocialAccountService = {
    list: mock(async () => ({ data: [mockSocialAccount], total: 1 })),
    findById: mock(async () => mockSocialAccount),
    getDetail: mock(async () => mockSocialAccountDetail),
    unlink: mock(async () => ({ ...mockSocialAccount, status: 'unlinked' })),
    batchUnlink: mock(async () => ({
      success: ['social-account-uuid-123'],
      failed: [],
      errors: [],
    })),
    toResponse: mock((account: any) => ({
      id: account.id,
      userId: account.userId,
      provider: account.provider,
      providerUserId: account.providerUserId,
      providerData: account.providerData,
      status: account.status,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    })),
  };

  class MockOAuthAdminController {
    constructor(private readonly socialAccountService: any) {}

    async listSocialAccounts(query: any) {
      const result = await this.socialAccountService.list(query);
      return result;
    }

    async getSocialAccount(id: string) {
      const account = await this.socialAccountService.findById(id);
      if (!account) {
        throw new NotFoundException('Social account not found');
      }
      return account;
    }

    async getSocialAccountDetail(id: string) {
      return this.socialAccountService.getDetail(id);
    }

    async unlinkSocialAccount(id: string) {
      return this.socialAccountService.unlink(id);
    }

    async batchUnlinkSocialAccounts(dto: { ids: string[] }) {
      return this.socialAccountService.batchUnlink(dto.ids);
    }
  }

  Reflect.defineMetadata(
    PERMISSION_KEY,
    { resource: 'social-account', action: 'read' },
    MockOAuthAdminController.prototype.listSocialAccounts
  );
  Reflect.defineMetadata(
    PERMISSION_KEY,
    { resource: 'social-account', action: 'read' },
    MockOAuthAdminController.prototype.getSocialAccount
  );
  Reflect.defineMetadata(
    PERMISSION_KEY,
    { resource: 'social-account', action: 'read' },
    MockOAuthAdminController.prototype.getSocialAccountDetail
  );
  Reflect.defineMetadata(
    PERMISSION_KEY,
    { resource: 'social-account', action: 'delete' },
    MockOAuthAdminController.prototype.unlinkSocialAccount
  );
  Reflect.defineMetadata(
    PERMISSION_KEY,
    { resource: 'social-account', action: 'delete' },
    MockOAuthAdminController.prototype.batchUnlinkSocialAccounts
  );
  Reflect.defineMetadata(
    AUDIT_LOG_KEY,
    { action: 'unlink', resourceType: 'social-account' },
    MockOAuthAdminController.prototype.unlinkSocialAccount
  );
  Reflect.defineMetadata(
    AUDIT_LOG_KEY,
    { action: 'batch-unlink', resourceType: 'social-account' },
    MockOAuthAdminController.prototype.batchUnlinkSocialAccounts
  );

  beforeEach(() => {
    controller = new MockOAuthAdminController(mockSocialAccountService);
    socialAccountService = mockSocialAccountService;
  });

  afterEach(() => {
    Object.values(mockSocialAccountService).forEach((fn: any) => fn.mockClear());
  });

  describe('GET /admin/social-accounts', () => {
    it('should return paginated list of social accounts', async () => {
      const query = { limit: 20, offset: 0 };
      const result = await controller.listSocialAccounts(query);

      expect(socialAccountService.list).toHaveBeenCalledWith(query);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by provider', async () => {
      const query = { provider: 'wechat', limit: 20, offset: 0 };
      socialAccountService.list.mockResolvedValueOnce({ data: [mockSocialAccount], total: 1 });

      const result = await controller.listSocialAccounts(query);

      expect(socialAccountService.list).toHaveBeenCalledWith(query);
      expect(result.data[0].provider).toBe('wechat');
    });

    it('should filter by userId', async () => {
      const query = { userId: 'user-uuid-123', limit: 20, offset: 0 };
      socialAccountService.list.mockResolvedValueOnce({ data: [mockSocialAccount], total: 1 });

      const result = await controller.listSocialAccounts(query);

      expect(socialAccountService.list).toHaveBeenCalledWith(query);
      expect(result.data[0].userId).toBe('user-uuid-123');
    });

    it('should search by keyword', async () => {
      const query = { keyword: 'test', limit: 20, offset: 0 };
      socialAccountService.list.mockResolvedValueOnce({ data: [mockSocialAccount], total: 1 });

      await controller.listSocialAccounts(query);

      expect(socialAccountService.list).toHaveBeenCalledWith(query);
    });

    it('should use default pagination values', async () => {
      const query = {};
      socialAccountService.list.mockResolvedValueOnce({ data: [mockSocialAccount], total: 1 });

      await controller.listSocialAccounts(query);

      expect(socialAccountService.list).toHaveBeenCalledWith({
        limit: 20,
        offset: 0,
        ...query,
      });
    });

    it('should have @RequirePermission(social-account, read)', () => {
      const metadata = Reflect.getMetadata(
        PERMISSION_KEY,
        controller.listSocialAccounts
      ) as PermissionMetadata;
      expect(metadata).toEqual({ resource: 'social-account', action: 'read' });
    });
  });

  describe('GET /admin/social-accounts/:id', () => {
    it('should return a social account by id', async () => {
      const result = await controller.getSocialAccount('social-account-uuid-123');

      expect(socialAccountService.findById).toHaveBeenCalledWith('social-account-uuid-123');
      expect(result).toEqual(mockSocialAccount);
    });

    it('should throw NotFoundException when social account not found', async () => {
      socialAccountService.findById.mockResolvedValueOnce(null);

      await expect(controller.getSocialAccount('non-existent-id')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should have @RequirePermission(social-account, read)', () => {
      const metadata = Reflect.getMetadata(
        PERMISSION_KEY,
        controller.getSocialAccount
      ) as PermissionMetadata;
      expect(metadata).toEqual({ resource: 'social-account', action: 'read' });
    });
  });

  describe('GET /admin/social-accounts/:id/detail', () => {
    it('should return detailed social account information with login history', async () => {
      const result = await controller.getSocialAccountDetail('social-account-uuid-123');

      expect(socialAccountService.getDetail).toHaveBeenCalledWith('social-account-uuid-123');
      expect(result).toEqual(mockSocialAccountDetail);
      expect(result.user).toBeDefined();
      expect(result.loginHistory).toBeDefined();
    });

    it('should throw NotFoundException when social account not found', async () => {
      socialAccountService.getDetail.mockRejectedValueOnce(
        new NotFoundException('Social account not found')
      );

      await expect(controller.getSocialAccountDetail('non-existent-id')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should have @RequirePermission(social-account, read)', () => {
      const metadata = Reflect.getMetadata(
        PERMISSION_KEY,
        controller.getSocialAccountDetail
      ) as PermissionMetadata;
      expect(metadata).toEqual({ resource: 'social-account', action: 'read' });
    });
  });

  describe('DELETE /admin/social-accounts/:id', () => {
    it('should unlink a social account successfully', async () => {
      await controller.unlinkSocialAccount('social-account-uuid-123');

      expect(socialAccountService.unlink).toHaveBeenCalledWith('social-account-uuid-123');
    });

    it('should throw NotFoundException when social account not found', async () => {
      socialAccountService.unlink.mockRejectedValueOnce(
        new NotFoundException('Social account not found')
      );

      await expect(controller.unlinkSocialAccount('non-existent-id')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw BadRequestException when account already unlinked', async () => {
      socialAccountService.unlink.mockRejectedValueOnce(
        new BadRequestException('Social account already unlinked')
      );

      await expect(controller.unlinkSocialAccount('social-account-uuid-123')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should have @RequirePermission(social-account, delete)', () => {
      const metadata = Reflect.getMetadata(
        PERMISSION_KEY,
        controller.unlinkSocialAccount
      ) as PermissionMetadata;
      expect(metadata).toEqual({ resource: 'social-account', action: 'delete' });
    });

    it('should have @AuditLog(unlink, social-account)', () => {
      const metadata = Reflect.getMetadata(
        AUDIT_LOG_KEY,
        controller.unlinkSocialAccount
      ) as AuditLogMetadata;
      expect(metadata).toEqual({ action: 'unlink', resourceType: 'social-account' });
    });
  });

  describe('POST /admin/social-accounts/batch/unlink', () => {
    it('should batch unlink social accounts successfully', async () => {
      const dto = { ids: ['id-1', 'id-2', 'id-3'] };
      const mockResult = {
        success: ['id-1', 'id-2'],
        failed: ['id-3'],
        errors: ['Failed to unlink id-3: Cannot unlink the only authentication method'],
      };
      socialAccountService.batchUnlink.mockResolvedValueOnce(mockResult);

      const result = await controller.batchUnlinkSocialAccounts(dto);

      expect(socialAccountService.batchUnlink).toHaveBeenCalledWith(dto.ids);
      expect(result).toEqual(mockResult);
    });

    it('should throw BadRequestException when ids exceed 50', async () => {
      const ids = Array.from({ length: 51 }, (_, i) => `id-${i}`);
      const dto = { ids };
      socialAccountService.batchUnlink.mockRejectedValueOnce(
        new BadRequestException('Cannot unlink more than 50 accounts at once')
      );

      await expect(controller.batchUnlinkSocialAccounts(dto)).rejects.toThrow(BadRequestException);
    });

    it('should handle empty ids array', async () => {
      const dto = { ids: [] };
      const mockResult = {
        success: [],
        failed: [],
        errors: [],
      };
      socialAccountService.batchUnlink.mockResolvedValueOnce(mockResult);

      const result = await controller.batchUnlinkSocialAccounts(dto);

      expect(socialAccountService.batchUnlink).toHaveBeenCalledWith([]);
      expect(result.success).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
    });

    it('should return mixed results when some accounts fail to unlink', async () => {
      const dto = { ids: ['id-1', 'id-2', 'id-3', 'id-4'] };
      const mockResult = {
        success: ['id-1', 'id-2'],
        failed: ['id-3', 'id-4'],
        errors: [
          'Failed to unlink id-3: Account not found',
          'Failed to unlink id-4: Cannot unlink the only authentication method',
        ],
      };
      socialAccountService.batchUnlink.mockResolvedValueOnce(mockResult);

      const result = await controller.batchUnlinkSocialAccounts(dto);

      expect(result.success).toHaveLength(2);
      expect(result.failed).toHaveLength(2);
      expect(result.errors).toHaveLength(2);
    });

    it('should have @RequirePermission(social-account, delete)', () => {
      const metadata = Reflect.getMetadata(
        PERMISSION_KEY,
        controller.batchUnlinkSocialAccounts
      ) as PermissionMetadata;
      expect(metadata).toEqual({ resource: 'social-account', action: 'delete' });
    });

    it('should have @AuditLog(batch-unlink, social-account)', () => {
      const metadata = Reflect.getMetadata(
        AUDIT_LOG_KEY,
        controller.batchUnlinkSocialAccounts
      ) as AuditLogMetadata;
      expect(metadata).toEqual({ action: 'batch-unlink', resourceType: 'social-account' });
    });
  });
});
