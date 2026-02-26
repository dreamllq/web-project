import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { UserRole } from '../entities/user-role.entity';
import { User } from '../entities/user.entity';
import { PermissionCacheService } from '../policy/services/permission-cache.service';
import { RegisterSubjectType } from '../policy/decorators/register-subject-type.decorator';
import { SubjectValue } from '../policy/services/subject-type-registry.service';
import type { RequestWithDataFilter } from '../policy/interceptors/data-filter.interceptor';
import { CreateRoleDto, UpdateRoleDto } from './dto';

@RegisterSubjectType({ type: 'role', label: '角色' })
@Injectable()
export class RoleService {
  private readonly logger = new Logger(RoleService.name);

  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @Inject(forwardRef(() => PermissionCacheService))
    private readonly permissionCacheService: PermissionCacheService
  ) {}

  /**
   * Create a new role
   */
  async createRole(dto: CreateRoleDto): Promise<Role> {
    const existingRole = await this.roleRepo.findOne({
      where: { name: dto.name },
    });

    if (existingRole) {
      throw new BadRequestException(`Role '${dto.name}' already exists`);
    }

    let permissions: Permission[] = [];
    if (dto.permissionIds && dto.permissionIds.length > 0) {
      permissions = await this.permissionRepo.findBy({
        id: In(dto.permissionIds),
      });
    }

    const role = this.roleRepo.create({
      name: dto.name,
      description: dto.description || null,
      permissions,
    });

    return this.roleRepo.save(role);
  }

  /**
   * Update a role
   */
  async updateRole(id: string, dto: UpdateRoleDto): Promise<Role> {
    const role = await this.roleRepo.findOne({
      where: { id },
      relations: ['permissions'],
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (dto.name && dto.name !== role.name) {
      const existing = await this.roleRepo.findOne({
        where: { name: dto.name },
      });
      if (existing) {
        throw new BadRequestException(`Role '${dto.name}' already exists`);
      }
    }

    role.name = dto.name ?? role.name;
    role.description = dto.description ?? role.description;

    if (dto.permissionIds !== undefined) {
      role.permissions =
        dto.permissionIds.length > 0
          ? await this.permissionRepo.findBy({ id: In(dto.permissionIds) })
          : [];

      // Invalidate cache for all users with this role
      await this.invalidateCacheForRole(id);
    }

    return this.roleRepo.save(role);
  }

  /**
   * Delete a role
   */
  async deleteRole(id: string): Promise<void> {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Get all users with this role before deleting
    const userRoles = await this.userRoleRepo.find({ where: { roleId: id } });
    const userIds = userRoles.map((ur) => ur.userId);

    // Remove all user-role associations first
    await this.userRoleRepo.delete({ roleId: id });

    // Delete the role
    await this.roleRepo.remove(role);

    // Invalidate cache for all users who had this role
    for (const userId of userIds) {
      await this.permissionCacheService.invalidateUser(userId);
    }

    this.logger.log(`Role '${role.name}' deleted`);
  }

  /**
   * Get all roles
   * Supports ABAC data-level filtering via RequestWithDataFilter
   */
  async getRoles(request?: RequestWithDataFilter): Promise<Role[]> {
    const qb = this.roleRepo.createQueryBuilder('role');

    // Load permissions relation
    qb.leftJoinAndSelect('role.permissions', 'permission');

    // Apply ABAC data filter conditions if present
    if (request?.dataFilterConditions && request.dataFilterConditions.length > 0) {
      for (const bracket of request.dataFilterConditions) {
        qb.andWhere(bracket);
      }
    }

    // Order by name ASC
    qb.orderBy('role.name', 'ASC');

    return qb.getMany();
  }

  /**
   * Get role by ID
   */
  async getRoleById(id: string): Promise<Role | null> {
    return this.roleRepo.findOne({
      where: { id },
      relations: ['permissions'],
    });
  }

  /**
   * Get role by name
   */
  async getRoleByName(name: string): Promise<Role | null> {
    return this.roleRepo.findOne({
      where: { name },
      relations: ['permissions'],
    });
  }

  /**
   * Get all permissions for a role
   */
  async getRolePermissions(roleId: string): Promise<Permission[]> {
    const role = await this.roleRepo.findOne({
      where: { id: roleId },
      relations: ['permissions'],
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role.permissions;
  }

  /**
   * Add permissions to a role
   */
  async addPermissionsToRole(roleId: string, permissionIds: string[]): Promise<Permission[]> {
    const role = await this.roleRepo.findOne({
      where: { id: roleId },
      relations: ['permissions'],
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Get existing permission IDs
    const existingIds = new Set(role.permissions.map((p) => p.id));

    // Filter out already assigned permissions
    const newIds = permissionIds.filter((id) => !existingIds.has(id));

    if (newIds.length === 0) {
      throw new BadRequestException('All permissions are already assigned to this role');
    }

    // Fetch new permissions
    const newPermissions = await this.permissionRepo.findBy({
      id: In(newIds),
    });

    if (newPermissions.length !== newIds.length) {
      const foundIds = newPermissions.map((p) => p.id);
      const missingIds = newIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(`Permissions not found: ${missingIds.join(', ')}`);
    }

    // Add new permissions to role
    role.permissions = [...role.permissions, ...newPermissions];
    await this.roleRepo.save(role);

    // Invalidate cache for all users with this role
    await this.invalidateCacheForRole(roleId);

    this.logger.log(`Added ${newPermissions.length} permissions to role ${roleId}`);

    return role.permissions;
  }

  /**
   * Remove a permission from a role
   */
  async removePermissionFromRole(roleId: string, permissionId: string): Promise<Permission[]> {
    const role = await this.roleRepo.findOne({
      where: { id: roleId },
      relations: ['permissions'],
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const permissionIndex = role.permissions.findIndex((p) => p.id === permissionId);

    if (permissionIndex === -1) {
      throw new NotFoundException('Permission not found in this role');
    }

    // Remove the permission
    role.permissions.splice(permissionIndex, 1);
    await this.roleRepo.save(role);

    // Invalidate cache for all users with this role
    await this.invalidateCacheForRole(roleId);

    this.logger.log(`Removed permission ${permissionId} from role ${roleId}`);

    return role.permissions;
  }

  /**
   * Assign role to user
   */
  async assignRole(userId: string, roleId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Check if already assigned
    const existing = await this.userRoleRepo.findOne({
      where: { userId, roleId },
    });

    if (existing) {
      throw new BadRequestException('Role already assigned to user');
    }

    const userRole = this.userRoleRepo.create({ userId, roleId });
    await this.userRoleRepo.save(userRole);

    // Invalidate user's permission cache
    await this.permissionCacheService.invalidateUser(userId);

    this.logger.log(`Role '${role.name}' assigned to user ${userId}`);
  }

  /**
   * Remove role from user
   */
  async removeRole(userId: string, roleId: string): Promise<void> {
    const result = await this.userRoleRepo.delete({ userId, roleId });

    if (result.affected === 0) {
      throw new NotFoundException('Role assignment not found');
    }

    // Invalidate user's permission cache
    await this.permissionCacheService.invalidateUser(userId);

    this.logger.log(`Role ${roleId} removed from user ${userId}`);
  }

  /**
   * Get all roles for a user
   */
  async getUserRoles(userId: string): Promise<Role[]> {
    const userRoles = await this.userRoleRepo.find({
      where: { userId },
    });

    // Get role IDs
    const roleIds = userRoles.map((ur) => ur.roleId);

    if (roleIds.length === 0) {
      return [];
    }

    return this.roleRepo.find({
      where: { id: In(roleIds) },
      relations: ['permissions'],
    });
  }

  /**
   * Get all permissions for a user (expanded from roles)
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    const roles = await this.getUserRoles(userId);

    const permissions = new Set<string>();
    for (const role of roles) {
      for (const perm of role.permissions) {
        permissions.add(perm.name);
      }
    }

    return Array.from(permissions);
  }

  /**
   * Check if user has a specific permission
   */
  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.includes(permission);
  }

  /**
   * Check if user has a specific role
   */
  async hasRole(userId: string, roleName: string): Promise<boolean> {
    const roles = await this.getUserRoles(userId);
    return roles.some((r) => r.name === roleName);
  }

  /**
   * Invalidate permission cache for all users with a specific role
   */
  private async invalidateCacheForRole(roleId: string): Promise<void> {
    const userRoles = await this.userRoleRepo.find({ where: { roleId } });
    for (const userRole of userRoles) {
      await this.permissionCacheService.invalidateUser(userRole.userId);
    }
  }

  /**
   * Get all role values for subject type selection
   */
  async getValues(): Promise<SubjectValue[]> {
    const roles = await this.getRoles();
    return roles.map((r) => ({ id: r.id, label: r.name }));
  }
}
