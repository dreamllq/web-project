import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Version,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../policy/guards/permission.guard';
import { RequirePermission } from '../policy/decorators/require-permission.decorator';
import { AuditLog } from '../audit/decorators/audit-log.decorator';
import { OAuthProviderService } from './oauth-provider.service';
import {
  BatchProviderIdsDto,
  CreateProviderDto,
  UpdateProviderMetadataDto,
  OAuthProviderResponse,
  ProviderMetadataResponse,
} from './dto/oauth-admin.dto';
import { OAuthProviderConfig } from '../entities';

/**
 * Response interface for provider list
 */
export interface OAuthProviderListResponse {
  data: OAuthProviderResponse[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

/**
 * Response interface for provider metadata list
 */
export interface ProviderMetadataListResponse {
  data: ProviderMetadataResponse[];
}

@ApiTags('oauth/providers')
@Controller('oauth/providers')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth('JWT-auth')
export class OAuthProviderController {
  constructor(private readonly oauthProviderService: OAuthProviderService) {}

  @Get()
  @Version('1')
  @RequirePermission('oauth-provider', 'read')
  @ApiOperation({ summary: 'Admin: Get list of OAuth providers' })
  @ApiResponse({ status: 200, description: 'List of OAuth providers' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async listProviders(): Promise<OAuthProviderListResponse> {
    const configs = await this.oauthProviderService.list();
    const data = configs.map((config) => this.sanitizeProviderResponse(config));
    return {
      data,
      pagination: {
        total: data.length,
        limit: data.length,
        offset: 0,
      },
    };
  }

  @Post()
  @Version('1')
  @RequirePermission('oauth-provider', 'create')
  @AuditLog('create', 'oauth-provider')
  @ApiOperation({ summary: 'Admin: Create a new OAuth provider configuration' })
  @ApiResponse({ status: 201, description: 'Provider created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 409, description: 'Provider with this code already exists' })
  async createProvider(@Body() dto: CreateProviderDto): Promise<OAuthProviderResponse> {
    const config = await this.oauthProviderService.create(dto);
    return this.sanitizeProviderResponse(config);
  }

  @Get('metadata')
  @Version('1')
  @RequirePermission('oauth-provider', 'read')
  @ApiOperation({ summary: 'Admin: Get provider metadata (dynamic list)' })
  @ApiResponse({ status: 200, description: 'Provider metadata list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async getProvidersMetadata(): Promise<ProviderMetadataListResponse> {
    const data = await this.oauthProviderService.getProvidersMetadata();
    return { data };
  }

  @Get(':id')
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

  @Patch(':id')
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

  @Delete(':id')
  @Version('1')
  @RequirePermission('oauth-provider', 'delete')
  @AuditLog('delete', 'oauth-provider')
  @ApiOperation({ summary: 'Admin: Delete an OAuth provider configuration' })
  @ApiParam({ name: 'id', description: 'Provider ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'Provider deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  async deleteProvider(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.oauthProviderService.delete(id);
    return { success: true };
  }

  @Post('batch/enable')
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

  @Post('batch/disable')
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

  private sanitizeProviderResponse(config: OAuthProviderConfig): OAuthProviderResponse {
    const { appSecret: _appSecret, ...rest } = config;
    return rest;
  }
}
