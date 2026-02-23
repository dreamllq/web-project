import { SetMetadata } from '@nestjs/common';

export const INIT_ACCOUNT_KEY = 'init_account';

export interface InitAccountMetadata {
  /** 用户名 */
  username: string;
  /** 初始密码 */
  password: string;
  /** 邮箱 */
  email?: string;
  /** 手机号 */
  phone?: string;
  /** 是否超级管理员 */
  isSuperuser?: boolean;
  /** 角色列表 */
  roles?: string[];
  /** 是否启用（默认启用） */
  enabled?: boolean;
  /** 描述 */
  description?: string;
}

/**
 * InitAccount 装饰器
 *
 * 用于声明系统初始化时需要自动创建的账号。
 * InitAccountSyncService 会在应用启动时扫描所有带有此装饰器的类，
 * 并自动创建不存在的账号。
 *
 * @param config - 账号配置
 *
 * @example
 * // 在模块或服务类上使用
 * @InitAccount({
 *   username: 'admin',
 *   password: 'Aa111111!',
 *   email: 'admin@example.com',
 *   isSuperuser: true,
 * })
 * @Module({})
 * export class AppModule {}
 *
 * @example
 * // 创建多个初始化账号
 * @InitAccounts([
 *   { username: 'admin', password: 'Admin123!', isSuperuser: true },
 *   { username: 'operator', password: 'Operator123!', roles: ['operator'] },
 * ])
 * @Module({})
 * export class AppModule {}
 */
export const InitAccount = (config: InitAccountMetadata) => SetMetadata(INIT_ACCOUNT_KEY, [config]);

/**
 * InitAccounts 装饰器
 *
 * 用于批量声明多个初始化账号。
 *
 * @param configs - 账号配置数组
 */
export const InitAccounts = (configs: InitAccountMetadata[]) =>
  SetMetadata(INIT_ACCOUNT_KEY, configs);
