import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { Redis as UpstashRedis } from '@upstash/redis';

/**
 * Configuration for database connection testing
 */
export interface DatabaseTestConfig {
  type: 'local' | 'remote';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  url?: string;
  ssl?: boolean;
}

/**
 * Configuration for Redis connection testing
 */
export interface RedisTestConfig {
  type: 'local' | 'upstash';
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  upstashUrl?: string;
  upstashToken?: string;
}

const TIMEOUT_MS = 5000;

/**
 * Wraps a promise with a timeout
 */
async function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(errorMessage)), ms)),
  ]);
}

/**
 * Tests database connection using the provided configuration
 * @param config - Database connection configuration
 * @returns true if connection successful
 * @throws Error with descriptive message if connection fails
 */
export async function testDatabaseConnection(config: DatabaseTestConfig): Promise<boolean> {
  let dataSource: DataSource | null = null;

  try {
    // Build connection options
    const isUrlBased = !!config.url;

    const dataSourceOptions = {
      type: 'postgres' as const,
      ...(isUrlBased
        ? { url: config.url }
        : {
            host: config.host || 'localhost',
            port: config.port || 5432,
            username: config.username || 'postgres',
            password: config.password || '',
            database: config.database || 'postgres',
          }),
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
    };

    dataSource = new DataSource(dataSourceOptions);

    const connectAndQuery = async () => {
      await dataSource!.initialize();
      await dataSource!.query('SELECT 1');
    };

    await withTimeout(
      connectAndQuery(),
      TIMEOUT_MS,
      `Database connection timeout after ${TIMEOUT_MS / 1000} seconds`
    );

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Provide more specific error messages
    if (errorMessage.includes('timeout')) {
      throw new Error(
        `Database connection failed: Connection timed out after ${TIMEOUT_MS / 1000} seconds`
      );
    }
    if (errorMessage.includes('ECONNREFUSED')) {
      throw new Error(
        `Database connection failed: Connection refused. Is the database running at ${config.host || 'localhost'}:${config.port || 5432}?`
      );
    }
    if (errorMessage.includes('authentication')) {
      throw new Error(
        'Database connection failed: Authentication failed. Check your username and password.'
      );
    }
    if (errorMessage.includes('database') && errorMessage.includes('does not exist')) {
      throw new Error(`Database connection failed: Database "${config.database}" does not exist.`);
    }

    throw new Error(`Database connection failed: ${errorMessage}`);
  } finally {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  }
}

/**
 * Tests Redis connection using the provided configuration
 * @param config - Redis connection configuration
 * @returns true if connection successful
 * @throws Error with descriptive message if connection fails
 */
export async function testRedisConnection(config: RedisTestConfig): Promise<boolean> {
  if (config.type === 'upstash') {
    return testUpstashRedisConnection(config);
  }
  return testLocalRedisConnection(config);
}

/**
 * Tests local Redis connection using ioredis
 */
async function testLocalRedisConnection(config: RedisTestConfig): Promise<boolean> {
  let redis: Redis | null = null;

  try {
    redis = new Redis({
      host: config.host || 'localhost',
      port: config.port || 6379,
      password: config.password,
      db: config.db || 0,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null, // Don't retry on failure
      connectTimeout: TIMEOUT_MS,
    });

    const pingPromise = redis.ping();

    const result = await withTimeout(
      pingPromise,
      TIMEOUT_MS,
      `Redis connection timeout after ${TIMEOUT_MS / 1000} seconds`
    );

    if (result !== 'PONG') {
      throw new Error(`Unexpected response from Redis: ${result}`);
    }

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('timeout')) {
      throw new Error(
        `Redis connection failed: Connection timed out after ${TIMEOUT_MS / 1000} seconds`
      );
    }
    if (errorMessage.includes('ECONNREFUSED')) {
      throw new Error(
        `Redis connection failed: Connection refused. Is Redis running at ${config.host || 'localhost'}:${config.port || 6379}?`
      );
    }
    if (errorMessage.includes('NOAUTH')) {
      throw new Error('Redis connection failed: Authentication required. Check your password.');
    }
    if (errorMessage.includes('WRONGPASS')) {
      throw new Error('Redis connection failed: Invalid password.');
    }

    throw new Error(`Redis connection failed: ${errorMessage}`);
  } finally {
    if (redis) {
      redis.disconnect();
    }
  }
}

/**
 * Tests Upstash Redis connection using @upstash/redis
 */
async function testUpstashRedisConnection(config: RedisTestConfig): Promise<boolean> {
  try {
    if (!config.upstashUrl || !config.upstashToken) {
      throw new Error('Upstash Redis requires upstashUrl and upstashToken');
    }

    const redis = new UpstashRedis({
      url: config.upstashUrl,
      token: config.upstashToken,
    });

    const pingPromise = redis.ping();

    const result = await withTimeout(
      pingPromise,
      TIMEOUT_MS,
      `Upstash Redis connection timeout after ${TIMEOUT_MS / 1000} seconds`
    );

    if (result !== 'PONG') {
      throw new Error(`Unexpected response from Upstash Redis: ${result}`);
    }

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('timeout')) {
      throw new Error(
        `Upstash Redis connection failed: Connection timed out after ${TIMEOUT_MS / 1000} seconds`
      );
    }
    if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
      throw new Error(
        'Upstash Redis connection failed: Invalid credentials. Check your upstashUrl and upstashToken.'
      );
    }

    throw new Error(`Upstash Redis connection failed: ${errorMessage}`);
  }
}
