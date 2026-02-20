import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '../entities/permission.entity';

export interface CreatePermissionDto {
  name: string;
  resource: string;
  action: string;
  description?: string;
}

// Default permissions to seed on startup
const DEFAULT_PERMISSIONS: CreatePermissionDto[] = [
  // User management
  { name: 'user:create', resource: 'user', action: 'create', description: 'Create new users' },
  { name: 'user:read', resource: 'user', action: 'read', description: 'View user details' },
  {
    name: 'user:update',
    resource: 'user',
    action: 'update',
    description: 'Update user information',
  },
  { name: 'user:delete', resource: 'user', action: 'delete', description: 'Delete users' },

  // Role management
  { name: 'role:create', resource: 'role', action: 'create', description: 'Create new roles' },
  { name: 'role:read', resource: 'role', action: 'read', description: 'View role details' },
  {
    name: 'role:update',
    resource: 'role',
    action: 'update',
    description: 'Update role information',
  },
  { name: 'role:delete', resource: 'role', action: 'delete', description: 'Delete roles' },

  // Permission management
  {
    name: 'permission:create',
    resource: 'permission',
    action: 'create',
    description: 'Create new permissions',
  },
  {
    name: 'permission:read',
    resource: 'permission',
    action: 'read',
    description: 'View permission details',
  },
  {
    name: 'permission:delete',
    resource: 'permission',
    action: 'delete',
    description: 'Delete permissions',
  },

  // Policy management
  {
    name: 'policy:create',
    resource: 'policy',
    action: 'create',
    description: 'Create new policies',
  },
  { name: 'policy:read', resource: 'policy', action: 'read', description: 'View policy details' },
  {
    name: 'policy:update',
    resource: 'policy',
    action: 'update',
    description: 'Update policy information',
  },
  { name: 'policy:delete', resource: 'policy', action: 'delete', description: 'Delete policies' },

  // Audit log
  { name: 'audit:read', resource: 'audit', action: 'read', description: 'View audit logs' },
];

@Injectable()
export class PermissionService implements OnModuleInit {
  private readonly logger = new Logger(PermissionService.name);

  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>
  ) {}

  /**
   * Initialize default permissions on module startup
   */
  async onModuleInit() {
    await this.seedDefaultPermissions();
  }

  /**
   * Seed default permissions if they don't exist
   */
  private async seedDefaultPermissions() {
    this.logger.log('Checking for default permissions...');

    for (const perm of DEFAULT_PERMISSIONS) {
      const existing = await this.permissionRepo.findOne({
        where: { name: perm.name },
      });

      if (!existing) {
        const permission = this.permissionRepo.create(perm);
        await this.permissionRepo.save(permission);
        this.logger.log(`Created permission: ${perm.name}`);
      }
    }

    this.logger.log('Default permissions check completed');
  }

  /**
   * Create a new permission
   */
  async createPermission(dto: CreatePermissionDto): Promise<Permission> {
    const existing = await this.permissionRepo.findOne({
      where: { name: dto.name },
    });

    if (existing) {
      throw new BadRequestException(`Permission '${dto.name}' already exists`);
    }

    const permission = this.permissionRepo.create({
      name: dto.name,
      resource: dto.resource,
      action: dto.action,
      description: dto.description || null,
    });

    return this.permissionRepo.save(permission);
  }

  /**
   * Get all permissions
   */
  async getPermissions(): Promise<Permission[]> {
    return this.permissionRepo.find({
      order: { resource: 'ASC', action: 'ASC' },
    });
  }

  /**
   * Get permission by ID
   */
  async getPermissionById(id: string): Promise<Permission | null> {
    return this.permissionRepo.findOne({ where: { id } });
  }

  /**
   * Get permissions by resource
   */
  async getPermissionsByResource(resource: string): Promise<Permission[]> {
    return this.permissionRepo.find({
      where: { resource },
      order: { action: 'ASC' },
    });
  }

  /**
   * Delete a permission
   */
  async deletePermission(id: string): Promise<void> {
    const permission = await this.permissionRepo.findOne({ where: { id } });
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    await this.permissionRepo.remove(permission);
    this.logger.log(`Permission '${permission.name}' deleted`);
  }

  /**
   * Check if a user has a specific permission
   * This is a helper that works with RoleService
   */
  async checkPermission(
    userId: string,
    resource: string,
    action: string,
    getUserPermissions: (userId: string) => Promise<string[]>
  ): Promise<boolean> {
    const permissions = await getUserPermissions(userId);

    // Check for exact permission: "resource:action"
    const exactPermission = `${resource}:${action}`;
    if (permissions.includes(exactPermission)) {
      return true;
    }

    // Check for wildcard permission: "resource:*" or "*:action" or "*:*"
    const resourceWildcard = `${resource}:*`;
    const actionWildcard = `*:${action}`;
    const fullWildcard = '*:*';

    return permissions.some(
      (p) => p === resourceWildcard || p === actionWildcard || p === fullWildcard
    );
  }
}
