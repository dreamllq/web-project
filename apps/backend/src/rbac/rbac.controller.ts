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
import { CreateRoleDto, UpdateRoleDto, AssignRoleDto, AssignPermissionsDto } from './dto';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';

@ApiTags('rbac')
@Controller({ path: 'roles', version: '1' })
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth('JWT-auth')
export class RbacController {
  /**
   * Role Management Endpoints
   *
   * Authorization: All endpoints require ABAC policy evaluation.
   * Permissions are checked via @RequirePermission decorator.
   * See docs/api-authentication.md for details on ABAC authorization.
   */
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

  @Get(':id')
  @RequirePermission('role', 'read')
  @ApiOperation({ summary: 'Get a role by ID' })
  @ApiParam({ name: 'id', description: 'Role ID' })
  @ApiResponse({ status: 200, description: 'Role details' })
  async getRoleById(@Param('id', ParseUUIDPipe) id: string): Promise<Role> {
    const role = await this.roleService.getRoleById(id);
    if (!role) {
      throw new Error('Role not found');
    }
    return role;
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

  // ========== Role-Permission Assignment ==========

  @Get(':id/permissions')
  @RequirePermission('role', 'read')
  @ApiOperation({ summary: 'Get all permissions for a role' })
  @ApiParam({ name: 'id', description: 'Role ID' })
  @ApiResponse({ status: 200, description: 'List of permissions for the role' })
  async getRolePermissions(
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<{ roleId: string; permissions: Permission[] }> {
    const permissions = await this.roleService.getRolePermissions(id);
    return { roleId: id, permissions };
  }

  @Post(':id/permissions')
  @RequirePermission('role', 'update')
  @ApiOperation({ summary: 'Add permissions to a role' })
  @ApiParam({ name: 'id', description: 'Role ID' })
  @ApiResponse({ status: 201, description: 'Permissions added successfully' })
  async addPermissionsToRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignPermissionsDto
  ): Promise<{ roleId: string; permissions: Permission[] }> {
    const permissions = await this.roleService.addPermissionsToRole(id, dto.permissionIds);
    return { roleId: id, permissions };
  }

  @Delete(':id/permissions/:permissionId')
  @RequirePermission('role', 'update')
  @ApiOperation({ summary: 'Remove a permission from a role' })
  @ApiParam({ name: 'id', description: 'Role ID' })
  @ApiParam({ name: 'permissionId', description: 'Permission ID' })
  @ApiResponse({ status: 200, description: 'Permission removed successfully' })
  async removePermissionFromRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string
  ): Promise<{ roleId: string; permissions: Permission[] }> {
    const permissions = await this.roleService.removePermissionFromRole(id, permissionId);
    return { roleId: id, permissions };
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
