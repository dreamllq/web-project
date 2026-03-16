import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddOAuthProviderConfig1772846374000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'oauth_provider_configs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'code',
            type: 'enum',
            enum: [
              'wechat',
              'wechat_miniprogram',
              'dingtalk_miniprogram',
              'dingtalk',
              'feishu',
              'douyin',
              'qq',
              'baidu',
            ],
            isUnique: true,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'app_id',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'app_secret',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'redirect_uri',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'enabled',
            type: 'boolean',
            default: true,
          },
          {
            name: 'config',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    await queryRunner.createIndex(
      'oauth_provider_configs',
      new TableIndex({
        name: 'IDX_oauth_provider_configs_code',
        columnNames: ['code'],
        isUnique: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('oauth_provider_configs');
  }
}
