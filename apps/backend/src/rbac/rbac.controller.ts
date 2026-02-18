import {
  Controller,
  Get,
  Post,
  Patch,
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
import { RoleService } from './role.service';
import { CreateRoleDto, UpdateRoleDto, AssignRoleDto } from './dto';
import { Role } from '../entities/role.entity';

@ApiTags('rbac')
@Controller({ path: 'roles', version: '1' })
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class RbacController {
  constructor(private readonly roleService: RoleService) {}

  // ========== Role Management ==========

  @Post()
  @RequirePermission('role', 'create')
  @ApiOperation({ summary: 'Create a new role' })
  @ApiResponse({ status: 201, description: 'Role created successfully' })
  async createRole(@Body() dto: CreateRoleDto): Promise<Role> {
    return this.roleService.createRole(dto);
  }

  @Get()
  @RequirePermission('role', 'read')
  @ApiOperation({ summary: 'Get all roles' })
  @ApiResponse({ status: 200, description: 'List of roles' })
  async getRoles(): Promise<{ data: Role[] }> {
    const roles = await this.roleService.getRoles();
    return { data: roles };
  }

  @Patch(':id')
  @RequirePermission('role', 'update')
  @ApiOperation({ summary: 'Update a role' })
  @ApiParam({ name: 'id', description: 'Role ID' })
  @ApiResponse({ status: 200, description: 'Role updated successfully' })
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto
  ): Promise<Role> {
    return this.roleService.updateRole(id, dto);
  }

  @Delete(':id')
  @RequirePermission('role', 'delete')
  @ApiOperation({ summary: 'Delete a role' })
  @ApiParam({ name: 'id', description: 'Role ID' })
  @ApiResponse({ status: 200, description: 'Role deleted successfully' })
  async deleteRole(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: boolean }> {
    await this.roleService.deleteRole(id);
    return { success: true };
  }

  // ========== User Role Assignment ==========

  @Post('users/:id/roles')
  @RequirePermission('user', 'update')
  @ApiOperation({ summary: 'Assign role to user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 201, description: 'Role assigned successfully' })
  async assignRole(
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() dto: AssignRoleDto
  ): Promise<{ success: boolean }> {
    await this.roleService.assignRole(userId, dto.roleId);
    return { success: true };
  }

  @Delete('users/:id/roles/:roleId')
  @RequirePermission('user', 'update')
  @ApiOperation({ summary: 'Remove role from user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiParam({ name: 'roleId', description: 'Role ID' })
  @ApiResponse({ status: 200, description: 'Role removed successfully' })
  async removeRole(
    @Param('id', ParseUUIDPipe) userId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string
  ): Promise<{ success: boolean }> {
    await this.roleService.removeRole(userId, roleId);
    return { success: true };
  }

  @Get('users/:id/roles')
  @RequirePermission('user', 'read')
  @ApiOperation({ summary: 'Get user roles' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'List of user roles' })
  async getUserRoles(
    @Param('id', ParseUUIDPipe) userId: string
  ): Promise<{ userId: string; roles: Role[] }> {
    const roles = await this.roleService.getUserRoles(userId);
    return { userId, roles };
  }

  @Get('users/:id/permissions')
  @RequirePermission('user', 'read')
  @ApiOperation({ summary: 'Get user permissions (expanded from roles)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'List of user permissions' })
  async getUserPermissions(
    @Param('id', ParseUUIDPipe) userId: string
  ): Promise<{ permissions: string[] }> {
    const permissions = await this.roleService.getUserPermissions(userId);
    return { permissions };
  }
}
