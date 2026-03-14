import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateChatTables1773487068566 implements MigrationInterface {
  name = 'CreateChatTables1773487068566';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create chat_rooms table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chat_rooms" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "type" character varying NOT NULL DEFAULT 'private',
        "name" character varying(100),
        "avatar" character varying(500),
        "owner_id" UUID,
        "last_message_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chat_rooms" PRIMARY KEY ("id")
      )
    `);

    // Create chat_room_members table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chat_room_members" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "room_id" UUID NOT NULL,
        "user_id" UUID NOT NULL,
        "role" character varying NOT NULL DEFAULT 'member',
        "last_read_at" TIMESTAMP NOT NULL DEFAULT now(),
        "muted" boolean NOT NULL DEFAULT false,
        "joined_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chat_room_members" PRIMARY KEY ("id")
      )
    `);

    // Create chat_messages table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chat_messages" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "room_id" UUID NOT NULL,
        "sender_id" UUID NOT NULL,
        "type" character varying NOT NULL DEFAULT 'text',
        "content" text NOT NULL,
        "metadata" jsonb,
        "reply_to_id" UUID,
        "edited_at" TIMESTAMP,
        "deleted_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chat_messages" PRIMARY KEY ("id")
      )
    `);

    // Create chat_message_reads table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chat_message_reads" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "message_id" UUID NOT NULL,
        "user_id" UUID NOT NULL,
        "read_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chat_message_reads" PRIMARY KEY ("id")
      )
    `);

    // Add indexes for chat_rooms
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_chat_rooms_type" ON "chat_rooms" ("type")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_chat_rooms_owner_id" ON "chat_rooms" ("owner_id")`
    );

    // Add indexes for chat_room_members
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_chat_room_members_room_id" ON "chat_room_members" ("room_id")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_chat_room_members_user_id" ON "chat_room_members" ("user_id")`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_chat_room_members_room_user" ON "chat_room_members" ("room_id", "user_id")`
    );

    // Add indexes for chat_messages
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_chat_messages_room_id" ON "chat_messages" ("room_id")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_chat_messages_sender_id" ON "chat_messages" ("sender_id")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_chat_messages_created_at" ON "chat_messages" ("created_at")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_chat_messages_room_created" ON "chat_messages" ("room_id", "created_at")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_chat_messages_reply_to_id" ON "chat_messages" ("reply_to_id")`
    );

    // Add indexes for chat_message_reads
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_chat_message_reads_message_id" ON "chat_message_reads" ("message_id")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_chat_message_reads_user_id" ON "chat_message_reads" ("user_id")`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_chat_message_reads_message_user" ON "chat_message_reads" ("message_id", "user_id")`
    );

    // Add foreign key constraints for chat_rooms
    await queryRunner.query(`
      ALTER TABLE "chat_rooms"
      ADD CONSTRAINT "FK_chat_rooms_owner_id"
      FOREIGN KEY ("owner_id")
      REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE
    `);

    // Add foreign key constraints for chat_room_members
    await queryRunner.query(`
      ALTER TABLE "chat_room_members"
      ADD CONSTRAINT "FK_chat_room_members_room_id"
      FOREIGN KEY ("room_id")
      REFERENCES "chat_rooms"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_room_members"
      ADD CONSTRAINT "FK_chat_room_members_user_id"
      FOREIGN KEY ("user_id")
      REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
    `);

    // Add foreign key constraints for chat_messages
    await queryRunner.query(`
      ALTER TABLE "chat_messages"
      ADD CONSTRAINT "FK_chat_messages_room_id"
      FOREIGN KEY ("room_id")
      REFERENCES "chat_rooms"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_messages"
      ADD CONSTRAINT "FK_chat_messages_sender_id"
      FOREIGN KEY ("sender_id")
      REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_messages"
      ADD CONSTRAINT "FK_chat_messages_reply_to_id"
      FOREIGN KEY ("reply_to_id")
      REFERENCES "chat_messages"("id")
      ON DELETE SET NULL ON UPDATE CASCADE
    `);

    // Add foreign key constraints for chat_message_reads
    await queryRunner.query(`
      ALTER TABLE "chat_message_reads"
      ADD CONSTRAINT "FK_chat_message_reads_message_id"
      FOREIGN KEY ("message_id")
      REFERENCES "chat_messages"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_message_reads"
      ADD CONSTRAINT "FK_chat_message_reads_user_id"
      FOREIGN KEY ("user_id")
      REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
    `);

    // Create enum types check constraints (for consistency with TypeORM)
    await queryRunner.query(`
      ALTER TABLE "chat_rooms"
      ADD CONSTRAINT "CHK_chat_rooms_type"
      CHECK ("type" IN ('private', 'group', 'broadcast'))
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_room_members"
      ADD CONSTRAINT "CHK_chat_room_members_role"
      CHECK ("role" IN ('owner', 'admin', 'member'))
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_messages"
      ADD CONSTRAINT "CHK_chat_messages_type"
      CHECK ("type" IN ('text', 'image', 'file', 'emoji', 'system'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop chat_message_reads table and constraints
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_message_reads"`);

    // Drop chat_messages table and constraints
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_messages"`);

    // Drop chat_room_members table and constraints
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_room_members"`);

    // Drop chat_rooms table and constraints
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_rooms"`);
  }
}
