import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Version,
  NotFoundException,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../policy/guards/permission.guard';
import { RequirePermission } from '../policy/decorators/require-permission.decorator';
import { AuditLog } from '../audit/decorators/audit-log.decorator';
import {
  OAuthClientService,
  OAuthClientQueryDto,
  CreateOAuthClientDto,
  UpdateOAuthClientDto,
} from './oauth-client.service';
import { OAuthProviderService } from './oauth-provider.service';
import { OAuthTokenService } from './oauth-token.service';
import { SocialAccountService } from '../auth/social-account.service';
import {
  SocialAccountQueryDto,
  BatchUnlinkDto,
  SocialAccountDetail,
} from '../auth/dto/social-account.dto';
import {
  BatchProviderIdsDto,
  UpdateProviderMetadataDto,
  OAuthProviderResponse,
  ProviderMetadataResponse,
} from './dto/oauth-admin.dto';
import {
  OAuthTokenQueryDto,
  BatchRevokeTokensDto,
  OAuthTokenListResponse,
} from './dto/oauth-token.dto';
import { OAuthProviderConfig } from '../entities';

@ApiTags('admin/oauth')
@Controller('admin')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth('JWT-auth')
export class OAuthAdminController {
  constructor(
    private readonly oauthClientService: OAuthClientService,
    private readonly oauthProviderService: OAuthProviderService,
    private readonly oauthTokenService: OAuthTokenService,
    private readonly socialAccountService: SocialAccountService
  ) {}

