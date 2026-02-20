import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { UserRole } from '../entities/user-role.entity';
import { User } from '../entities/user.entity';

export interface CreateRoleDto {
  name: string;
  description?: string;
  permissionIds?: string[];
}

export interface UpdateRoleDto {
  name?: string;
  description?: string;
  permissionIds?: string[];
}

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
    private readonly userRepo: Repository<User>
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

    // Remove all user-role associations first
    await this.userRoleRepo.delete({ roleId: id });

    // Delete the role
    await this.roleRepo.remove(role);
    this.logger.log(`Role '${role.name}' deleted`);
  }

  /**
   * Get all roles
   */
  async getRoles(): Promise<Role[]> {
    return this.roleRepo.find({
      relations: ['permissions'],
      order: { name: 'ASC' },
    });
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
}
