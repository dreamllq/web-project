import { RedisOptions } from 'ioredis';

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
