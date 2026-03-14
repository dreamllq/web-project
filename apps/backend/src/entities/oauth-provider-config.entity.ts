import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum OAuthProviderCode {
  WECHAT = 'wechat',
  WECHAT_MINIPROGRAM = 'wechat_miniprogram',
  DINGTALK_MINIPROGRAM = 'dingtalk_miniprogram',
  DINGTALK = 'dingtalk',
  FEISHU = 'feishu',
  DOUYIN = 'douyin',
  QQ = 'qq',
  BAIDU = 'baidu',
}

@Entity('oauth_provider_configs')
@Index(['code'])
export class OAuthProviderConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: OAuthProviderCode,
  })
  code: OAuthProviderCode;

  @Column({ name: 'config_name', type: 'varchar', length: 100 })
  configName: string;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'app_id', type: 'varchar', length: 100 })
  appId: string;

  @Column({ name: 'app_secret', type: 'varchar', length: 255 })
  appSecret: string;

  @Column({ name: 'redirect_uri', type: 'varchar', length: 500, nullable: true })
  redirectUri: string | null;

  @Column({ name: 'frontend_redirect_url', type: 'varchar', length: 500, nullable: true })
  frontendRedirectUrl: string | null;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'jsonb', nullable: true })
  config: Record<string, unknown> | null;

  @Column({ name: 'display_name', type: 'varchar', length: 50, nullable: true })
  displayName: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  icon: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  color: string | null;

  @Column({ name: 'provider_type', type: 'varchar', length: 20, nullable: true })
  providerType: string | null;

  @Column({ name: 'sort_order', type: 'int', nullable: true })
  sortOrder: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
