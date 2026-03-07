import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class AddOAuthIntegration1772852064583 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create social_accounts table
    await queryRunner.createTable(
      new Table({
        name: 'social_accounts',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'provider',
            type: 'enum',
            enum: [
              'wechat',
              'wechat_miniprogram',
              'dingtalk_miniprogram',
              'dingtalk',
              'feishu',
              'qq',
              'douyin',
              'baidu',
            ],
          },
          {
            name: 'provider_user_id',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'provider_data',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'access_token',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'refresh_token',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'token_expires_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['linked', 'unlinked'],
            default: "'linked'",
          },
          {
            name: 'unbound_at',
            type: 'timestamp',
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

    // Create unique composite index for provider + provider_user_id
    await queryRunner.createIndex(
      'social_accounts',
      new TableIndex({
        name: 'IDX_social_accounts_provider_user',
        columnNames: ['provider', 'provider_user_id'],
        isUnique: true,
      })
    );

    // Create index on user_id
    await queryRunner.createIndex(
      'social_accounts',
      new TableIndex({
        name: 'IDX_social_accounts_user_id',
        columnNames: ['user_id'],
      })
    );

    // Add foreign key to users table
    await queryRunner.createForeignKey(
      'social_accounts',
      new TableForeignKey({
        name: 'FK_social_accounts_user_id',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    // Create oauth_clients table
    await queryRunner.createTable(
      new Table({
        name: 'oauth_clients',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'client_id',
            type: 'varchar',
            length: '100',
            isUnique: true,
          },
          {
            name: 'client_secret',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'redirect_uris',
            type: 'jsonb',
          },
          {
            name: 'allowed_scopes',
            type: 'jsonb',
          },
          {
            name: 'is_confidential',
            type: 'boolean',
            default: true,
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

    // Create unique index on client_id
    await queryRunner.createIndex(
      'oauth_clients',
      new TableIndex({
        name: 'IDX_oauth_clients_client_id',
        columnNames: ['client_id'],
        isUnique: true,
      })
    );

    // Create oauth_tokens table
    await queryRunner.createTable(
      new Table({
        name: 'oauth_tokens',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'client_id',
            type: 'uuid',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'access_token',
            type: 'varchar',
            length: '255',
            isUnique: true,
          },
          {
            name: 'refresh_token',
            type: 'varchar',
            length: '255',
            isNullable: true,
            isUnique: true,
          },
          {
            name: 'scopes',
            type: 'jsonb',
          },
          {
            name: 'expires_at',
            type: 'timestamp',
          },
          {
            name: 'revoked_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    // Create indexes for oauth_tokens
    await queryRunner.createIndex(
      'oauth_tokens',
      new TableIndex({
        name: 'IDX_oauth_tokens_client_id',
        columnNames: ['client_id'],
      })
    );

    await queryRunner.createIndex(
      'oauth_tokens',
      new TableIndex({
        name: 'IDX_oauth_tokens_user_id',
        columnNames: ['user_id'],
      })
    );

    await queryRunner.createIndex(
      'oauth_tokens',
      new TableIndex({
        name: 'IDX_oauth_tokens_access_token',
        columnNames: ['access_token'],
        isUnique: true,
      })
    );

    // Add foreign keys to oauth_tokens
    await queryRunner.createForeignKey(
      'oauth_tokens',
      new TableForeignKey({
        name: 'FK_oauth_tokens_client_id',
        columnNames: ['client_id'],
        referencedTableName: 'oauth_clients',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'oauth_tokens',
      new TableForeignKey({
        name: 'FK_oauth_tokens_user_id',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop oauth_tokens table
    await queryRunner.dropTable('oauth_tokens', true, true, true);

    // Drop oauth_clients table
    await queryRunner.dropTable('oauth_clients', true, true, true);

    // Drop social_accounts table
    await queryRunner.dropTable('social_accounts', true, true, true);
  }
}
