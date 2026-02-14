import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1710000000000 implements MigrationInterface {
  name = 'InitialSchema1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "username" VARCHAR(50) NOT NULL,
        "email" VARCHAR(255),
        "phone" VARCHAR(20),
        "password_hash" VARCHAR(255),
        "nickname" VARCHAR(100),
        "avatar_url" VARCHAR(500),
        "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
        "locale" VARCHAR(10) NOT NULL DEFAULT 'zh-CN',
        "last_login_at" TIMESTAMP,
        "last_login_ip" VARCHAR(45),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP
      )
    `);

    await queryRunner.query(`CREATE UNIQUE INDEX "idx_users_username" ON "users" ("username")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "idx_users_email" ON "users" ("email") WHERE "email" IS NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX "idx_users_phone" ON "users" ("phone") WHERE "phone" IS NOT NULL`);

    // Create social_accounts table
    await queryRunner.query(`
      CREATE TABLE "social_accounts" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL,
        "provider" VARCHAR(50) NOT NULL,
        "provider_user_id" VARCHAR(100) NOT NULL,
        "provider_data" JSONB,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_social_accounts_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE UNIQUE INDEX "idx_social_accounts_provider_user" ON "social_accounts" ("provider", "provider_user_id")`);

    // Create attributes table
    await queryRunner.query(`
      CREATE TABLE "attributes" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "key" VARCHAR(50) NOT NULL,
        "name" VARCHAR(100) NOT NULL,
        "description" VARCHAR(500),
        "type" VARCHAR(20) NOT NULL DEFAULT 'string',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE UNIQUE INDEX "idx_attributes_key" ON "attributes" ("key")`);

    // Create policies table
    await queryRunner.query(`
      CREATE TABLE "policies" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(100) NOT NULL,
        "description" VARCHAR(500),
        "effect" VARCHAR(20) NOT NULL DEFAULT 'allow',
        "subject" VARCHAR(255) NOT NULL,
        "resource" VARCHAR(255) NOT NULL,
        "action" VARCHAR(100) NOT NULL,
        "conditions" JSONB,
        "priority" INTEGER NOT NULL DEFAULT 0,
        "enabled" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_policies_name" ON "policies" ("name")`);
    await queryRunner.query(`CREATE INDEX "idx_policies_subject" ON "policies" ("subject")`);
    await queryRunner.query(`CREATE INDEX "idx_policies_resource" ON "policies" ("resource")`);
    await queryRunner.query(`CREATE INDEX "idx_policies_action" ON "policies" ("action")`);

    // Create policy_attributes table
    await queryRunner.query(`
      CREATE TABLE "policy_attributes" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "policy_id" UUID NOT NULL,
        "attribute_id" UUID NOT NULL,
        "required_value" VARCHAR(255),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_policy_attributes_policy" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_policy_attributes_attribute" FOREIGN KEY ("attribute_id") REFERENCES "attributes"("id") ON DELETE CASCADE,
        CONSTRAINT "uq_policy_attribute" UNIQUE ("policy_id", "attribute_id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_policy_attributes_policy" ON "policy_attributes" ("policy_id")`);
    await queryRunner.query(`CREATE INDEX "idx_policy_attributes_attribute" ON "policy_attributes" ("attribute_id")`);

    // Create audit_logs table
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID,
        "action" VARCHAR(100) NOT NULL,
        "resource_type" VARCHAR(50) NOT NULL,
        "resource_id" VARCHAR(100),
        "ip_address" VARCHAR(45) NOT NULL,
        "user_agent" VARCHAR(500),
        "request_data" JSONB,
        "response_status" INTEGER NOT NULL,
        "error_message" VARCHAR(1000),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_audit_logs_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_audit_logs_user" ON "audit_logs" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "idx_audit_logs_action" ON "audit_logs" ("action")`);
    await queryRunner.query(`CREATE INDEX "idx_audit_logs_resource_type" ON "audit_logs" ("resource_type")`);

    // Create notifications table
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL,
        "type" VARCHAR(20) NOT NULL DEFAULT 'system',
        "title" VARCHAR(200) NOT NULL,
        "content" TEXT NOT NULL,
        "data" JSONB,
        "read_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_notifications_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_notifications_user" ON "notifications" ("user_id")`);

    // Create files table
    await queryRunner.query(`
      CREATE TABLE "files" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL,
        "filename" VARCHAR(255) NOT NULL,
        "stored_name" VARCHAR(255) NOT NULL,
        "mime_type" VARCHAR(100) NOT NULL,
        "size" BIGINT NOT NULL,
        "storage_provider" VARCHAR(20) NOT NULL DEFAULT 'local',
        "storage_path" VARCHAR(500) NOT NULL,
        "url" VARCHAR(1000) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_files_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_files_user" ON "files" ("user_id")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "idx_files_stored_name" ON "files" ("stored_name")`);

    // Create oauth_clients table
    await queryRunner.query(`
      CREATE TABLE "oauth_clients" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "client_id" VARCHAR(100) NOT NULL,
        "client_secret" VARCHAR(255) NOT NULL,
        "name" VARCHAR(100) NOT NULL,
        "redirect_uris" JSONB NOT NULL,
        "allowed_scopes" JSONB NOT NULL,
        "is_confidential" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE UNIQUE INDEX "idx_oauth_clients_client_id" ON "oauth_clients" ("client_id")`);

    // Create oauth_tokens table
    await queryRunner.query(`
      CREATE TABLE "oauth_tokens" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "client_id" UUID NOT NULL,
        "user_id" UUID,
        "access_token" VARCHAR(255) NOT NULL,
        "refresh_token" VARCHAR(255),
        "scopes" JSONB NOT NULL,
        "expires_at" TIMESTAMP NOT NULL,
        "revoked_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_oauth_tokens_client" FOREIGN KEY ("client_id") REFERENCES "oauth_clients"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_oauth_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_oauth_tokens_client" ON "oauth_tokens" ("client_id")`);
    await queryRunner.query(`CREATE INDEX "idx_oauth_tokens_user" ON "oauth_tokens" ("user_id")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "idx_oauth_tokens_access_token" ON "oauth_tokens" ("access_token")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "idx_oauth_tokens_refresh_token" ON "oauth_tokens" ("refresh_token") WHERE "refresh_token" IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "oauth_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "oauth_clients"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "files"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "policy_attributes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "policies"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "attributes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "social_accounts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
