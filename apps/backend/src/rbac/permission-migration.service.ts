import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { Policy } from '../entities/policy.entity';
import { PolicyPermission } from '../entities/policy-permission.entity';

export interface MigrationResult {
  success: boolean;
  migratedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: string[];
}

export interface ValidationSummary {
  rolePermissions: {
    totalRoles: number;
    rolesWithPermissions: number;
    totalRolePermissionRecords: number;
    missingMappings: string[];
  };
  policyPermissions: {
    totalPolicies: number;
    policiesWithPermissions: number;
    totalPolicyPermissionRecords: number;
    missingMappings: string[];
  };
}

@Injectable()
export class PermissionMigrationService {
  private readonly logger = new Logger(PermissionMigrationService.name);

  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepo: Repository<RolePermission>,
    @InjectRepository(Policy)
    private readonly policyRepo: Repository<Policy>,
    @InjectRepository(PolicyPermission)
    private readonly policyPermissionRepo: Repository<PolicyPermission>
  ) {}

  /**
   * Migrate Role.permissions string array to RolePermission records
   *
   * Process:
   * 1. Get all roles with their permissions array
   * 2. Get all permissions and create a map by name
   * 3. For each role, for each permission name in permissions array:
   *    - Find the Permission entity by name
   *    - Create RolePermission record if not exists
   */
  async migrateRolePermissions(): Promise<MigrationResult> {
    this.logger.log('Starting role permissions migration...');

    const result: MigrationResult = {
      success: true,
      migratedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      errors: [],
    };

    try {
      // Get all roles
      const roles = await this.roleRepo.find();
      this.logger.log(`Found ${roles.length} roles to process`);

      // Get all permissions and create a map by name
      const permissions = await this.permissionRepo.find();
      const permissionMap = new Map<string, Permission>();
      for (const perm of permissions) {
        permissionMap.set(perm.name, perm);
      }
      this.logger.log(`Found ${permissions.length} permissions available`);

      // Get existing role-permission mappings to avoid duplicates
      const existingMappings = await this.rolePermissionRepo.find();
      const existingKeys = new Set<string>();
      for (const mapping of existingMappings) {
        existingKeys.add(`${mapping.roleId}:${mapping.permissionId}`);
      }

      // Process each role
      for (const role of roles) {
        if (!role.permissions || role.permissions.length === 0) {
          this.logger.debug(`Role '${role.name}' has no permissions to migrate`);
          continue;
        }

        this.logger.debug(
          `Processing role '${role.name}' with ${role.permissions.length} permissions`
        );

        for (const permissionName of role.permissions) {
          const permission = permissionMap.get(permissionName);

          if (!permission) {
            const errorMsg = `Permission '${permissionName}' not found for role '${role.name}'`;
            this.logger.warn(errorMsg);
            result.errors.push(errorMsg);
            result.errorCount++;
            continue;
          }

          // Check if mapping already exists
          const mappingKey = `${role.id}:${permission.id}`;
          if (existingKeys.has(mappingKey)) {
            this.logger.debug(
              `RolePermission already exists: role='${role.name}', permission='${permissionName}'`
            );
            result.skippedCount++;
            continue;
          }

          // Create new RolePermission record
          try {
            const rolePermission = this.rolePermissionRepo.create({
              roleId: role.id,
              permissionId: permission.id,
            });
            await this.rolePermissionRepo.save(rolePermission);

            existingKeys.add(mappingKey); // Track to avoid duplicates in same run
            result.migratedCount++;

            this.logger.debug(
              `Created RolePermission: role='${role.name}', permission='${permissionName}'`
            );
          } catch (error) {
            const errorMsg = `Failed to create RolePermission for role='${role.name}', permission='${permissionName}': ${error}`;
            this.logger.error(errorMsg);
            result.errors.push(errorMsg);
            result.errorCount++;
          }
        }
      }

      this.logger.log(
        `Role permissions migration completed: ${result.migratedCount} migrated, ${result.skippedCount} skipped, ${result.errorCount} errors`
      );
    } catch (error) {
      result.success = false;
      result.errors.push(`Migration failed: ${error}`);
      this.logger.error(`Role permissions migration failed: ${error}`);
    }

    return result;
  }

  /**
   * Migrate Policy resource/action to PolicyPermission records
   *
   * Process:
   * 1. Get all policies
   * 2. Get all permissions
   * 3. For each policy, find permission where resource matches and action matches
   *    - Create PolicyPermission record if not exists
   */
  async migratePolicyPermissions(): Promise<MigrationResult> {
    this.logger.log('Starting policy permissions migration...');

    const result: MigrationResult = {
      success: true,
      migratedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      errors: [],
    };

    try {
      // Get all policies
      const policies = await this.policyRepo.find();
      this.logger.log(`Found ${policies.length} policies to process`);

      // Get all permissions
      const permissions = await this.permissionRepo.find();

      // Create a map by resource:action for efficient lookup
      const permissionByResourceAction = new Map<string, Permission>();
      for (const perm of permissions) {
        const key = `${perm.resource}:${perm.action}`;
        permissionByResourceAction.set(key, perm);
      }
      this.logger.log(`Found ${permissions.length} permissions available`);

      // Get existing policy-permission mappings to avoid duplicates
      const existingMappings = await this.policyPermissionRepo.find();
      const existingKeys = new Set<string>();
      for (const mapping of existingMappings) {
        existingKeys.add(`${mapping.policyId}:${mapping.permissionId}`);
      }

      // Process each policy
      for (const policy of policies) {
        this.logger.debug(
          `Processing policy '${policy.name}' (resource='${policy.resource}', action='${policy.action}')`
        );

        // Find matching permission by resource and action
        const resourceActionKey = `${policy.resource}:${policy.action}`;
        const permission = permissionByResourceAction.get(resourceActionKey);

        if (!permission) {
          const errorMsg = `No permission found matching resource='${policy.resource}', action='${policy.action}' for policy '${policy.name}'`;
          this.logger.warn(errorMsg);
          result.errors.push(errorMsg);
          result.errorCount++;
          continue;
        }

        // Check if mapping already exists
        const mappingKey = `${policy.id}:${permission.id}`;
        if (existingKeys.has(mappingKey)) {
          this.logger.debug(
            `PolicyPermission already exists: policy='${policy.name}', permission='${permission.name}'`
          );
          result.skippedCount++;
          continue;
        }

        // Create new PolicyPermission record
        try {
          const policyPermission = this.policyPermissionRepo.create({
            policyId: policy.id,
            permissionId: permission.id,
          });
          await this.policyPermissionRepo.save(policyPermission);

          existingKeys.add(mappingKey); // Track to avoid duplicates in same run
          result.migratedCount++;

          this.logger.log(
            `Created PolicyPermission: policy='${policy.name}', permission='${permission.name}'`
          );
        } catch (error) {
          const errorMsg = `Failed to create PolicyPermission for policy='${policy.name}': ${error}`;
          this.logger.error(errorMsg);
          result.errors.push(errorMsg);
          result.errorCount++;
        }
      }

      this.logger.log(
        `Policy permissions migration completed: ${result.migratedCount} migrated, ${result.skippedCount} skipped, ${result.errorCount} errors`
      );
    } catch (error) {
      result.success = false;
      result.errors.push(`Migration failed: ${error}`);
      this.logger.error(`Policy permissions migration failed: ${error}`);
    }

    return result;
  }

  /**
   * Validate migration completed successfully
   *
   * Checks:
   * - For each role, verify all permissions in permissions array have RolePermission records
   * - For each policy, verify a matching PolicyPermission record exists
   * - Report any discrepancies
   */
  async validateMigration(): Promise<ValidationSummary> {
    this.logger.log('Starting migration validation...');

    const summary: ValidationSummary = {
      rolePermissions: {
        totalRoles: 0,
        rolesWithPermissions: 0,
        totalRolePermissionRecords: 0,
        missingMappings: [],
      },
      policyPermissions: {
        totalPolicies: 0,
        policiesWithPermissions: 0,
        totalPolicyPermissionRecords: 0,
        missingMappings: [],
      },
    };

    // Validate Role Permissions
    try {
      const roles = await this.roleRepo.find();

      const rolePermissions = await this.rolePermissionRepo.find({
        relations: ['role', 'permission'],
      });

      // Build a map of roleId -> Set of permission names
      const rolePermissionMap = new Map<string, Set<string>>();
      for (const rp of rolePermissions) {
        if (!rolePermissionMap.has(rp.roleId)) {
          rolePermissionMap.set(rp.roleId, new Set());
        }
        rolePermissionMap.get(rp.roleId)!.add(rp.permission.name);
      }

      summary.rolePermissions.totalRoles = roles.length;
      summary.rolePermissions.totalRolePermissionRecords = rolePermissions.length;

      for (const role of roles) {
        if (role.permissions && role.permissions.length > 0) {
          summary.rolePermissions.rolesWithPermissions++;

          const migratedPerms = rolePermissionMap.get(role.id) || new Set();

          for (const permName of role.permissions) {
            if (!migratedPerms.has(permName)) {
              const missingMsg = `Role '${role.name}' missing permission '${permName}'`;
              summary.rolePermissions.missingMappings.push(missingMsg);
              this.logger.warn(missingMsg);
            }
          }
        }
      }

      this.logger.log(
        `Role validation: ${summary.rolePermissions.totalRoles} roles, ` +
          `${summary.rolePermissions.totalRolePermissionRecords} records, ` +
          `${summary.rolePermissions.missingMappings.length} missing`
      );
    } catch (error) {
      this.logger.error(`Role permission validation failed: ${error}`);
      summary.rolePermissions.missingMappings.push(`Validation error: ${error}`);
    }

    // Validate Policy Permissions
    try {
      const policies = await this.policyRepo.find();
      const permissions = await this.permissionRepo.find();

      // Create a map of permission id to resource:action
      const permissionResourceAction = new Map<string, string>();
      for (const perm of permissions) {
        permissionResourceAction.set(perm.id, `${perm.resource}:${perm.action}`);
      }

      const policyPermissions = await this.policyPermissionRepo.find({
        relations: ['policy', 'permission'],
      });

      // Build a map of policyId -> Set of resource:action
      const policyPermissionMap = new Map<string, Set<string>>();
      for (const pp of policyPermissions) {
        if (!policyPermissionMap.has(pp.policyId)) {
          policyPermissionMap.set(pp.policyId, new Set());
        }
        const resourceAction = permissionResourceAction.get(pp.permissionId) || '';
        policyPermissionMap.get(pp.policyId)!.add(resourceAction);
      }

      summary.policyPermissions.totalPolicies = policies.length;
      summary.policyPermissions.totalPolicyPermissionRecords = policyPermissions.length;

      for (const policy of policies) {
        const expectedKey = `${policy.resource}:${policy.action}`;
        const migratedPerms = policyPermissionMap.get(policy.id) || new Set();

        if (migratedPerms.size > 0) {
          summary.policyPermissions.policiesWithPermissions++;
        }

        if (!migratedPerms.has(expectedKey)) {
          const missingMsg = `Policy '${policy.name}' missing permission for resource='${policy.resource}', action='${policy.action}'`;
          summary.policyPermissions.missingMappings.push(missingMsg);
          this.logger.warn(missingMsg);
        }
      }

      this.logger.log(
        `Policy validation: ${summary.policyPermissions.totalPolicies} policies, ` +
          `${summary.policyPermissions.totalPolicyPermissionRecords} records, ` +
          `${summary.policyPermissions.missingMappings.length} missing`
      );
    } catch (error) {
      this.logger.error(`Policy permission validation failed: ${error}`);
      summary.policyPermissions.missingMappings.push(`Validation error: ${error}`);
    }

    this.logger.log('Migration validation completed');
    return summary;
  }

  /**
   * Run full migration: migrate both role and policy permissions, then validate
   */
  async runFullMigration(): Promise<{
    roleMigration: MigrationResult;
    policyMigration: MigrationResult;
    validation: ValidationSummary;
  }> {
    this.logger.log('=== Starting Full Permission Migration ===');

    const roleMigration = await this.migrateRolePermissions();
    const policyMigration = await this.migratePolicyPermissions();
    const validation = await this.validateMigration();

    this.logger.log('=== Full Permission Migration Completed ===');
    this.logger.log(
      `Results: Role(${roleMigration.migratedCount} migrated, ${roleMigration.errorCount} errors), ` +
        `Policy(${policyMigration.migratedCount} migrated, ${policyMigration.errorCount} errors), ` +
        `Validation(${validation.rolePermissions.missingMappings.length + validation.policyPermissions.missingMappings.length} issues)`
    );

    return {
      roleMigration,
      policyMigration,
      validation,
    };
  }
}
