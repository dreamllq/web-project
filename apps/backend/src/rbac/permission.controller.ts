import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../policy/guards/permission.guard';
import { RequirePermission } from '../policy/decorators/require-permission.decorator';
import { PermissionService, CreatePermissionDto } from './permission.service';
import { Permission } from '../entities/permission.entity';

@ApiTags('rbac')
@Controller({ path: 'permissions', version: '1' })
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get()
  @RequirePermission('permission', 'read')
  @ApiOperation({ summary: 'Get all permissions' })
  @ApiResponse({ status: 200, description: 'List of permissions' })
  async getPermissions(): Promise<Permission[]> {
    return this.permissionService.getPermissions();
  }

  @Get(':id')
  @RequirePermission('permission', 'read')
  @ApiOperation({ summary: 'Get permission by ID' })
  @ApiParam({ name: 'id', description: 'Permission ID' })
  @ApiResponse({ status: 200, description: 'Permission details' })
  async getPermissionById(@Param('id', ParseUUIDPipe) id: string): Promise<Permission | null> {
    return this.permissionService.getPermissionById(id);
  }

  @Get('resource/:resource')
  @RequirePermission('permission', 'read')
  @ApiOperation({ summary: 'Get permissions by resource' })
  @ApiParam({ name: 'resource', description: 'Resource name' })
  @ApiResponse({ status: 200, description: 'List of permissions for the resource' })
  async getPermissionsByResource(@Param('resource') resource: string): Promise<Permission[]> {
    return this.permissionService.getPermissionsByResource(resource);
  }

  @Post()
  @RequirePermission('permission', 'create')
  @ApiOperation({ summary: 'Create a new permission' })
  @ApiResponse({ status: 201, description: 'Permission created successfully' })
  async createPermission(@Body() dto: CreatePermissionDto): Promise<Permission> {
    return this.permissionService.createPermission(dto);
  }

  @Delete(':id')
  @RequirePermission('permission', 'delete')
  @ApiOperation({ summary: 'Delete a permission' })
  @ApiParam({ name: 'id', description: 'Permission ID' })
  @ApiResponse({ status: 200, description: 'Permission deleted successfully' })
  async deletePermission(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: boolean }> {
    await this.permissionService.deletePermission(id);
    return { success: true };
  }
}
