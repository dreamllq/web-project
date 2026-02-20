import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveRedundantRbacColumns20260220000000 implements MigrationInterface {
  name = 'RemoveRedundantRbacColumns20260220000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes on columns we're removing
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_policies_resource"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_policies_action"`);

    // Drop redundant columns from policies table
    await queryRunner.query(`
      ALTER TABLE "policies"
      DROP COLUMN IF EXISTS "resource",
      DROP COLUMN IF EXISTS "action"
    `);

    // Drop redundant permissions column from roles table
    await queryRunner.query(`
      ALTER TABLE "roles"
      DROP COLUMN IF EXISTS "permissions"
    `);

    // Insert default permissions (seed data)
    const defaultPermissions = [
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
      {
        name: 'policy:read',
        resource: 'policy',
        action: 'read',
        description: 'View policy details',
      },
      {
        name: 'policy:update',
        resource: 'policy',
        action: 'update',
        description: 'Update policy information',
      },
      {
        name: 'policy:delete',
        resource: 'policy',
        action: 'delete',
        description: 'Delete policies',
      },
      // Audit log
      { name: 'audit:read', resource: 'audit', action: 'read', description: 'View audit logs' },
    ];

    for (const perm of defaultPermissions) {
      await queryRunner.query(
        `INSERT INTO "permissions" ("id", "name", "resource", "action", "description")
         SELECT gen_random_uuid()::uuid, $1::varchar, $2::varchar, $3::varchar, $4::varchar
         WHERE NOT EXISTS (SELECT 1 FROM "permissions" WHERE "name" = $1::varchar)`,
        [perm.name, perm.resource, perm.action, perm.description]
      );
    }

    // Insert default super admin role (if not exists)
    await queryRunner.query(`
      INSERT INTO "roles" ("id", "name", "description", "created_at", "updated_at")
      SELECT gen_random_uuid(), 'super_admin', 'Super administrator with full access', now(), now()
      WHERE NOT EXISTS (SELECT 1 FROM "roles" WHERE "name" = 'super_admin')
    `);

    // Assign all permissions to super_admin role
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "created_at")
      SELECT gen_random_uuid(), r.id, p.id, now()
      FROM "roles" r
      CROSS JOIN "permissions" p
      WHERE r.name = 'super_admin'
      AND NOT EXISTS (
        SELECT 1 FROM "role_permissions" rp 
        WHERE rp.role_id = r.id AND rp.permission_id = p.id
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove super_admin role permissions first (due to foreign key)
    await queryRunner.query(`
      DELETE FROM "role_permissions" 
      WHERE role_id IN (SELECT id FROM "roles" WHERE name = 'super_admin')
    `);

    // Remove super_admin role
    await queryRunner.query(`DELETE FROM "roles" WHERE name = 'super_admin'`);

    // Remove default permissions
    const permissionNames = [
      'user:create',
      'user:read',
      'user:update',
      'user:delete',
      'role:create',
      'role:read',
      'role:update',
      'role:delete',
      'permission:create',
      'permission:read',
      'permission:delete',
      'policy:create',
      'policy:read',
      'policy:update',
      'policy:delete',
      'audit:read',
    ];

    for (const name of permissionNames) {
      await queryRunner.query(`DELETE FROM "permissions" WHERE "name" = $1`, [name]);
    }

    // Add back permissions column to roles table
    await queryRunner.query(`
      ALTER TABLE "roles"
      ADD COLUMN "permissions" TEXT[] DEFAULT '{}'
    `);

    // Add back resource and action columns to policies table
    await queryRunner.query(`
      ALTER TABLE "policies"
      ADD COLUMN "resource" VARCHAR(255) NOT NULL DEFAULT '',
      ADD COLUMN "action" VARCHAR(100) NOT NULL DEFAULT ''
    `);

    // Recreate indexes
    await queryRunner.query(`CREATE INDEX "idx_policies_resource" ON "policies" ("resource")`);
    await queryRunner.query(`CREATE INDEX "idx_policies_action" ON "policies" ("action")`);
  }
}
