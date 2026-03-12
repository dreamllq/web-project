import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class OAuthProviderConfigMultiConfig1773291900000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('oauth_provider_configs', 'IDX_oauth_provider_configs_code');

    await queryRunner.createIndex(
      'oauth_provider_configs',
      new TableIndex({
        name: 'IDX_oauth_provider_configs_code',
        columnNames: ['code'],
      })
    );

    await queryRunner.addColumn(
      'oauth_provider_configs',
      new TableColumn({
        name: 'config_name',
        type: 'varchar',
        length: '100',
        isNullable: false,
        default: "'default'",
      })
    );

    await queryRunner.addColumn(
      'oauth_provider_configs',
      new TableColumn({
        name: 'is_default',
        type: 'boolean',
        default: false,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('oauth_provider_configs', 'is_default');
    await queryRunner.dropColumn('oauth_provider_configs', 'config_name');
    await queryRunner.dropIndex('oauth_provider_configs', 'IDX_oauth_provider_configs_code');

    await queryRunner.createIndex(
      'oauth_provider_configs',
      new TableIndex({
        name: 'IDX_oauth_provider_configs_code',
        columnNames: ['code'],
        isUnique: true,
      })
    );
  }
}
