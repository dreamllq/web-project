import { describe, test, expect } from 'bun:test';
import { parseRedisUrl } from './redis.config';
import type { RedisOptions } from 'ioredis';

describe('parseRedisUrl', () => {
  describe('basic redis:// URLs', () => {
    test('should parse simple redis://localhost:6379', () => {
      const result = parseRedisUrl('redis://localhost:6379');
      expect(result.host).toBe('localhost');
      expect(result.port).toBe(6379);
      expect(result.password).toBeUndefined();
      expect(result.db).toBe(0);
      expect(result.tls).toBeUndefined();
    });

    test('should parse redis:// with custom host and port', () => {
      const result = parseRedisUrl('redis://redis.example.com:6380');
      expect(result.host).toBe('redis.example.com');
      expect(result.port).toBe(6380);
    });

    test('should use default port 6379 when not specified', () => {
      const result = parseRedisUrl('redis://localhost');
      expect(result.host).toBe('localhost');
      expect(result.port).toBe(6379);
    });
  });

  describe('authentication', () => {
    test('should parse redis://:password@localhost:6379 (password only)', () => {
      const result = parseRedisUrl('redis://:mypassword@localhost:6379');
      expect(result.host).toBe('localhost');
      expect(result.port).toBe(6379);
      expect(result.password).toBe('mypassword');
    });

    test('should parse redis://user:password@localhost:6379 (user and password)', () => {
      const result = parseRedisUrl('redis://default:secretpass@localhost:6379');
      expect(result.host).toBe('localhost');
      expect(result.port).toBe(6379);
      expect(result.password).toBe('secretpass');
      // Note: Redis URL username is typically ignored, password is used
    });

    test('should handle special characters in password', () => {
      const result = parseRedisUrl('redis://:p@ss%40word@localhost:6379');
      expect(result.password).toBe('p@ss@word');
    });
  });

  describe('database selection', () => {
    test('should parse redis://localhost:6379/2', () => {
      const result = parseRedisUrl('redis://localhost:6379/2');
      expect(result.host).toBe('localhost');
      expect(result.port).toBe(6379);
      expect(result.db).toBe(2);
    });

    test('should parse with password and database', () => {
      const result = parseRedisUrl('redis://:mypassword@localhost:6379/5');
      expect(result.host).toBe('localhost');
      expect(result.port).toBe(6379);
      expect(result.password).toBe('mypassword');
      expect(result.db).toBe(5);
    });

    test('should use default db 0 when not specified', () => {
      const result = parseRedisUrl('redis://localhost:6379');
      expect(result.db).toBe(0);
    });
  });

  describe('TLS support (rediss://)', () => {
    test('should parse rediss:// protocol and enable TLS', () => {
      const result = parseRedisUrl('rediss://localhost:6379');
      expect(result.host).toBe('localhost');
      expect(result.port).toBe(6379);
      expect(result.tls).toBeDefined();
    });

    test('should parse Upstash-style rediss URL', () => {
      const result = parseRedisUrl('rediss://default:TOKEN@us1-abc.upstash.io:6379');
      expect(result.host).toBe('us1-abc.upstash.io');
      expect(result.port).toBe(6379);
      expect(result.password).toBe('TOKEN');
      expect(result.tls).toBeDefined();
    });
  });

  describe('edge cases', () => {
    test('should handle empty URL by returning defaults', () => {
      const result = parseRedisUrl('');
      expect(result.host).toBe('localhost');
      expect(result.port).toBe(6379);
      expect(result.db).toBe(0);
    });

    test('should return defaults for invalid URL', () => {
      const result = parseRedisUrl('not-a-valid-url');
      expect(result.host).toBe('localhost');
      expect(result.port).toBe(6379);
      expect(result.db).toBe(0);
    });

    test('should preserve retry strategy options', () => {
      const url = 'redis://localhost:6379';
      const result = parseRedisUrl(url);
      // Should include retry strategy defaults
      expect(result.retryStrategy).toBeDefined();
      expect(result.maxRetriesPerRequest).toBe(3);
    });
  });

  describe('URL components extraction', () => {
    test('should correctly extract all components from complex URL', () => {
      const result = parseRedisUrl('rediss://admin:SuperSecret123@redis-prod.example.com:6380/3');
      expect(result.host).toBe('redis-prod.example.com');
      expect(result.port).toBe(6380);
      expect(result.password).toBe('SuperSecret123');
      expect(result.db).toBe(3);
      expect(result.tls).toBeDefined();
    });
  });
});
