import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { INIT_ACCOUNT_KEY, InitAccountMetadata } from '../decorators/init-account.decorator';
import { User, UserStatus } from '../../entities/user.entity';
import { Role } from '../../entities/role.entity';

const SALT_ROUNDS = 10;

/**
 * InitAccountSyncService
 *
 * 自动同步初始化账号的服务。
 *
 * 在应用启动时扫描所有带有 @InitAccount 或 @InitAccounts 装饰器的类，
 * 提取账号配置，并创建不存在的账号。
 *
 * 功能：
 * - 自动创建不存在的账号
 * - 支持设置密码、邮箱、手机号
 * - 支持设置超级管理员标识
 * - 支持自动分配角色（如果角色存在）
 * - 自动激活账号
 */
@Injectable()
export class InitAccountSyncService implements OnModuleInit {
  private readonly logger = new Logger(InitAccountSyncService.name);

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly reflector: Reflector,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>
  ) {}

  /**
   * 模块初始化时自动同步账号
   */
  async onModuleInit(): Promise<void> {
    await this.syncInitAccounts();
  }

  /**
   * 同步初始化账号
   *
   * 扫描所有提供者上的 @InitAccount 装饰器，创建不存在的账号。
   */
  async syncInitAccounts(): Promise<{ total: number; created: number; skipped: number }> {
    this.logger.log('Starting init account synchronization...');

    // 收集所有初始化账号配置
    const accountConfigs = this.collectAccountConfigs();

    if (accountConfigs.length === 0) {
      this.logger.log('No init accounts configured');
      return { total: 0, created: 0, skipped: 0 };
    }

    this.logger.log(`Found ${accountConfigs.length} init account(s) in decorators`);

    // 获取所有角色（用于角色分配）
    const allRoles = await this.roleRepository.find();
    const roleMap = new Map(allRoles.map((r) => [r.name, r]));

    let created = 0;
    let skipped = 0;

    for (const config of accountConfigs) {
      const result = await this.createAccountIfNeeded(config, roleMap);
      if (result) {
        created++;
      } else {
        skipped++;
      }
    }

    this.logger.log(`Init account sync complete. Created: ${created}, Skipped: ${skipped}`);

    return {
      total: accountConfigs.length,
      created,
      skipped,
    };
  }

  /**
   * 从装饰器收集账号配置
   */
  private collectAccountConfigs(): InitAccountMetadata[] {
    const configs: InitAccountMetadata[] = [];
    const seenUsernames = new Set<string>();

    // 扫描所有提供者
    const providers = this.discoveryService.getProviders();

    for (const wrapper of providers) {
      const { instance, metatype } = wrapper;
      if (!instance || !metatype) continue;

      const metadata = this.reflector.get<InitAccountMetadata[]>(INIT_ACCOUNT_KEY, metatype);

      if (metadata && Array.isArray(metadata)) {
        for (const config of metadata) {
          if (!seenUsernames.has(config.username)) {
            seenUsernames.add(config.username);
            configs.push(config);
          }
        }
      }
    }

    // 也扫描控制器
    const controllers = this.discoveryService.getControllers();

    for (const wrapper of controllers) {
      const { instance, metatype } = wrapper;
      if (!instance || !metatype) continue;

      const metadata = this.reflector.get<InitAccountMetadata[]>(INIT_ACCOUNT_KEY, metatype);

      if (metadata && Array.isArray(metadata)) {
        for (const config of metadata) {
          if (!seenUsernames.has(config.username)) {
            seenUsernames.add(config.username);
            configs.push(config);
          }
        }
      }
    }

    return configs;
  }

  /**
   * 如果账号不存在则创建
   */
  private async createAccountIfNeeded(
    config: InitAccountMetadata,
    roleMap: Map<string, Role>
  ): Promise<boolean> {
    // 检查用户是否已存在
    const existingUser = await this.userRepository.findOne({
      where: { username: config.username },
    });

    if (existingUser) {
      this.logger.log(`Account already exists: ${config.username}`);
      return false;
    }

    // 创建新用户
    const passwordHash = await bcrypt.hash(config.password, SALT_ROUNDS);

    // 收集要分配的角色
    const roles: Role[] = [];
    if (config.roles && config.roles.length > 0) {
      for (const roleName of config.roles) {
        const role = roleMap.get(roleName);
        if (role) {
          roles.push(role);
        } else {
          this.logger.warn(`Role not found: ${roleName}, skipping for user ${config.username}`);
        }
      }
    }

    const user = this.userRepository.create({
      username: config.username,
      passwordHash,
      email: config.email || null,
      phone: config.phone || null,
      isSuperuser: config.isSuperuser ?? false,
      status: config.enabled !== false ? UserStatus.ACTIVE : UserStatus.DISABLED,
      roles,
    });

    await this.userRepository.save(user);

    this.logger.log(
      `Created init account: ${config.username}${config.isSuperuser ? ' (superuser)' : ''}`
    );

    return true;
  }
}
