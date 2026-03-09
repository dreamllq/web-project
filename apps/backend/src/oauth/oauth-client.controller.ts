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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
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

@ApiTags('oauth/clients')
@Controller('oauth/clients')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth('JWT-auth')
export class OAuthClientController {
  constructor(private readonly oauthClientService: OAuthClientService) {}

  @Get()
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

  @Post()
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

  @Get(':id')
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

  @Patch(':id')
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

  @Delete(':id')
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

  @Post(':id/regenerate-secret')
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
}
