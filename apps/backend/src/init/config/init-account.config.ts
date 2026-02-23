import { Injectable } from '@nestjs/common';
import { InitAccount } from '../decorators/init-account.decorator';

/**
 * 初始化账号配置
 *
 * 使用 @InitAccount 装饰器声明系统初始化时需要自动创建的账号。
 * InitAccountSyncService 会在应用启动时扫描此配置并自动创建账号。
 *
 * 账号配置说明：
 * - username: 用户名（必填）
 * - password: 初始密码（必填）
 * - email: 邮箱（可选）
 * - phone: 手机号（可选）
 * - isSuperuser: 是否超级管理员（默认 false）
 * - roles: 要分配的角色列表（可选，角色需已存在）
 * - enabled: 是否启用（默认 true）
 */
@InitAccount({
  username: 'admin',
  password: 'Aa111111!',
  email: 'lvliqi_d@163.com',
  isSuperuser: true,
  enabled: true,
})
@Injectable()
export class InitAccountConfig {
  // 这个类仅用于承载 @InitAccount 装饰器
  // InitAccountSyncService 会扫描所有带有此装饰器的提供者
}
