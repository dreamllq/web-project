import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserAuthType1773291899044 implements MigrationInterface {
  name = 'AddUserAuthType1773291899044';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "users_auth_type_enum" AS ENUM ('password', 'oauth', 'hybrid')
    `);

    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN "auth_type" "users_auth_type_enum" NOT NULL DEFAULT 'password'
    `);

    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN "auth_source" character varying(50)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN "auth_source"
    `);

    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN "auth_type"
    `);

    await queryRunner.query(`
      DROP TYPE "users_auth_type_enum"
    `);
  }
}
