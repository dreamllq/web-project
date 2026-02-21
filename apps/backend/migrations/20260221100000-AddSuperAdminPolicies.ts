import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add Super Admin ABAC Policies
 *
 * Creates individual ABAC policies for all users who have a role with is_super_admin=true.
 * Each super admin user gets a wildcard policy with priority 1000 (highest).
 *
 * This follows the ABAC migration plan Task 2.5.
 */
export class AddSuperAdminPolicies20260221100000 implements MigrationInterface {
  name = 'AddSuperAdminPolicies20260221100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Insert individual ABAC policies for all super admin users
    // Users with roles where is_super_admin=true get full access via ABAC
    await queryRunner.query(`
      INSERT INTO "policies" (
        "id",
        "name",
        "description",
        "effect",
        "subject",
        "resource",
        "action",
        "conditions",
        "priority",
        "enabled",
        "created_at",
        "updated_at"
      )
      SELECT
        gen_random_uuid(),
        'Super Admin User - ' || u.username || ' - Full Access',
        'Full access policy for super administrator user: ' || u.username,
        'allow',
        'user:' || u.id,
        '*',
        '*',
        NULL,
        1000,
        true,
        now(),
        now()
      FROM "users" u
      INNER JOIN "user_roles" ur ON ur.user_id = u.id
      INNER JOIN "roles" r ON r.id = ur.role_id
      WHERE r.is_super_admin = true
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove all super admin individual user policies
    // These are identified by subject pattern 'user:{uuid}' and priority 1000
    await queryRunner.query(`
      DELETE FROM "policies"
      WHERE subject LIKE 'user:%'
        AND priority = 1000
        AND resource = '*'
        AND action = '*'
    `);
  }
}
