import { Redis } from '@upstash/redis';
import { RedisOptions } from 'ioredis';

export interface UpstashConfig {
  url: string;
  token: string;
}

export const getUpstashRedis = (): Redis | null => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    return new Redis({ url, token });
  }
  return null;
};

// For ioredis compatibility (fallback for local development)
export const redisConfig = (): RedisOptions => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  retryStrategy: (times: number) => {
    if (times > 3) {
      console.error('Redis connection failed after 3 retries');
      return null;
    }
    return Math.min(times * 200, 2000);
  },
  maxRetriesPerRequest: 3,
});

export const getRedisUrl = (): string => {
  return process.env.REDIS_URL || 'redis://localhost:6379';
};

export default redisConfig;
