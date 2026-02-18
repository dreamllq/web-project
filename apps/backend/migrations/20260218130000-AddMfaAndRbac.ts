import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMfaAndRbac20260218130000 implements MigrationInterface {
  name = 'AddMfaAndRbac20260218130000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add 2FA columns to users table
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN "mfa_secret" VARCHAR(255),
      ADD COLUMN "recovery_codes" TEXT[]
    `);

    // Create roles table
    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(50) NOT NULL,
        "description" VARCHAR(255),
        "permissions" TEXT[] DEFAULT '{}',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "uq_roles_name" UNIQUE ("name")
      )
    `);

    // Create permissions table
    await queryRunner.query(`
      CREATE TABLE "permissions" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(100) NOT NULL,
        "resource" VARCHAR(100) NOT NULL,
        "action" VARCHAR(50) NOT NULL,
        "description" VARCHAR(255),
        CONSTRAINT "uq_permissions_name" UNIQUE ("name")
      )
    `);

    // Create user_roles junction table
    await queryRunner.query(`
      CREATE TABLE "user_roles" (
        "user_id" UUID NOT NULL,
        "role_id" UUID NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        PRIMARY KEY ("user_id", "role_id"),
        CONSTRAINT "fk_user_roles_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_user_roles_role" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes for performance
    await queryRunner.query(`CREATE INDEX "idx_roles_name" ON "roles" ("name")`);
    await queryRunner.query(`CREATE INDEX "idx_permissions_name" ON "permissions" ("name")`);
    await queryRunner.query(
      `CREATE INDEX "idx_permissions_resource" ON "permissions" ("resource")`
    );
    await queryRunner.query(`CREATE INDEX "idx_user_roles_user_id" ON "user_roles" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "idx_user_roles_role_id" ON "user_roles" ("role_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop user_roles table and indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_user_roles_role_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_user_roles_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_roles"`);

    // Drop permissions table and indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_permissions_resource"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_permissions_name"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "permissions"`);

    // Drop roles table and indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_roles_name"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles"`);

    // Remove 2FA columns from users table
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "recovery_codes",
      DROP COLUMN IF EXISTS "mfa_secret",
      DROP COLUMN IF EXISTS "mfa_enabled"
    `);
  }
}
