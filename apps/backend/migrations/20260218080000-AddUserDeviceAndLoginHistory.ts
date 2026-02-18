import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserDeviceAndLoginHistory20260218080000 implements MigrationInterface {
  name = 'AddUserDeviceAndLoginHistory20260218080000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create user_devices table
    await queryRunner.query(`
      CREATE TABLE "user_devices" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL,
        "device_fingerprint" VARCHAR(255) NOT NULL,
        "device_name" VARCHAR(255),
        "user_agent" VARCHAR(500),
        "ip_address" VARCHAR(45),
        "trusted" BOOLEAN NOT NULL DEFAULT false,
        "last_used_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_user_devices_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes for user_devices
    await queryRunner.query(
      `CREATE INDEX "idx_user_devices_user_id" ON "user_devices" ("user_id")`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_devices_device_fingerprint" ON "user_devices" ("device_fingerprint")`
    );

    // Create login_histories table
    await queryRunner.query(`
      CREATE TABLE "login_histories" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID,
        "ip_address" VARCHAR(45),
        "user_agent" VARCHAR(500),
        "device_fingerprint" VARCHAR(255),
        "login_method" VARCHAR(20),
        "success" BOOLEAN NOT NULL DEFAULT false,
        "failure_reason" VARCHAR(255),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_login_histories_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    // Create indexes for login_histories
    await queryRunner.query(
      `CREATE INDEX "idx_login_histories_user_id" ON "login_histories" ("user_id")`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_login_histories_device_fingerprint" ON "login_histories" ("device_fingerprint")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop login_histories table
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_login_histories_device_fingerprint"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_login_histories_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "login_histories"`);

    // Drop user_devices table
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_user_devices_device_fingerprint"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_user_devices_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_devices"`);
  }
}
