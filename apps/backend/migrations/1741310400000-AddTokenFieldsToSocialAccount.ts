import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTokenFieldsToSocialAccount1741310400000 implements MigrationInterface {
  name = 'AddTokenFieldsToSocialAccount1741310400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "social_accounts"
      ADD COLUMN "access_token" character varying(500)
    `);

    await queryRunner.query(`
      ALTER TABLE "social_accounts"
      ADD COLUMN "refresh_token" character varying(500)
    `);

    await queryRunner.query(`
      ALTER TABLE "social_accounts"
      ADD COLUMN "token_expires_at" TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "social_accounts"
      ADD COLUMN "status" character varying(20) NOT NULL DEFAULT 'linked'
    `);

    await queryRunner.query(`
      ALTER TABLE "social_accounts"
      ADD COLUMN "unbound_at" TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "social_accounts" DROP COLUMN "unbound_at"`);
    await queryRunner.query(`ALTER TABLE "social_accounts" DROP COLUMN "status"`);
    await queryRunner.query(`ALTER TABLE "social_accounts" DROP COLUMN "token_expires_at"`);
    await queryRunner.query(`ALTER TABLE "social_accounts" DROP COLUMN "refresh_token"`);
    await queryRunner.query(`ALTER TABLE "social_accounts" DROP COLUMN "access_token"`);
  }
}