  @Get('oauth-clients')
  @Version('1')
  @RequirePermission('oauth-client', 'read')
  @ApiOperation({ summary: 'Admin: Get list of OAuth clients with pagination' })
  @ApiQuery({ name: 'keyword', required: false, description: 'Search keyword (name or clientId)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Page size', example: 10 })
  @ApiQuery({ name: 'offset', required: false, description: 'Page offset', example: 0 })
  @ApiResponse({ status: 200, description: 'List of OAuth clients' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async listClients(@Query() query: OAuthClientQueryDto) {
    const { data, total } = await this.oauthClientService.list(query);
    return {
      data: data.map((client) => this.oauthClientService.toResponse(client)),
      total,
    };
  }

  @Post('oauth-clients')
  @Version('1')
  @RequirePermission('oauth-client', 'create')
  @AuditLog('create', 'oauth-client')
  @ApiOperation({ summary: 'Admin: Create new OAuth client' })
  @ApiResponse({
    status: 201,
    description: 'OAuth client created successfully (plain secret returned only once)',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async createClient(@Body() dto: CreateOAuthClientDto) {
    return this.oauthClientService.create(dto);
  }

  @Get('oauth-clients/:id')
  @Version('1')
  @RequirePermission('oauth-client', 'read')
  @ApiOperation({ summary: 'Admin: Get OAuth client by ID' })
  @ApiParam({ name: 'id', description: 'OAuth client ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'OAuth client details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'OAuth client not found' })
  async getClient(@Param('id', ParseUUIDPipe) id: string) {
    const client = await this.oauthClientService.findById(id);
    if (!client) {
      throw new NotFoundException('OAuth client not found');
    }
    return this.oauthClientService.toResponse(client);
  }

  @Patch('oauth-clients/:id')
  @Version('1')
  @RequirePermission('oauth-client', 'update')
  @AuditLog('update', 'oauth-client')
  @ApiOperation({ summary: 'Admin: Update OAuth client' })
  @ApiParam({ name: 'id', description: 'OAuth client ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'OAuth client updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'OAuth client not found' })
  async updateClient(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOAuthClientDto) {
    const client = await this.oauthClientService.update(id, dto);
    return this.oauthClientService.toResponse(client);
  }

  @Delete('oauth-clients/:id')
  @Version('1')
  @RequirePermission('oauth-client', 'delete')
  @AuditLog('delete', 'oauth-client')
  @ApiOperation({ summary: 'Admin: Delete OAuth client' })
  @ApiParam({ name: 'id', description: 'OAuth client ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'OAuth client deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete client with active tokens' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'OAuth client not found' })
  async deleteClient(@Param('id', ParseUUIDPipe) id: string) {
    await this.oauthClientService.delete(id);
    return { message: 'OAuth client deleted successfully' };
  }

  @Post('oauth-clients/:id/regenerate-secret')
  @Version('1')
  @RequirePermission('oauth-client', 'regenerate_secret')
  @AuditLog('regenerate_secret', 'oauth-client')
  @ApiOperation({ summary: 'Admin: Regenerate OAuth client secret' })
  @ApiParam({ name: 'id', description: 'OAuth client ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'New secret generated (plain secret returned only once)',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async regenerateSecret(@Param('id', ParseUUIDPipe) id: string) {
    return this.oauthClientService.regenerateSecret(id);
  }

  // ========== OAuth Provider Management Endpoints ==========

  @Get('oauth-providers')
  @Version('1')
  @RequirePermission('oauth-provider', 'read')
  @ApiOperation({ summary: 'Admin: Get list of OAuth providers' })
  @ApiResponse({ status: 200, description: 'List of OAuth providers' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async listProviders(): Promise<OAuthProviderResponse[]> {
    const configs = await this.oauthProviderService.list();
    return configs.map((config) => this.sanitizeProviderResponse(config));
  }

  @Get('oauth-providers/metadata')
  @Version('1')
  @RequirePermission('oauth-provider', 'read')
  @ApiOperation({ summary: 'Admin: Get provider metadata (dynamic list)' })
  @ApiResponse({ status: 200, description: 'Provider metadata list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async getProvidersMetadata(): Promise<ProviderMetadataResponse[]> {
    return this.oauthProviderService.getProvidersMetadata();
  }

  @Get('oauth-providers/:id')
  @Version('1')
  @RequirePermission('oauth-provider', 'read')
  @ApiOperation({ summary: 'Admin: Get single OAuth provider by ID' })
  @ApiParam({ name: 'id', description: 'Provider ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'Provider details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  async getProviderById(@Param('id') id: string): Promise<OAuthProviderResponse> {
    const configs = await this.oauthProviderService.list();
    const config = configs.find((c) => c.id === id);

    if (!config) {
      throw new NotFoundException('Provider not found');
    }

    return this.sanitizeProviderResponse(config);
  }

  @Patch('oauth-providers/:id')
  @Version('1')
  @RequirePermission('oauth-provider', 'update')
  @AuditLog('update', 'oauth-provider')
  @ApiOperation({ summary: 'Admin: Update provider configuration' })
  @ApiParam({ name: 'id', description: 'Provider ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'Provider updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  async updateProvider(
    @Param('id') id: string,
    @Body() dto: UpdateProviderMetadataDto
  ): Promise<OAuthProviderResponse> {
    const updatedConfig = await this.oauthProviderService.updateMetadata(id, dto);
    return this.sanitizeProviderResponse(updatedConfig);
  }

  @Post('oauth-providers/batch/enable')
  @Version('1')
  @RequirePermission('oauth-provider', 'update')
  @AuditLog('batch-enable', 'oauth-provider')
  @ApiOperation({ summary: 'Admin: Batch enable providers' })
  @ApiResponse({ status: 200, description: 'Providers enabled successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async batchEnable(@Body() body: BatchProviderIdsDto): Promise<{ success: boolean }> {
    await this.oauthProviderService.batchEnable(body.ids);
    return { success: true };
  }

  @Post('oauth-providers/batch/disable')
  @Version('1')
  @RequirePermission('oauth-provider', 'update')
  @AuditLog('batch-disable', 'oauth-provider')
  @ApiOperation({ summary: 'Admin: Batch disable providers' })
  @ApiResponse({ status: 200, description: 'Providers disabled successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async batchDisable(@Body() body: BatchProviderIdsDto): Promise<{ success: boolean }> {
    await this.oauthProviderService.batchDisable(body.ids);
    return { success: true };
  }

  // ========== OAuth Token Management Endpoints ==========

  @Get('oauth-tokens')
  @Version('1')
  @RequirePermission('oauth-token', 'read')
  @ApiOperation({ summary: 'Admin: Get list of OAuth tokens with pagination' })
  @ApiQuery({ name: 'clientId', required: false, description: 'Filter by client ID' })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by user ID' })
  @ApiQuery({ name: 'revoked', required: false, description: 'Filter by revoked status' })
  @ApiQuery({ name: 'limit', required: false, description: 'Page size', example: 10 })
  @ApiQuery({ name: 'offset', required: false, description: 'Page offset', example: 0 })
  @ApiResponse({ status: 200, description: 'List of OAuth tokens' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async listTokens(@Query() query: OAuthTokenQueryDto): Promise<OAuthTokenListResponse> {
    const { data, total } = await this.oauthTokenService.list(query);
    return {
      data: data.map((token) => this.oauthTokenService.toResponse(token)),
      total,
    };
  }

  @Get('oauth-tokens/export')
  @Version('1')
  @RequirePermission('oauth-token', 'read')
  @AuditLog('export', 'oauth-token')
  @ApiOperation({ summary: 'Admin: Export OAuth tokens as CSV' })
  @ApiQuery({ name: 'clientId', required: false, description: 'Filter by client ID' })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by user ID' })
  @ApiQuery({ name: 'revoked', required: false, description: 'Filter by revoked status' })
  @ApiResponse({ status: 200, description: 'CSV file with masked tokens (no user PII)' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async exportTokens(@Query() query: OAuthTokenQueryDto, @Res() res: Response): Promise<void> {
    const csvContent = await this.oauthTokenService.export(query);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=oauth-tokens.csv');
    res.send(csvContent);
  }

  @Delete('oauth-tokens/:id')
  @Version('1')
  @RequirePermission('oauth-token', 'delete')
  @AuditLog('revoke', 'oauth-token')
  @ApiOperation({ summary: 'Admin: Revoke OAuth token by ID' })
  @ApiParam({ name: 'id', description: 'OAuth token ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'Token revoked successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'OAuth token not found' })
  async revokeToken(@Param('id') id: string) {
    const token = await this.oauthTokenService.revoke(id);
    return this.oauthTokenService.toResponse(token);
  }

  @Post('oauth-tokens/batch/revoke')
  @Version('1')
  @RequirePermission('oauth-token', 'delete')
  @AuditLog('batch-revoke', 'oauth-token')
  @ApiOperation({ summary: 'Admin: Batch revoke OAuth tokens (max 100)' })
  @ApiResponse({ status: 200, description: 'Batch revoke result with success/failed lists' })
  @ApiResponse({ status: 400, description: 'Cannot revoke more than 100 tokens at once' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async batchRevokeTokens(@Body() body: BatchRevokeTokensDto) {
    return this.oauthTokenService.batchRevoke(body.ids);
  }

  private sanitizeProviderResponse(config: OAuthProviderConfig): OAuthProviderResponse {
    const { appSecret: _appSecret, ...rest } = config;
    return rest;
  }

  // ========== Social Account Management Endpoints ==========

  @Get('social-accounts')
  @Version('1')
  @RequirePermission('social-account', 'read')
  @ApiOperation({ summary: 'Admin: Get list of social accounts with pagination' })
  @ApiQuery({
    name: 'provider',
    required: false,
    description: 'Filter by provider (wechat, dingtalk, etc.)',
  })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by user ID' })
  @ApiQuery({ name: 'keyword', required: false, description: 'Search keyword (username or email)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Page size', example: 20 })
  @ApiQuery({ name: 'offset', required: false, description: 'Page offset', example: 0 })
  @ApiResponse({ status: 200, description: 'List of social accounts' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async listSocialAccounts(@Query() query: SocialAccountQueryDto) {
    const { data, total } = await this.socialAccountService.list(query);
    return { data, total };
  }

  @Get('social-accounts/:id')
  @Version('1')
  @RequirePermission('social-account', 'read')
  @ApiOperation({ summary: 'Admin: Get social account by ID' })
  @ApiParam({ name: 'id', description: 'Social account ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'Social account details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Social account not found' })
  async getSocialAccount(@Param('id', ParseUUIDPipe) id: string) {
    const account = await this.socialAccountService.findById(id);
    if (!account) {
      throw new NotFoundException('Social account not found');
    }
    return account;
  }

  @Get('social-accounts/:id/detail')
  @Version('1')
  @RequirePermission('social-account', 'read')
  @ApiOperation({ summary: 'Admin: Get detailed social account information with login history' })
  @ApiParam({ name: 'id', description: 'Social account ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'Detailed social account information' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Social account not found' })
  async getSocialAccountDetail(
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<SocialAccountDetail> {
    return this.socialAccountService.getDetail(id);
  }

  @Delete('social-accounts/:id')
  @Version('1')
  @RequirePermission('social-account', 'delete')
  @AuditLog('unlink', 'social-account')
  @ApiOperation({ summary: 'Admin: Unlink social account' })
  @ApiParam({ name: 'id', description: 'Social account ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'Social account unlinked successfully' })
  @ApiResponse({
    status: 400,
    description: 'Social account already unlinked or is the only authentication method',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Social account not found' })
  async unlinkSocialAccount(@Param('id', ParseUUIDPipe) id: string) {
    await this.socialAccountService.unlink(id);
    return { message: 'Social account unlinked successfully' };
  }

  @Post('social-accounts/batch/unlink')
  @Version('1')
  @RequirePermission('social-account', 'delete')
  @AuditLog('batch-unlink', 'social-account')
  @ApiOperation({ summary: 'Admin: Batch unlink social accounts (max 50)' })
  @ApiResponse({ status: 200, description: 'Batch unlink result with success/failed lists' })
  @ApiResponse({ status: 400, description: 'Cannot unlink more than 50 accounts at once' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async batchUnlinkSocialAccounts(@Body() body: BatchUnlinkDto) {
    return this.socialAccountService.batchUnlink(body.ids);
  }
}
