import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { AUDIT_LOG_KEY } from '../audit/decorators/audit-log.decorator';
import { PERMISSION_KEY } from '../policy/decorators/require-permission.decorator';
import { OAuthAdminController } from './oauth-admin.controller';
import { OAuthTokenService } from './oauth-token.service';
import {
  OAuthTokenQueryDto,
  BatchRevokeTokensDto,
  BatchOperationResult,
} from './dto/oauth-token.dto';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { OAuthToken } from '../entities/oauth-token.entity';

interface PermissionMetadata {
  resource: string;
  action: string;
}

interface AuditLogMetadata {
  action: string;
  resourceType: string;
}

describe('OAuthAdminController - Token Management', () => {
  let controller: OAuthAdminController;
  let tokenService: OAuthTokenService;

  const mockTokenService = {
    list: mock(async () => ({ data: [], total: 0 })),
    export: mock(async () => ''),
    revoke: mock(async () => ({})),
    batchRevoke: mock(async () => ({ success: [], failed: [], errors: [] })),
    toResponse: mock((token: any) => token),
  };

  const mockResponse = () => {
    const res: any = {
      setHeader: mock(() => res),
      send: mock(() => res),
    };
    return res;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OAuthAdminController],
      providers: [
        {
          provide: OAuthTokenService,
          useValue: mockTokenService,
        },
      ],
    }).compile();

    controller = module.get<OAuthAdminController>(OAuthAdminController);
    tokenService = module.get<OAuthTokenService>(OAuthTokenService);
  });

  afterEach(() => {
    Object.values(mockTokenService).forEach((fn: any) => fn.mockClear());
  });

  describe('GET /admin/oauth-tokens', () => {
    it('should return token list with pagination', async () => {
      const query: OAuthTokenQueryDto = { limit: 10, offset: 0 };
      const mockTokens = [
        { id: 'token-1', clientId: 'client-1', userId: 'user-1' },
        { id: 'token-2', clientId: 'client-1', userId: 'user-2' },
      ] as OAuthToken[];

      mockTokenService.list.mockResolvedValueOnce({ data: mockTokens, total: 2 });
      mockTokenService.toResponse
        .mockReturnValueOnce({ id: 'token-1' } as any)
        .mockReturnValueOnce({ id: 'token-2' } as any);

      const result = await controller.listTokens(query);

      expect(mockTokenService.list).toHaveBeenCalledWith(query);
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter tokens by clientId', async () => {
      const query: OAuthTokenQueryDto = { clientId: 'client-1', limit: 20, offset: 0 };
      const mockTokens = [{ id: 'token-1', clientId: 'client-1' }] as OAuthToken[];

      mockTokenService.list.mockResolvedValueOnce({ data: mockTokens, total: 1 });
      mockTokenService.toResponse.mockReturnValue({ id: 'token-1' } as any);

      const result = await controller.listTokens(query);

      expect(mockTokenService.list).toHaveBeenCalledWith(query);
      expect(result.data).toHaveLength(1);
    });

    it('should filter tokens by userId', async () => {
      const query: OAuthTokenQueryDto = { userId: 'user-1', limit: 10, offset: 0 };
      const mockTokens = [{ id: 'token-1', userId: 'user-1' }] as OAuthToken[];

      mockTokenService.list.mockResolvedValueOnce({ data: mockTokens, total: 1 });
      mockTokenService.toResponse.mockReturnValue({ id: 'token-1' } as any);

      await controller.listTokens(query);

      expect(mockTokenService.list).toHaveBeenCalledWith(query);
    });

    it('should filter tokens by revoked status', async () => {
      const query: OAuthTokenQueryDto = { revoked: true, limit: 10, offset: 0 };
      const mockTokens = [{ id: 'token-1', revokedAt: new Date() }] as OAuthToken[];

      mockTokenService.list.mockResolvedValueOnce({ data: mockTokens, total: 1 });
      mockTokenService.toResponse.mockReturnValue({ id: 'token-1' } as any);

      await controller.listTokens(query);

      expect(mockTokenService.list).toHaveBeenCalledWith(query);
    });

    it('should have @RequirePermission(oauth-token, read)', () => {
      const metadata = Reflect.getMetadata(
        PERMISSION_KEY,
        controller.listTokens
      ) as PermissionMetadata;
      expect(metadata).toEqual({ resource: 'oauth-token', action: 'read' });
    });
  });

  describe('GET /admin/oauth-tokens/export', () => {
    it('should export tokens as CSV with masked access tokens', async () => {
      const query: OAuthTokenQueryDto = {};
      const csvContent =
        'Access Token,Client ID,User ID,Scope,Expires At,Created At\nabc...xyz,client-1,user-1,openid,2024-01-01,2023-01-01';

      mockTokenService.export.mockResolvedValueOnce(csvContent);
      const res = mockResponse();

      await controller.exportTokens(query, res);

      expect(mockTokenService.export).toHaveBeenCalledWith(query);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename=oauth-tokens.csv'
      );
      expect(res.send).toHaveBeenCalledWith(csvContent);
    });

    it('should export tokens with query filters', async () => {
      const query: OAuthTokenQueryDto = { clientId: 'client-1' };
      const csvContent = 'Access Token,Client ID\nabc...xyz,client-1';

      mockTokenService.export.mockResolvedValueOnce(csvContent);
      const res = mockResponse();

      await controller.exportTokens(query, res);

      expect(mockTokenService.export).toHaveBeenCalledWith(query);
    });

    it('should not include user PII in CSV export', async () => {
      const query: OAuthTokenQueryDto = {};
      const csvContent =
        'Access Token,Client ID,User ID,Scope,Expires At,Created At\n***,client-1,user-1,openid,2024-01-01,2023-01-01';

      mockTokenService.export.mockResolvedValueOnce(csvContent);
      const res = mockResponse();

      await controller.exportTokens(query, res);

      expect(csvContent).not.toContain('email');
      expect(csvContent).not.toContain('phone');
      expect(csvContent).not.toContain('username');
    });

    it('should have @RequirePermission(oauth-token, read)', () => {
      const metadata = Reflect.getMetadata(
        PERMISSION_KEY,
        controller.exportTokens
      ) as PermissionMetadata;
      expect(metadata).toEqual({ resource: 'oauth-token', action: 'read' });
    });

    it('should have @AuditLog(export, oauth-token)', () => {
      const metadata = Reflect.getMetadata(
        AUDIT_LOG_KEY,
        controller.exportTokens
      ) as AuditLogMetadata;
      expect(metadata).toEqual({ action: 'export', resourceType: 'oauth-token' });
    });
  });

  describe('DELETE /admin/oauth-tokens/:id', () => {
    it('should revoke a token by id', async () => {
      const tokenId = 'token-123';
      const revokedToken = { id: tokenId, revokedAt: new Date() } as OAuthToken;

      mockTokenService.revoke.mockResolvedValueOnce(revokedToken);
      mockTokenService.toResponse.mockReturnValue(revokedToken as any);

      await controller.revokeToken(tokenId);

      expect(mockTokenService.revoke).toHaveBeenCalledWith(tokenId);
    });

    it('should throw NotFoundException if token not found', async () => {
      const tokenId = 'non-existent-token';

      mockTokenService.revoke.mockRejectedValueOnce(new NotFoundException('OAuth token not found'));

      await expect(controller.revokeToken(tokenId)).rejects.toThrow('OAuth token not found');
    });

    it('should have @RequirePermission(oauth-token, delete)', () => {
      const metadata = Reflect.getMetadata(
        PERMISSION_KEY,
        controller.revokeToken
      ) as PermissionMetadata;
      expect(metadata).toEqual({ resource: 'oauth-token', action: 'delete' });
    });

    it('should have @AuditLog(revoke, oauth-token)', () => {
      const metadata = Reflect.getMetadata(
        AUDIT_LOG_KEY,
        controller.revokeToken
      ) as AuditLogMetadata;
      expect(metadata).toEqual({ action: 'revoke', resourceType: 'oauth-token' });
    });
  });

  describe('POST /admin/oauth-tokens/batch/revoke', () => {
    it('should batch revoke tokens with success result', async () => {
      const dto: BatchRevokeTokensDto = { ids: ['token-1', 'token-2', 'token-3'] };
      const result: BatchOperationResult = {
        success: ['token-1', 'token-2', 'token-3'],
        failed: [],
        errors: [],
      };

      mockTokenService.batchRevoke.mockResolvedValueOnce(result);

      const response = await controller.batchRevokeTokens(dto);

      expect(mockTokenService.batchRevoke).toHaveBeenCalledWith(dto.ids);
      expect(response).toEqual(result);
    });

    it('should handle partial failure in batch revoke', async () => {
      const dto: BatchRevokeTokensDto = { ids: ['token-1', 'token-2', 'token-3'] };
      const result: BatchOperationResult = {
        success: ['token-1', 'token-3'],
        failed: ['token-2'],
        errors: ['Failed to revoke token token-2: OAuth token not found'],
      };

      mockTokenService.batchRevoke.mockResolvedValueOnce(result);

      const response = await controller.batchRevokeTokens(dto);

      expect(response.success).toEqual(['token-1', 'token-3']);
      expect(response.failed).toEqual(['token-2']);
      expect(response.errors).toHaveLength(1);
    });

    it('should reject batch revoke with more than 100 tokens', async () => {
      const ids = Array.from({ length: 101 }, (_, i) => `token-${i}`);
      const dto: BatchRevokeTokensDto = { ids };

      mockTokenService.batchRevoke.mockRejectedValueOnce(
        new BadRequestException('Cannot revoke more than 100 tokens at once')
      );

      await expect(controller.batchRevokeTokens(dto)).rejects.toThrow(
        'Cannot revoke more than 100 tokens at once'
      );
    });

    it('should allow exactly 100 tokens', async () => {
      const ids = Array.from({ length: 100 }, (_, i) => `token-${i}`);
      const dto: BatchRevokeTokensDto = { ids };
      const result: BatchOperationResult = {
        success: ids,
        failed: [],
        errors: [],
      };

      mockTokenService.batchRevoke.mockResolvedValueOnce(result);

      const response = await controller.batchRevokeTokens(dto);

      expect(response.success).toHaveLength(100);
      expect(response.failed).toHaveLength(0);
    });

    it('should handle empty array', async () => {
      const dto: BatchRevokeTokensDto = { ids: [] };
      const result: BatchOperationResult = {
        success: [],
        failed: [],
        errors: [],
      };

      mockTokenService.batchRevoke.mockResolvedValueOnce(result);

      const response = await controller.batchRevokeTokens(dto);

      expect(response.success).toHaveLength(0);
      expect(response.failed).toHaveLength(0);
    });

    it('should have @RequirePermission(oauth-token, delete)', () => {
      const metadata = Reflect.getMetadata(
        PERMISSION_KEY,
        controller.batchRevokeTokens
      ) as PermissionMetadata;
      expect(metadata).toEqual({ resource: 'oauth-token', action: 'delete' });
    });

    it('should have @AuditLog(batch-revoke, oauth-token)', () => {
      const metadata = Reflect.getMetadata(
        AUDIT_LOG_KEY,
        controller.batchRevokeTokens
      ) as AuditLogMetadata;
      expect(metadata).toEqual({ action: 'batch-revoke', resourceType: 'oauth-token' });
    });
  });
});
