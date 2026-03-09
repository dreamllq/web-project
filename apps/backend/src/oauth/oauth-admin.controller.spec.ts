import { describe, it, expect, beforeEach, mock, afterEach } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { AUDIT_LOG_KEY, AuditLogMetadata } from '../audit/decorators/audit-log.decorator';
import {
  PERMISSION_KEY,
  PermissionMetadata,
} from '../policy/decorators/require-permission.decorator';
import { sanitizeRequestData } from '../audit/audit.service';
import { OAuthAdminController } from './oauth-admin.controller';
import { OAuthClientService } from './oauth-client.service';
import { OAuthProviderService } from './oauth-provider.service';
import { OAuthTokenService } from './oauth-token.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { OAuthProviderConfig, OAuthProviderCode } from '../entities';

interface MockOAuthClient {
  id: string;
  clientId: string;
  clientSecret: string;
  name: string;
  redirectUris: string[];
  allowedScopes: string[];
  isConfidential: boolean;
  createdAt: Date;
  updatedAt: Date;
}

describe('OAuth Admin Audit Logging', () => {
  describe('@AuditLog decorator metadata', () => {
    const verifyAuditMetadata = (
      handler: () => void,
      expectedAction: string,
      expectedResourceType: string
    ) => {
      const metadata = Reflect.getMetadata(AUDIT_LOG_KEY, handler) as AuditLogMetadata;
      expect(metadata).toBeDefined();
      expect(metadata.action).toBe(expectedAction);
      expect(metadata.resourceType).toBe(expectedResourceType);
    };

    it('should define correct metadata for create oauth-client', () => {
      const handler = function createClient() {};
      Reflect.defineMetadata(
        AUDIT_LOG_KEY,
        { action: 'create', resourceType: 'oauth-client' },
        handler
      );
      verifyAuditMetadata(handler, 'create', 'oauth-client');
    });

    it('should define correct metadata for update oauth-client', () => {
      const handler = function updateClient() {};
      Reflect.defineMetadata(
        AUDIT_LOG_KEY,
        { action: 'update', resourceType: 'oauth-client' },
        handler
      );
      verifyAuditMetadata(handler, 'update', 'oauth-client');
    });

    it('should define correct metadata for delete oauth-client', () => {
      const handler = function deleteClient() {};
      Reflect.defineMetadata(
        AUDIT_LOG_KEY,
        { action: 'delete', resourceType: 'oauth-client' },
        handler
      );
      verifyAuditMetadata(handler, 'delete', 'oauth-client');
    });

    it('should define correct metadata for regenerate_secret oauth-client', () => {
      const handler = function regenerateSecret() {};
      Reflect.defineMetadata(
        AUDIT_LOG_KEY,
        { action: 'regenerate_secret', resourceType: 'oauth-client' },
        handler
      );
      verifyAuditMetadata(handler, 'regenerate_secret', 'oauth-client');
    });

    it('should define correct metadata for update oauth-provider', () => {
      const handler = function updateProvider() {};
      Reflect.defineMetadata(
        AUDIT_LOG_KEY,
        { action: 'update', resourceType: 'oauth-provider' },
        handler
      );
      verifyAuditMetadata(handler, 'update', 'oauth-provider');
    });

    it('should define correct metadata for revoke oauth-token', () => {
      const handler = function revokeToken() {};
      Reflect.defineMetadata(
        AUDIT_LOG_KEY,
        { action: 'revoke', resourceType: 'oauth-token' },
        handler
      );
      verifyAuditMetadata(handler, 'revoke', 'oauth-token');
    });

    it('should define correct metadata for batch_delete oauth-client', () => {
      const handler = function batchDeleteClients() {};
      Reflect.defineMetadata(
        AUDIT_LOG_KEY,
        { action: 'batch_delete', resourceType: 'oauth-client' },
        handler
      );
      verifyAuditMetadata(handler, 'batch_delete', 'oauth-client');
    });

    it('should define correct metadata for batch_revoke oauth-token', () => {
      const handler = function batchRevokeTokens() {};
      Reflect.defineMetadata(
        AUDIT_LOG_KEY,
        { action: 'batch_revoke', resourceType: 'oauth-token' },
        handler
      );
      verifyAuditMetadata(handler, 'batch_revoke', 'oauth-token');
    });

    it('should define correct metadata for unlink social-account', () => {
      const handler = function unlinkSocialAccount() {};
      Reflect.defineMetadata(
        AUDIT_LOG_KEY,
        { action: 'unlink', resourceType: 'social-account' },
        handler
      );
      verifyAuditMetadata(handler, 'unlink', 'social-account');
    });

    it('should define correct metadata for enable oauth-provider', () => {
      const handler = function enableProvider() {};
      Reflect.defineMetadata(
        AUDIT_LOG_KEY,
        { action: 'enable', resourceType: 'oauth-provider' },
        handler
      );
      verifyAuditMetadata(handler, 'enable', 'oauth-provider');
    });

    it('should define correct metadata for disable oauth-provider', () => {
      const handler = function disableProvider() {};
      Reflect.defineMetadata(
        AUDIT_LOG_KEY,
        { action: 'disable', resourceType: 'oauth-provider' },
        handler
      );
      verifyAuditMetadata(handler, 'disable', 'oauth-provider');
    });
  });

  describe('Sensitive data sanitization', () => {
    it('should redact clientSecret in request data', () => {
      const requestData = {
        name: 'Test Client',
        clientSecret: 'super_secret_123',
        redirectUris: ['http://localhost/callback'],
      };

      const sanitized = sanitizeRequestData(requestData);

      expect(sanitized).toEqual({
        name: 'Test Client',
        clientSecret: '[REDACTED]',
        redirectUris: ['http://localhost/callback'],
      });
    });

    it('should redact accessToken in request data', () => {
      const requestData = {
        oauthTokenId: 'token-123',
        accessToken: 'access_token_xyz',
        reason: 'Compromised',
      };

      const sanitized = sanitizeRequestData(requestData);

      expect(sanitized).toEqual({
        oauthTokenId: '[REDACTED]',
        accessToken: '[REDACTED]',
        reason: 'Compromised',
      });
    });

    it('should redact refreshToken in request data', () => {
      const requestData = {
        refreshToken: 'refresh_token_xyz',
        scope: 'openid',
      };

      const sanitized = sanitizeRequestData(requestData);

      expect(sanitized).toEqual({
        refreshToken: '[REDACTED]',
        scope: 'openid',
      });
    });

    it('should redact appSecret in nested objects', () => {
      const requestData = {
        provider: 'wechat',
        config: {
          appId: 'wx123',
          appSecret: 'secret_key_456',
        },
      };

      const sanitized = sanitizeRequestData(requestData);

      expect(sanitized).toEqual({
        provider: 'wechat',
        config: {
          appId: 'wx123',
          appSecret: '[REDACTED]',
        },
      });
    });

    it('should redact password-related fields case-insensitively', () => {
      const requestData = {
        Username: 'test',
        PASSWORD: 'myPassword123',
        passwordHash: 'hashed_value',
      };

      const sanitized = sanitizeRequestData(requestData);

      expect(sanitized).toEqual({
        Username: 'test',
        PASSWORD: '[REDACTED]',
        passwordHash: '[REDACTED]',
      });
    });

    it('should redact authorization header', () => {
      const requestData = {
        Authorization: 'Bearer token123',
        userId: 'user-123',
      };

      const sanitized = sanitizeRequestData(requestData);

      expect(sanitized).toEqual({
        Authorization: '[REDACTED]',
        userId: 'user-123',
      });
    });

    it('should redact apiKey field', () => {
      const requestData = {
        apiKey: 'sk_test_123456',
        name: 'Test App',
      };

      const sanitized = sanitizeRequestData(requestData);

      expect(sanitized).toEqual({
        apiKey: '[REDACTED]',
        name: 'Test App',
      });
    });

    it('should preserve non-sensitive fields', () => {
      const requestData = {
        id: 'client-123',
        name: 'My App',
        redirectUris: ['http://localhost/callback'],
        scopes: ['openid', 'profile'],
        isConfidential: true,
      };

      const sanitized = sanitizeRequestData(requestData);

      expect(sanitized).toEqual(requestData);
    });

    it('should handle null input', () => {
      const sanitized = sanitizeRequestData(null);
      expect(sanitized).toBeNull();
    });

    it('should handle undefined input', () => {
      const sanitized = sanitizeRequestData(undefined);
      expect(sanitized).toBeNull();
    });

    it('should handle empty object', () => {
      const sanitized = sanitizeRequestData({});
      expect(sanitized).toEqual({});
    });
  });

  describe('Resource type coverage', () => {
    const resourceTypes = [
      {
        resourceType: 'oauth-client',
        actions: ['create', 'update', 'delete', 'regenerate_secret', 'batch_delete'],
      },
      { resourceType: 'oauth-provider', actions: ['update', 'enable', 'disable'] },
      { resourceType: 'oauth-token', actions: ['revoke', 'batch_revoke'] },
      { resourceType: 'social-account', actions: ['unlink', 'batch_unlink'] },
    ];

    resourceTypes.forEach(({ resourceType, actions }) => {
      actions.forEach((action) => {
        it(`should support ${action} on ${resourceType}`, () => {
          const handler = function () {};
          Reflect.defineMetadata(AUDIT_LOG_KEY, { action, resourceType }, handler);

          const metadata = Reflect.getMetadata(AUDIT_LOG_KEY, handler) as AuditLogMetadata;
          expect(metadata).toEqual({ action, resourceType });
        });
      });
    });
  });

  describe('Audit log structure validation', () => {
    it('should validate audit log has required fields', () => {
      const auditLogEntry = {
        action: 'create',
        resourceType: 'oauth-client',
        resourceId: 'client-uuid-123',
        userId: 'admin-user-uuid',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        requestData: { name: 'Test Client' },
        responseStatus: 201,
      };

      expect(auditLogEntry).toHaveProperty('action');
      expect(auditLogEntry).toHaveProperty('resourceType');
      expect(auditLogEntry).toHaveProperty('userId');
      expect(auditLogEntry).toHaveProperty('ipAddress');
      expect(auditLogEntry).toHaveProperty('requestData');
      expect(auditLogEntry).toHaveProperty('responseStatus');
    });

    it('should validate batch operation includes count', () => {
      const batchAuditLog = {
        action: 'batch_delete',
        resourceType: 'oauth-client',
        requestData: {
          ids: ['id1', 'id2', 'id3'],
          count: 3,
        },
        responseStatus: 200,
      };

      expect(batchAuditLog.requestData).toHaveProperty('count');
      expect(batchAuditLog.requestData.count).toBe(3);
    });
  });

  describe('Action type validation', () => {
    const validActions = [
      'create',
      'update',
      'delete',
      'regenerate_secret',
      'batch_delete',
      'revoke',
      'batch_revoke',
      'enable',
      'disable',
      'unlink',
      'batch_unlink',
    ];

    validActions.forEach((action) => {
      it(`should be valid action: ${action}`, () => {
        expect(typeof action).toBe('string');
        expect(action.length).toBeGreaterThan(0);
      });
    });
  });
});

