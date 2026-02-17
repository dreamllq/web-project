import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVerificationFields20260216120000 implements MigrationInterface {
  name = 'AddVerificationFields20260216120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add email_verified_at and phone_verified_at columns to users table
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "email_verified_at" TIMESTAMP,
      ADD COLUMN "phone_verified_at" TIMESTAMP
    `);

    // Set existing users' emailVerifiedAt to current time (data migration)
    await queryRunner.query(`
      UPDATE "users"
      SET "email_verified_at" = now()
      WHERE "email" IS NOT NULL AND "email_verified_at" IS NULL
    `);

    // Create verification_tokens table
    await queryRunner.query(`
      CREATE TABLE "verification_tokens" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL,
        "token" VARCHAR(255) NOT NULL,
        "type" VARCHAR(50) NOT NULL,
        "expires_at" TIMESTAMP NOT NULL,
        "used_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_verification_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes for verification_tokens
    await queryRunner.query(
      `CREATE INDEX "idx_verification_tokens_user_id" ON "verification_tokens" ("user_id")`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_verification_tokens_token" ON "verification_tokens" ("token")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop verification_tokens table
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_verification_tokens_token"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_verification_tokens_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "verification_tokens"`);

    // Remove columns from users table
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "phone_verified_at",
      DROP COLUMN IF EXISTS "email_verified_at"
    `);
  }
}
