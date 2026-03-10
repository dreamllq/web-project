import {
  Controller,
  Get,
  Post,
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
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionGuard } from '../policy/guards/permission.guard';
import { RequirePermission } from '../policy/decorators/require-permission.decorator';
import { AuditLog } from '../audit/decorators/audit-log.decorator';
import { SocialAccountService } from './social-account.service';
import {
  SocialAccountQueryDto,
  BatchUnlinkDto,
  SocialAccountDetail,
} from './dto/social-account.dto';

@ApiTags('social-accounts')
@Controller('social-accounts')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth('JWT-auth')
export class SocialAccountAdminController {
  constructor(private readonly socialAccountService: SocialAccountService) {}

  // ========== Social Account Management Endpoints ==========

  @Get()
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
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    return {
      data,
      pagination: { total, limit, offset },
    };
  }

  @Get(':id')
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

  @Get(':id/detail')
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

  @Delete(':id')
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

  @Post('batch/unlink')
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
