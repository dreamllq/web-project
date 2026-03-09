import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddOAuthProviderMetadata1772865374418 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('oauth_provider_configs', [
      new TableColumn({
        name: 'display_name',
        type: 'varchar',
        length: '50',
        isNullable: true,
      }),
      new TableColumn({
        name: 'icon',
        type: 'varchar',
        length: '50',
        isNullable: true,
      }),
      new TableColumn({
        name: 'color',
        type: 'varchar',
        length: '20',
        isNullable: true,
      }),
      new TableColumn({
        name: 'provider_type',
        type: 'varchar',
        length: '20',
        isNullable: true,
      }),
      new TableColumn({
        name: 'sort_order',
        type: 'int',
        isNullable: true,
      }),
    ]);

    await queryRunner.query(
      `UPDATE oauth_provider_configs 
       SET display_name = '微信', 
           icon = 'ChatDotRound', 
           color = '#07C160',
           provider_type = 'oauth2',
           sort_order = 1
       WHERE code = 'wechat' AND display_name IS NULL`
    );

    await queryRunner.query(
      `UPDATE oauth_provider_configs 
       SET display_name = '微信小程序', 
           icon = 'ChatDotRound', 
           color = '#07C160',
           provider_type = 'miniprogram',
           sort_order = 2
       WHERE code = 'wechat_miniprogram' AND display_name IS NULL`
    );

    await queryRunner.query(
      `UPDATE oauth_provider_configs 
       SET display_name = '钉钉', 
           icon = 'Message', 
           color = '#0089FF',
           provider_type = 'oauth2',
           sort_order = 3
       WHERE code = 'dingtalk' AND display_name IS NULL`
    );

    await queryRunner.query(
      `UPDATE oauth_provider_configs 
       SET display_name = '钉钉小程序', 
           icon = 'Message', 
           color = '#0089FF',
           provider_type = 'miniprogram',
           sort_order = 4
       WHERE code = 'dingtalk_miniprogram' AND display_name IS NULL`
    );

    await queryRunner.query(
      `UPDATE oauth_provider_configs 
       SET display_name = '飞书', 
           icon = 'Connection', 
           color = '#00D6B9',
           provider_type = 'oauth2',
           sort_order = 5
       WHERE code = 'feishu' AND display_name IS NULL`
    );

    await queryRunner.query(
      `UPDATE oauth_provider_configs 
       SET display_name = '抖音', 
           icon = 'VideoCamera', 
           color = '#000000',
           provider_type = 'oauth2',
           sort_order = 6
       WHERE code = 'douyin' AND display_name IS NULL`
    );

    await queryRunner.query(
      `UPDATE oauth_provider_configs 
       SET display_name = 'QQ', 
           icon = 'ChatLineSquare', 
           color = '#12B7F5',
           provider_type = 'oauth2',
           sort_order = 7
       WHERE code = 'qq' AND display_name IS NULL`
    );

    await queryRunner.query(
      `UPDATE oauth_provider_configs 
       SET display_name = '百度', 
           icon = 'Search', 
           color = '#2932E1',
           provider_type = 'oauth2',
           sort_order = 8
       WHERE code = 'baidu' AND display_name IS NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('oauth_provider_configs', 'sort_order');
    await queryRunner.dropColumn('oauth_provider_configs', 'provider_type');
    await queryRunner.dropColumn('oauth_provider_configs', 'color');
    await queryRunner.dropColumn('oauth_provider_configs', 'icon');
    await queryRunner.dropColumn('oauth_provider_configs', 'display_name');
  }
}
