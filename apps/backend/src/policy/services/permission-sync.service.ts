import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PERMISSION_KEY, PermissionMetadata } from '../decorators/require-permission.decorator';
import { Permission } from '../../entities/permission.entity';

/**
 * PermissionSyncService
 *
 * Automatically synchronizes permissions from @RequirePermission decorators
 * to the database on application startup.
 *
 * This service scans all controller methods for @RequirePermission decorators,
 * extracts (resource, action) combinations, and creates missing Permission records
 * in the database.
 *
 * Note: This service only creates new permissions - it never deletes existing ones.
 */
@Injectable()
export class PermissionSyncService implements OnModuleInit {
  private readonly logger = new Logger(PermissionSyncService.name);

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly reflector: Reflector,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>
  ) {}

  /**
   * Triggered when the module is initialized.
   * Automatically syncs permissions on application startup.
   */
  async onModuleInit(): Promise<void> {
    await this.syncPermissions();
  }

  /**
   * Synchronize permissions from decorators to database.
   *
   * Scans all controller methods for @RequirePermission decorators,
   * extracts (resource, action) combinations, and creates missing
   * Permission records in the database.
   */
  async syncPermissions(): Promise<{ total: number; created: number }> {
    this.logger.log('Starting permission synchronization...');

    // Get all controllers from the application
    const controllers = this.discoveryService.getControllers();

    // Collect all permission requirements from decorators
    const requiredPermissions = new Map<string, PermissionMetadata>();

    for (const wrapper of controllers) {
      const { instance } = wrapper;
      if (!instance) continue;

      const prototype = Object.getPrototypeOf(instance);
      const methodNames = Object.getOwnPropertyNames(prototype).filter(
        (method) => method !== 'constructor' && typeof prototype[method] === 'function'
      );

      for (const methodName of methodNames) {
        const metadata = this.reflector.get<PermissionMetadata>(
          PERMISSION_KEY,
          prototype[methodName]
        );

        if (metadata) {
          const key = `${metadata.resource}:${metadata.action}`;
          requiredPermissions.set(key, metadata);
        }
      }
    }

    this.logger.log(`Found ${requiredPermissions.size} unique permissions in decorators`);

    // Get existing permissions from database
    const existingPermissions = await this.permissionRepository.find();
    const existingKeys = new Set(existingPermissions.map((p) => `${p.resource}:${p.action}`));

    // Create missing permissions
    let created = 0;
    for (const [key, metadata] of requiredPermissions) {
      if (!existingKeys.has(key)) {
        const permission = this.permissionRepository.create({
          resource: metadata.resource,
          action: metadata.action,
          name: `${metadata.resource}:${metadata.action}`,
          description: null,
        });
        await this.permissionRepository.save(permission);
        created++;
        this.logger.log(`Created permission: ${key}`);
      }
    }

    this.logger.log(`Permission sync complete. Created ${created} new permissions.`);

    return {
      total: requiredPermissions.size,
      created,
    };
  }
}
