import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { QueryAuditLogDto } from './dto';
import { RequirePermission } from '../policy/decorators/require-permission.decorator';
import { PermissionGuard } from '../policy/guards/permission.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuditLog } from '../entities/audit-log.entity';

@ApiTags('audit-logs')
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth('JWT-auth')
export class AuditController {
  /**
   * Audit Log Endpoints
   *
   * Authorization: All endpoints require ABAC policy evaluation.
   * Permissions are checked via @RequirePermission decorator.
   * See docs/api-authentication.md for details on ABAC authorization.
   */
  constructor(private readonly auditService: AuditService) {}

  /**
   * List all audit logs with optional filtering and pagination
   * GET /api/audit-logs
   */
  @Get()
  @RequirePermission('audit-log', 'read')
  @ApiOperation({ summary: 'List audit logs with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'List of audit logs with pagination' })
  async findAll(
    @Query() query: QueryAuditLogDto
  ): Promise<{ data: AuditLog[]; total: number; page: number; limit: number }> {
    const { data, total } = await this.auditService.findAll(query);
    return {
      data,
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    };
  }

  /**
   * Get a specific audit log by ID
   * GET /api/audit-logs/:id
   */
  @Get(':id')
  @RequirePermission('audit-log', 'read')
  @ApiOperation({ summary: 'Get audit log by ID' })
  @ApiResponse({ status: 200, description: 'Audit log details' })
  async findOne(@Param('id') id: string): Promise<AuditLog> {
    return this.auditService.findOne(id);
  }
}
