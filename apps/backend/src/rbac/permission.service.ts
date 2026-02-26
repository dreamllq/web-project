import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '../entities/permission.entity';
import type { RequestWithDataFilter } from '../policy/interceptors/data-filter.interceptor';

export interface CreatePermissionDto {
  name: string;
  resource: string;
  action: string;
  description?: string;
}

@Injectable()
export class PermissionService {
  private readonly logger = new Logger(PermissionService.name);

  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>
  ) {}

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
   * Supports ABAC data-level filtering via RequestWithDataFilter
   */
  async getPermissions(request?: RequestWithDataFilter): Promise<Permission[]> {
    const queryBuilder = this.permissionRepo.createQueryBuilder('permission');

    // Apply ABAC data filter conditions if present
    if (request?.dataFilterConditions && request.dataFilterConditions.length > 0) {
      for (const bracket of request.dataFilterConditions) {
        queryBuilder.andWhere(bracket);
      }
    }

    queryBuilder.orderBy('permission.resource', 'ASC').addOrderBy('permission.action', 'ASC');

    return queryBuilder.getMany();
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
