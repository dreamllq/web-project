import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Version,
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
import { OAuthTokenService } from './oauth-token.service';
import {
  OAuthTokenQueryDto,
  BatchRevokeTokensDto,
  OAuthTokenListResponse,
} from './dto/oauth-token.dto';

@ApiTags('oauth/tokens')
@Controller('oauth/tokens')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth('JWT-auth')
export class OAuthTokenController {
  constructor(private readonly oauthTokenService: OAuthTokenService) {}

  @Get()
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

  @Get('export')
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

  @Delete(':id')
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

  @Post('batch/revoke')
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
}
