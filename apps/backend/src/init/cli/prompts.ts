import inquirer from 'inquirer';
import {
  validatePassword,
  validateUsername,
  validateDatabaseUrl,
  validateRedisHost,
  validatePort,
} from './validation';

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
  type: 'local' | 'upstash';
  // For local:
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  // For Upstash:
  upstashUrl?: string;
  upstashToken?: string;
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

const LOCAL_REDIS_DEFAULTS = {
  host: 'localhost',
  port: 6379,
  password: '',
  db: 0,
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
 * Supports local Redis or Upstash
 */
export async function promptRedisConfig(): Promise<RedisConfig> {
  const { redisType } = await inquirer.prompt<{ redisType: 'local' | 'upstash' }>([
    {
      type: 'list',
      name: 'redisType',
      message: '请选择 Redis 配置方式:',
      choices: [
        { name: '本地 Redis', value: 'local' },
        { name: 'Upstash Redis (云服务)', value: 'upstash' },
      ],
      default: 'local',
    },
  ]);

  if (redisType === 'upstash') {
    const { upstashUrl, upstashToken } = await inquirer.prompt<{
      upstashUrl: string;
      upstashToken: string;
    }>([
      {
        type: 'input',
        name: 'upstashUrl',
        message: '请输入 Upstash Redis REST URL:',
        validate: (input: string) => {
          if (!input || input.trim().length === 0) {
            return 'Upstash URL 不能为空';
          }
          return true;
        },
      },
      {
        type: 'password',
        name: 'upstashToken',
        message: '请输入 Upstash Redis Token:',
        mask: '*',
        validate: (input: string) => {
          if (!input || input.trim().length === 0) {
            return 'Upstash Token 不能为空';
          }
          return true;
        },
      },
    ]);

    return {
      type: 'upstash',
      upstashUrl,
      upstashToken,
    };
  }

  // Prompt for local Redis configuration
  const answers = await inquirer.prompt<{
    host: string;
    port: string;
    password: string;
    db: string;
  }>([
    {
      type: 'input',
      name: 'host',
      message: 'Redis 主机地址:',
      default: LOCAL_REDIS_DEFAULTS.host,
      validate: (input: string) => {
        const result = validateRedisHost(input);
        return result.valid ? true : result.message;
      },
    },
    {
      type: 'input',
      name: 'port',
      message: 'Redis 端口:',
      default: LOCAL_REDIS_DEFAULTS.port.toString(),
      validate: (input: string) => {
        const result = validatePort(input);
        return result.valid ? true : result.message;
      },
    },
    {
      type: 'password',
      name: 'password',
      message: 'Redis 密码 (可选，直接回车跳过):',
      mask: '*',
    },
    {
      type: 'input',
      name: 'db',
      message: 'Redis 数据库编号:',
      default: LOCAL_REDIS_DEFAULTS.db.toString(),
      validate: (input: string) => {
        const dbNum = parseInt(input, 10);
        if (isNaN(dbNum) || dbNum < 0 || dbNum > 15) {
          return '数据库编号必须是 0-15 之间的数字';
        }
        return true;
      },
    },
  ]);

  return {
    type: 'local',
    host: answers.host,
    port: parseInt(answers.port, 10),
    password: answers.password || undefined,
    db: parseInt(answers.db, 10),
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