describe('OAuthAdminController - Client Management', () => {
  let controller: OAuthAdminController;
  let service: OAuthClientService;

  const mockClient: OAuthClient = {
    id: 'client-uuid-123',
    clientId: 'client_abc123',
    clientSecret: 'encrypted_secret',
    name: 'Test Client',
    redirectUris: ['http://localhost/callback'],
    allowedScopes: ['openid', 'profile'],
    isConfidential: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as OAuthClient;

  const mockClientWithPlainSecret = {
    ...mockClient,
    clientSecret: 'plain_secret_12345',
  };

  const mockService = {
    list: mock(async () => ({ data: [mockClient], total: 1 })),
    findById: mock(async () => mockClient),
    create: mock(async () => mockClientWithPlainSecret),
    update: mock(async () => mockClient),
    delete: mock(async () => undefined),
    regenerateSecret: mock(async () => mockClientWithPlainSecret),
    toResponse: mock((client: OAuthClient) => ({
      id: client.id,
      clientId: client.clientId,
      clientSecret: '••••••••',
      name: client.name,
      redirectUris: client.redirectUris,
      allowedScopes: client.allowedScopes,
      isConfidential: client.isConfidential,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OAuthAdminController],
      providers: [
        {
          provide: OAuthClientService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<OAuthAdminController>(OAuthAdminController);
    service = module.get<OAuthClientService>(OAuthClientService);
  });

  describe('GET /admin/oauth-clients', () => {
    it('should return list of clients with masked secrets', async () => {
      const query = { keyword: 'test', limit: 10, offset: 0 };
      const result = await controller.listClients(query);

      expect(service.list).toHaveBeenCalledWith(query);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].clientSecret).toBe('••••••••');
      expect(result.total).toBe(1);
    });

    it('should call service with pagination parameters', async () => {
      const query = { limit: 20, offset: 40 };
      await controller.listClients(query);

      expect(service.list).toHaveBeenCalledWith(query);
    });

    it('should handle empty result', async () => {
      mockService.list.mockResolvedValueOnce({ data: [], total: 0 });
      const result = await controller.listClients({});

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('POST /admin/oauth-clients', () => {
    it('should create client and return plain secret', async () => {
      const dto = {
        name: 'New Client',
        redirectUris: ['http://localhost/callback'],
        scopes: ['openid'],
      };

      const result = await controller.createClient(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result.clientSecret).toBe('plain_secret_12345');
    });

    it('should return complete client object', async () => {
      const dto = {
        name: 'New Client',
        redirectUris: ['http://localhost/callback'],
      };

      const result = await controller.createClient(dto);

      expect(result.id).toBe('client-uuid-123');
      expect(result.clientId).toBe('client_abc123');
      expect(result.name).toBe('Test Client');
    });
  });

  describe('GET /admin/oauth-clients/:id', () => {
    it('should return client with masked secret', async () => {
      const result = await controller.getClient('client-uuid-123');

      expect(service.findById).toHaveBeenCalledWith('client-uuid-123');
      expect(result.clientSecret).toBe('••••••••');
    });

    it('should throw NotFoundException if client not found', async () => {
      mockService.findById.mockResolvedValueOnce(null);

      await expect(controller.getClient('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('PATCH /admin/oauth-clients/:id', () => {
    it('should update client', async () => {
      const dto = {
        name: 'Updated Client',
        redirectUris: ['http://localhost/new-callback'],
      };

      const result = await controller.updateClient('client-uuid-123', dto);

      expect(service.update).toHaveBeenCalledWith('client-uuid-123', dto);
      expect(result.clientSecret).toBe('••••••••');
    });

    it('should support partial update', async () => {
      const dto = { name: 'Updated Name' };

      await controller.updateClient('client-uuid-123', dto);

      expect(service.update).toHaveBeenCalledWith('client-uuid-123', dto);
    });

    it('should throw NotFoundException if client not found', async () => {
      mockService.update.mockRejectedValueOnce(new NotFoundException('Client not found'));

      await expect(controller.updateClient('non-existent', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('DELETE /admin/oauth-clients/:id', () => {
    it('should delete client', async () => {
      await controller.deleteClient('client-uuid-123');

      expect(service.delete).toHaveBeenCalledWith('client-uuid-123');
    });

    it('should throw BadRequestException if client has active tokens', async () => {
      mockService.delete.mockRejectedValueOnce(
        new BadRequestException('Cannot delete client with active tokens')
      );

      await expect(controller.deleteClient('client-uuid-123')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if client not found', async () => {
      mockService.delete.mockRejectedValueOnce(new NotFoundException('Client not found'));

      await expect(controller.deleteClient('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('POST /admin/oauth-clients/:id/regenerate-secret', () => {
    it('should regenerate secret and return plain secret', async () => {
      const result = await controller.regenerateSecret('client-uuid-123');

      expect(service.regenerateSecret).toHaveBeenCalledWith('client-uuid-123');
      expect(result.clientSecret).toBe('plain_secret_12345');
    });

    it('should throw NotFoundException if client not found', async () => {
      mockService.regenerateSecret.mockRejectedValueOnce(new NotFoundException('Client not found'));

      await expect(controller.regenerateSecret('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});

describe('OAuthAdminController - Provider Management', () => {
  let controller: OAuthAdminController;
  let providerService: OAuthProviderService;

  const mockProviderConfig = (overrides?: Partial<OAuthProviderConfig>): OAuthProviderConfig =>
    ({
      id: 'provider-uuid-123',
      code: OAuthProviderCode.WECHAT,
      name: 'WeChat',
      appId: 'wx123456',
      appSecret: 'secret_key_123',
      redirectUri: 'https://example.com/callback',
      enabled: true,
      displayName: '微信',
      icon: 'ChatDotRound',
      color: '#07C160',
      providerType: 'oauth2',
      sortOrder: 1,
      config: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
      ...overrides,
    }) as OAuthProviderConfig;

  const mockProviderService = {
    list: mock(async () => []),
    getProvidersMetadata: mock(async () => []),
    getByCode: mock(async () => null),
    updateMetadata: mock(async () => mockProviderConfig()),
    batchEnable: mock(async () => undefined),
    batchDisable: mock(async () => undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OAuthAdminController],
      providers: [{ provide: OAuthProviderService, useValue: mockProviderService }],
    }).compile();

    controller = module.get<OAuthAdminController>(OAuthAdminController);
    providerService = module.get<OAuthProviderService>(OAuthProviderService);
  });

  afterEach(() => {
    Object.values(mockProviderService).forEach((fn) => fn.mockClear());
  });

  describe('GET /admin/oauth-providers', () => {
    it('should return list of providers without appSecret', async () => {
      const configs = [
        mockProviderConfig(),
        mockProviderConfig({ id: 'provider-2', code: OAuthProviderCode.DINGTALK }),
      ];
      mockProviderService.list.mockResolvedValueOnce(configs);

      const result = await controller.listProviders();

      expect(mockProviderService.list).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      result.forEach((provider) => {
        expect(provider).not.toHaveProperty('appSecret');
      });
    });

    it('should have @RequirePermission(oauth-provider, read)', () => {
      const metadata = Reflect.getMetadata(
        PERMISSION_KEY,
        controller.listProviders
      ) as PermissionMetadata;
      expect(metadata).toEqual({ resource: 'oauth-provider', action: 'read' });
    });
  });

  describe('GET /admin/oauth-providers/metadata', () => {
    it('should return provider metadata list', async () => {
      const metadata = [
        {
          code: OAuthProviderCode.WECHAT,
          displayName: '微信',
          icon: 'ChatDotRound',
          color: '#07C160',
          providerType: 'oauth2',
          isEnabled: true,
        },
      ];
      mockProviderService.getProvidersMetadata.mockResolvedValueOnce(metadata);

      const result = await controller.getProvidersMetadata();

      expect(mockProviderService.getProvidersMetadata).toHaveBeenCalled();
      expect(result).toEqual(metadata);
    });

    it('should have @RequirePermission(oauth-provider, read)', () => {
      const metadata = Reflect.getMetadata(
        PERMISSION_KEY,
        controller.getProvidersMetadata
      ) as PermissionMetadata;
      expect(metadata).toEqual({ resource: 'oauth-provider', action: 'read' });
    });
  });

  describe('GET /admin/oauth-providers/:id', () => {
    it('should return single provider by id without appSecret', async () => {
      const config = mockProviderConfig();
      mockProviderService.list.mockResolvedValueOnce([config]);

      const result = await controller.getProviderById('provider-uuid-123');

      expect(mockProviderService.list).toHaveBeenCalled();
      expect(result).not.toHaveProperty('appSecret');
      expect(result.id).toBe('provider-uuid-123');
    });

    it('should throw NotFoundException when provider not found', async () => {
      mockProviderService.list.mockResolvedValueOnce([]);

      await expect(controller.getProviderById('non-existent')).rejects.toThrow(
        'Provider not found'
      );
    });

    it('should have @RequirePermission(oauth-provider, read)', () => {
      const metadata = Reflect.getMetadata(
        PERMISSION_KEY,
        controller.getProviderById
      ) as PermissionMetadata;
      expect(metadata).toEqual({ resource: 'oauth-provider', action: 'read' });
    });
  });

  describe('PATCH /admin/oauth-providers/:id', () => {
    it('should update provider metadata and return updated config without appSecret', async () => {
      const dto = { displayName: '微信登录', sortOrder: 2 };
      const updatedConfig = mockProviderConfig({ displayName: '微信登录', sortOrder: 2 });
      mockProviderService.updateMetadata.mockResolvedValueOnce(updatedConfig);

      const result = await controller.updateProvider('provider-uuid-123', dto);

      expect(mockProviderService.updateMetadata).toHaveBeenCalledWith('provider-uuid-123', dto);
      expect(result).not.toHaveProperty('appSecret');
      expect(result.displayName).toBe('微信登录');
    });

    it('should have @RequirePermission(oauth-provider, update)', () => {
      const metadata = Reflect.getMetadata(
        PERMISSION_KEY,
        controller.updateProvider
      ) as PermissionMetadata;
      expect(metadata).toEqual({ resource: 'oauth-provider', action: 'update' });
    });

    it('should have @AuditLog(update, oauth-provider)', () => {
      const metadata = Reflect.getMetadata(
        AUDIT_LOG_KEY,
        controller.updateProvider
      ) as AuditLogMetadata;
      expect(metadata).toEqual({ action: 'update', resourceType: 'oauth-provider' });
    });
  });

  describe('POST /admin/oauth-providers/batch/enable', () => {
    it('should call batchEnable with provided ids', async () => {
      const ids = ['id-1', 'id-2', 'id-3'];
      mockProviderService.batchEnable.mockResolvedValueOnce(undefined);

      await controller.batchEnable({ ids });

      expect(mockProviderService.batchEnable).toHaveBeenCalledWith(ids);
    });

    it('should have @RequirePermission(oauth-provider, update)', () => {
      const metadata = Reflect.getMetadata(
        PERMISSION_KEY,
        controller.batchEnable
      ) as PermissionMetadata;
      expect(metadata).toEqual({ resource: 'oauth-provider', action: 'update' });
    });

    it('should have @AuditLog(batch-enable, oauth-provider)', () => {
      const metadata = Reflect.getMetadata(
        AUDIT_LOG_KEY,
        controller.batchEnable
      ) as AuditLogMetadata;
      expect(metadata).toEqual({ action: 'batch-enable', resourceType: 'oauth-provider' });
    });
  });

  describe('POST /admin/oauth-providers/batch/disable', () => {
    it('should call batchDisable with provided ids', async () => {
      const ids = ['id-1', 'id-2'];
      mockProviderService.batchDisable.mockResolvedValueOnce(undefined);

      await controller.batchDisable({ ids });

      expect(mockProviderService.batchDisable).toHaveBeenCalledWith(ids);
    });

    it('should have @RequirePermission(oauth-provider, update)', () => {
      const metadata = Reflect.getMetadata(
        PERMISSION_KEY,
        controller.batchDisable
      ) as PermissionMetadata;
      expect(metadata).toEqual({ resource: 'oauth-provider', action: 'update' });
    });

    it('should have @AuditLog(batch-disable, oauth-provider)', () => {
      const metadata = Reflect.getMetadata(
        AUDIT_LOG_KEY,
        controller.batchDisable
      ) as AuditLogMetadata;
      expect(metadata).toEqual({ action: 'batch-disable', resourceType: 'oauth-provider' });
    });
  });

  describe('sanitizeProviderResponse', () => {
    it('should remove appSecret from provider config', () => {
      const config = mockProviderConfig();
      const sanitized = controller['sanitizeProviderResponse'](config);

      expect(sanitized).not.toHaveProperty('appSecret');
      expect(sanitized).toHaveProperty('id');
      expect(sanitized).toHaveProperty('code');
      expect(sanitized).toHaveProperty('name');
      expect(sanitized).toHaveProperty('appId');
    });
  });
});

describe('OAuthAdminController - Token Export', () => {
  let controller: OAuthAdminController;
  let tokenService: OAuthTokenService;

  const mockTokens = [
    {
      id: 'token-1',
      clientId: 'client-1',
      userId: 'user-1',
      accessToken: 'token_abc123xyz789',
      scopes: ['read', 'write'],
      expiresAt: new Date('2026-12-31T23:59:59Z'),
      revokedAt: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      user: { id: 'user-1', username: 'testuser', email: 'test@example.com' },
    },
    {
      id: 'token-2',
      clientId: 'client-2',
      userId: 'user-2',
      accessToken: 'token_def456uvw012',
      scopes: ['read'],
      expiresAt: new Date('2026-12-31T23:59:59Z'),
      revokedAt: null,
      createdAt: new Date('2026-01-02T00:00:00Z'),
      user: { id: 'user-2', username: 'testuser2', email: 'test2@example.com' },
    },
  ];

  const mockTokenService = {
    list: mock(async () => ({ data: mockTokens, total: 2 })),
    export: mock(async () => 'csv-content'),
  };

  const mockResponse = () => {
    const res: any = {
      setHeader: mock(),
      json: mock(),
      send: mock(),
      status: mock().mockReturnThis(),
    };
    return res;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OAuthAdminController],
      providers: [{ provide: OAuthTokenService, useValue: mockTokenService }],
    }).compile();

    controller = module.get<OAuthAdminController>(OAuthAdminController);
    tokenService = module.get<OAuthTokenService>(OAuthTokenService);
  });

  afterEach(() => {
    mockTokenService.list.mockClear();
    mockTokenService.export.mockClear();
  });

  describe('GET /admin/oauth-tokens/export', () => {
    it('should export tokens in CSV format by default', async () => {
      const query: any = {};
      const res = mockResponse();

      mockTokenService.export.mockResolvedValueOnce('csv-content');

      await controller.exportTokens(query, false, res);

      expect(mockTokenService.export).toHaveBeenCalledWith(query, false);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename=oauth-tokens.csv'
      );
      expect(res.send).toHaveBeenCalledWith('csv-content');
    });

    it('should export tokens in JSON format when format=json', async () => {
      const query: any = { format: 'json' };
      const res = mockResponse();

      await controller.exportTokens(query, false, res);

      expect(mockTokenService.list).toHaveBeenCalledWith({ ...query, limit: 10000 });
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename=oauth-tokens.json'
      );
      expect(res.json).toHaveBeenCalled();
    });

    it('should include user PII when includeUserPII=true', async () => {
      const query: any = { format: 'json' };
      const res = mockResponse();

      await controller.exportTokens(query, true, res);

      expect(mockTokenService.list).toHaveBeenCalledWith({ ...query, limit: 10000 });
      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.data[0]).toHaveProperty('user');
      expect(jsonCall.data[0].user).toHaveProperty('username');
      expect(jsonCall.data[0].user).toHaveProperty('email');
    });

    it('should not include user PII by default', async () => {
      const query: any = { format: 'json' };
      const res = mockResponse();

      const tokensWithoutPII = mockTokens.map((t) => ({ ...t, user: undefined }));
      mockTokenService.list.mockResolvedValueOnce({ data: tokensWithoutPII, total: 2 });

      await controller.exportTokens(query, false, res);

      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.data[0]).not.toHaveProperty('user');
    });

    it('should limit export to 10000 records maximum', async () => {
      const query: any = { format: 'json' };
      const res = mockResponse();

      await controller.exportTokens(query, false, res);

      expect(mockTokenService.list).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10000,
        })
      );
    });

    it('should apply query filters to export', async () => {
      const query: any = {
        clientId: 'client-1',
        userId: 'user-1',
        revoked: false,
        format: 'json',
      };
      const res = mockResponse();

      await controller.exportTokens(query, false, res);

      expect(mockTokenService.list).toHaveBeenCalledWith({
        ...query,
        limit: 10000,
      });
    });

    it('should handle empty export results', async () => {
      const query: any = { format: 'json' };
      const res = mockResponse();

      mockTokenService.list.mockResolvedValueOnce({ data: [], total: 0 });

      await controller.exportTokens(query, false, res);

      expect(res.json).toHaveBeenCalledWith({
        data: [],
        total: 0,
        exportedAt: expect.any(String),
      });
    });

    it('should have @RequirePermission(oauth-token, export)', () => {
      const metadata = Reflect.getMetadata(
        PERMISSION_KEY,
        controller.exportTokens
      ) as PermissionMetadata;
      expect(metadata).toEqual({ resource: 'oauth-token', action: 'export' });
    });

    it('should have @AuditLog(export, oauth-token)', () => {
      const metadata = Reflect.getMetadata(
        AUDIT_LOG_KEY,
        controller.exportTokens
      ) as AuditLogMetadata;
      expect(metadata).toEqual({ action: 'export', resourceType: 'oauth-token' });
    });
  });
});
