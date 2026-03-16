import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPrivateRoomConstraints1773500000000 implements MigrationInterface {
  name = 'AddPrivateRoomConstraints1773500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 添加 user_pair_key 列到 chat_rooms (用于唯一标识私聊房间)
    // VARCHAR(73) = 36 (UUID) + 1 (:) + 36 (UUID) = 两个用户ID的拼接
    await queryRunner.query(`
      ALTER TABLE "chat_rooms" 
      ADD COLUMN "user_pair_key" character varying(73)
    `);

    // 2. 创建部分唯一索引（仅对 private 类型生效）
    // 确保同一对用户只能有一个私聊房间
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_chat_rooms_user_pair_key_private" 
      ON "chat_rooms" ("user_pair_key") 
      WHERE "type" = 'private'
    `);

    // 3. 添加 is_hidden 列到 chat_room_members (用于软删除/隐藏房间)
    await queryRunner.query(`
      ALTER TABLE "chat_room_members" 
      ADD COLUMN "is_hidden" boolean NOT NULL DEFAULT false
    `);

    // 4. 为 is_hidden 添加索引（优化查询隐藏房间的性能）
    await queryRunner.query(`
      CREATE INDEX "IDX_chat_room_members_is_hidden" 
      ON "chat_room_members" ("is_hidden")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 回滚顺序：先删除后创建的，后删除先创建的

    // 1. 删除 is_hidden 索引
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_chat_room_members_is_hidden"`);

    // 2. 删除 is_hidden 列
    await queryRunner.query(`ALTER TABLE "chat_room_members" DROP COLUMN IF EXISTS "is_hidden"`);

    // 3. 删除部分唯一索引
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_chat_rooms_user_pair_key_private"`);

    // 4. 删除 user_pair_key 列
    await queryRunner.query(`ALTER TABLE "chat_rooms" DROP COLUMN IF EXISTS "user_pair_key"`);
  }
}
