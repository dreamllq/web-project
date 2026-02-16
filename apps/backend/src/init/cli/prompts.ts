import inquirer from 'inquirer';
import { validatePassword, validateUsername, validateDatabaseUrl } from './validation';

// Configuration interfaces
export interface DatabaseConfig {
  type: 'local' | 'remote';
  // For local Docker:
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  // For remote:
  url?: string;
}

export interface RedisConfig {
  url: string;
}

export interface AdminConfig {
  username: string;
  password: string;
}

// Default values for local Docker setup
const LOCAL_DB_DEFAULTS = {
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'postgres123',
  database: 'app',
};

/**
 * Prompt for database configuration
 * Offers choice between local Docker PostgreSQL and remote database
 */
export async function promptDatabaseConfig(): Promise<DatabaseConfig> {
  const { dbType } = await inquirer.prompt<{ dbType: 'local' | 'remote' }>([
    {
      type: 'list',
      name: 'dbType',
      message: '请选择数据库配置方式:',
      choices: [
        { name: '本地 Docker PostgreSQL', value: 'local' },
        { name: '远程数据库 (Neon/Supabase/etc)', value: 'remote' },
      ],
      default: 'local',
    },
  ]);

  if (dbType === 'local') {
    // Use default local Docker configuration
    return {
      type: 'local',
      ...LOCAL_DB_DEFAULTS,
    };
  }

  // Prompt for remote database URL
  const { dbUrl } = await inquirer.prompt<{ dbUrl: string }>([
    {
      type: 'input',
      name: 'dbUrl',
      message: '请输入数据库连接 URL (postgresql://...):',
      validate: (input: string) => {
        const result = validateDatabaseUrl(input);
        return result.valid ? true : result.message;
      },
    },
  ]);

  return {
    type: 'remote',
    url: dbUrl,
  };
}

/**
 * Prompt for Redis configuration
 * Accepts a REDIS_URL connection string
 */
export async function promptRedisConfig(): Promise<RedisConfig> {
  const { redisUrl } = await inquirer.prompt<{ redisUrl: string }>([
    {
      type: 'input',
      name: 'redisUrl',
      message: '请输入 Redis 连接 URL (redis://host:port 或 rediss://...):',
      default: 'redis://localhost:6379',
      validate: (input: string) => {
        if (!input || input.trim().length === 0) {
          return 'Redis URL 不能为空';
        }
        if (!input.startsWith('redis://') && !input.startsWith('rediss://')) {
          return 'Redis URL 必须以 redis:// 或 rediss:// 开头';
        }
        return true;
      },
    },
  ]);

  return {
    url: redisUrl,
  };
}

/**
 * Prompt for admin account configuration
 */
export async function promptAdminConfig(): Promise<AdminConfig> {
  const answers = await inquirer.prompt<{
    username: string;
    password: string;
    confirmPassword: string;
  }>([
    {
      type: 'input',
      name: 'username',
      message: '管理员用户名:',
      default: 'admin',
      validate: (input: string) => {
        const result = validateUsername(input);
        return result.valid ? true : result.message;
      },
    },
    {
      type: 'password',
      name: 'password',
      message: '管理员密码 (至少8位，包含大小写字母和数字):',
      mask: '*',
      validate: (input: string) => {
        const result = validatePassword(input);
        return result.valid ? true : result.message;
      },
    },
    {
      type: 'password',
      name: 'confirmPassword',
      message: '确认管理员密码:',
      mask: '*',
      validate: (input: string, answers: { username: string; password: string }) => {
        if (input !== answers.password) {
          return '两次输入的密码不一致';
        }
        return true;
      },
    },
  ]);

  return {
    username: answers.username,
    password: answers.password,
  };
}

/**
 * Run all initialization prompts and return combined configuration
 */
export async function runInitPrompts(): Promise<{
  database: DatabaseConfig;
  redis: RedisConfig;
  admin: AdminConfig;
}> {
  console.log('\n🚀 项目初始化向导\n');

  const database = await promptDatabaseConfig();
  const redis = await promptRedisConfig();
  const admin = await promptAdminConfig();

  return {
    database,
    redis,
    admin,
  };
}
