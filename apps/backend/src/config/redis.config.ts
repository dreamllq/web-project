import { RedisOptions } from 'ioredis';

/**
 * Parses a Redis URL into RedisOptions compatible with ioredis
 *
 * Supported formats:
 * - redis://localhost:6379
 * - redis://:password@localhost:6379
 * - redis://user:password@localhost:6379/0
 * - rediss://default:TOKEN@REGION.upstash.io:6379 (TLS)
 */
export const parseRedisUrl = (url: string): RedisOptions => {
  // Default values
  const defaults: RedisOptions = {
    host: 'localhost',
    port: 6379,
    db: 0,
    retryStrategy: (times: number) => {
      if (times > 3) {
        console.error('Redis connection failed after 3 retries');
        return null;
      }
      return Math.min(times * 200, 2000);
    },
    maxRetriesPerRequest: 3,
  };

  if (!url) {
    return defaults;
  }

  try {
    const parsed = new URL(url);

    const options: RedisOptions = {
      ...defaults,
      host: parsed.hostname || defaults.host,
      port: parsed.port ? parseInt(parsed.port, 10) : defaults.port!,
    };

    // Extract password (URL password component)
    // Format: redis://user:password@host or redis://:password@host
    if (parsed.password) {
      options.password = decodeURIComponent(parsed.password);
    }

    // Extract database number from path (e.g., /0, /1)
    const pathname = parsed.pathname;
    if (pathname && pathname.length > 1) {
      const dbString = pathname.substring(1); // Remove leading /
      const db = parseInt(dbString, 10);
      if (!isNaN(db) && db >= 0) {
        options.db = db;
      }
    }

    // Enable TLS for rediss:// protocol
    if (parsed.protocol === 'rediss:') {
      options.tls = {};
    }

    return options;
  } catch {
    // Return defaults if URL parsing fails
    return defaults;
  }
};

// For ioredis compatibility
export const redisConfig = (): RedisOptions => {
  return parseRedisUrl(getRedisUrl());
};

export const getRedisUrl = (): string => {
  return process.env.REDIS_URL || 'redis://localhost:6379';
};

export default redisConfig;
