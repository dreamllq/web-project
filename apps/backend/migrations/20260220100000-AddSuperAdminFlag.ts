import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSuperAdminFlag20260220100000 implements MigrationInterface {
  name = 'AddSuperAdminFlag20260220100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add is_super_admin column to roles table
    await queryRunner.query(`
      ALTER TABLE "roles" 
      ADD COLUMN "is_super_admin" BOOLEAN NOT NULL DEFAULT false
    `);

    // Mark existing super_admin role as super admin
    await queryRunner.query(`
      UPDATE "roles" SET "is_super_admin" = true WHERE "name" = 'super_admin'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove is_super_admin column from roles table
    await queryRunner.query(`
      ALTER TABLE "roles" DROP COLUMN "is_super_admin"
    `);
  }
}
