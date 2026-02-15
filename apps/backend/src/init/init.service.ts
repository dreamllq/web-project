import { Injectable, Logger } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { PolicyService } from '../policy/policy.service';
import { UserStatus } from '../entities/user.entity';
import { PolicyEffect } from '../entities/policy.entity';
import { runInitPrompts } from './cli/prompts';
import { testDatabaseConnection, testRedisConnection } from './utils/connection-tester';
import { writeEnvFile } from './utils/env-writer';
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

/**
 * InitService handles application initialization tasks.
 * Orchestrates the entire initialization flow including:
 * - CLI prompts for configuration
 * - Database and Redis connection testing
 * - Environment file generation
 * - Admin user creation
 * - Super admin policy creation
 */
@Injectable()
export class InitService {
  private readonly logger = new Logger(InitService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly policyService: PolicyService
  ) {}

  /**
   * Run the complete initialization flow
   * This method orchestrates the entire initialization process
   */
  async runInitialization(): Promise<void> {
    this.logger.log('🚀 项目初始化向导');

    // Step 1: Run CLI prompts to collect configuration
    const config = await runInitPrompts();

    // Step 2: Test database connection
    this.logger.log('📦 配置数据库...');
    this.logger.log('🔗 测试数据库连接...');
    await testDatabaseConnection(config.database);
    this.logger.log('✅ 数据库连接成功');

    // Step 3: Test Redis connection
    this.logger.log('📦 配置 Redis...');
    this.logger.log('🔗 测试 Redis 连接...');
    await testRedisConnection(config.redis);
    this.logger.log('✅ Redis 连接成功');

    // Step 4: Write environment file
    this.logger.log('💾 保存配置文件...');
    writeEnvFile(config);
    this.logger.log('✅ 配置文件已保存');

    // Step 5: Create admin user
    this.logger.log('👤 创建超级管理员账号...');
    const passwordHash = await bcrypt.hash(config.admin.password, SALT_ROUNDS);
    const user = await this.usersService.create({
      username: config.admin.username,
      passwordHash,
    });

    // Step 6: Activate admin user (default status is PENDING)
    await this.usersService.updateStatus(user.id, UserStatus.ACTIVE);
    this.logger.log(`✅ 管理员账号已创建: ${config.admin.username}`);

    // Step 7: Create super admin policy
    this.logger.log('🔑 创建超级管理员权限...');
    await this.policyService.create({
      name: 'Super Admin Policy',
      description: 'Full access policy for super administrator',
      subject: `user:${user.id}`,
      resource: '*',
      action: '*',
      effect: PolicyEffect.ALLOW,
      priority: 1000,
      enabled: true,
    });
    this.logger.log('✅ 超级管理员权限已创建');

    // Step 8: Complete
    this.logger.log('');
    this.logger.log('═══════════════════════════════════════');
    this.logger.log('✅ 初始化完成！');
    this.logger.log('');
    this.logger.log('请重新启动服务以应用配置:');
    this.logger.log('  pnpm --filter backend start:dev');
    this.logger.log('═══════════════════════════════════════');

    // Exit the process
    process.exit(0);
  }
}
