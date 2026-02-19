import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRolePolicyPermissions20260219100000 implements MigrationInterface {
  name = 'AddRolePolicyPermissions20260219100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create role_permissions junction table
    await queryRunner.query(`
      CREATE TABLE "role_permissions" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "role_id" UUID NOT NULL,
        "permission_id" UUID NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_role_permissions_role" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_role_permissions_permission" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE,
        CONSTRAINT "uq_role_permission" UNIQUE ("role_id", "permission_id")
      )
    `);

    // Create indexes for role_permissions
    await queryRunner.query(
      `CREATE INDEX "idx_role_permissions_role" ON "role_permissions" ("role_id")`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_role_permissions_permission" ON "role_permissions" ("permission_id")`
    );

    // Create policy_permissions junction table
    await queryRunner.query(`
      CREATE TABLE "policy_permissions" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "policy_id" UUID NOT NULL,
        "permission_id" UUID NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_policy_permissions_policy" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_policy_permissions_permission" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE,
        CONSTRAINT "uq_policy_permission" UNIQUE ("policy_id", "permission_id")
      )
    `);

    // Create indexes for policy_permissions
    await queryRunner.query(
      `CREATE INDEX "idx_policy_permissions_policy" ON "policy_permissions" ("policy_id")`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_policy_permissions_permission" ON "policy_permissions" ("permission_id")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop policy_permissions table and indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_policy_permissions_permission"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_policy_permissions_policy"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "policy_permissions"`);

    // Drop role_permissions table and indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_role_permissions_permission"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_role_permissions_role"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permissions"`);
  }
}
