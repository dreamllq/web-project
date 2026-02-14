import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { QueryAuditLogDto } from './dto';
import { RequirePermission } from '../policy/decorators/require-permission.decorator';
import { PermissionGuard } from '../policy/guards/permission.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuditLog } from '../entities/audit-log.entity';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * List all audit logs with optional filtering and pagination
   * GET /api/audit-logs
   */
  @Get()
  @RequirePermission('audit-log', 'read')
  async findAll(
    @Query() query: QueryAuditLogDto,
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
  async findOne(@Param('id') id: string): Promise<AuditLog> {
    return this.auditService.findOne(id);
  }
}
