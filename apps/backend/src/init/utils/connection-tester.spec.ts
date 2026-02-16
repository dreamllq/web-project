import { describe, test, expect, mock, beforeEach } from 'bun:test';
import type { DatabaseTestConfig, RedisTestConfig } from './connection-tester';

describe('connection-tester', () => {
  // Reset module cache between tests
  beforeEach(async () => {
    // Clear the module cache for connection-tester
    const modulePath = require.resolve('./connection-tester');
    delete require.cache[modulePath];
  });

  describe('testDatabaseConnection', () => {
    test('should return true on successful connection with local config', async () => {
      const mockDataSource = {
        initialize: mock(async () => {}),
        query: mock(async () => [{ '1': 1 }]),
        destroy: mock(async () => {}),
        isInitialized: true,
      };

      mock.module('typeorm', () => ({
        DataSource: mock(() => mockDataSource),
      }));

      const { testDatabaseConnection } = await import('./connection-tester');

      const config: DatabaseTestConfig = {
        type: 'local',
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: 'password',
        database: 'testdb',
      };

      const result = await testDatabaseConnection(config);
      expect(result).toBe(true);
      expect(mockDataSource.initialize).toHaveBeenCalled();
      expect(mockDataSource.query).toHaveBeenCalledWith('SELECT 1');
    });

    test('should return true on successful connection with remote URL config', async () => {
      const mockDataSource = {
        initialize: mock(async () => {}),
        query: mock(async () => [{ '1': 1 }]),
        destroy: mock(async () => {}),
        isInitialized: true,
      };

      mock.module('typeorm', () => ({
        DataSource: mock(() => mockDataSource),
      }));

      const { testDatabaseConnection } = await import('./connection-tester');

      const config: DatabaseTestConfig = {
        type: 'remote',
        url: 'postgresql://user:pass@remotehost:5432/testdb',
      };

      const result = await testDatabaseConnection(config);
      expect(result).toBe(true);
      expect(mockDataSource.destroy).toHaveBeenCalled();
    });

    test('should configure SSL when ssl option is true', async () => {
      let capturedOptions: any = null;
      const mockDataSource = {
        initialize: mock(async () => {}),
        query: mock(async () => [{ '1': 1 }]),
        destroy: mock(async () => {}),
        isInitialized: true,
      };

      mock.module('typeorm', () => ({
        DataSource: mock((options: any) => {
          capturedOptions = options;
          return mockDataSource;
        }),
      }));

      const { testDatabaseConnection } = await import('./connection-tester');

      const config: DatabaseTestConfig = {
        type: 'remote',
        url: 'postgresql://user:pass@remote:5432/testdb',
        ssl: true,
      };

      const result = await testDatabaseConnection(config);
      expect(result).toBe(true);
      expect(capturedOptions.ssl).toEqual({ rejectUnauthorized: false });
    });

    test('should throw error on connection refused', async () => {
      const mockDataSource = {
        initialize: mock(async () => {
          throw new Error('connect ECONNREFUSED 127.0.0.1:5432');
        }),
        query: mock(async () => {}),
        destroy: mock(async () => {}),
        isInitialized: false,
      };

      mock.module('typeorm', () => ({
        DataSource: mock(() => mockDataSource),
      }));

      const { testDatabaseConnection } = await import('./connection-tester');

      const config: DatabaseTestConfig = {
        type: 'local',
        host: 'localhost',
        port: 5432,
      };

      try {
        await testDatabaseConnection(config);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect((error as Error).message).toContain('Connection refused');
      }
    });

    test('should throw error on authentication failure', async () => {
      const mockDataSource = {
        initialize: mock(async () => {
          throw new Error('authentication failed for user "postgres"');
        }),
        query: mock(async () => {}),
        destroy: mock(async () => {}),
        isInitialized: false,
      };

      mock.module('typeorm', () => ({
        DataSource: mock(() => mockDataSource),
      }));

      const { testDatabaseConnection } = await import('./connection-tester');

      const config: DatabaseTestConfig = {
        type: 'local',
        username: 'wronguser',
        password: 'wrongpass',
      };

      try {
        await testDatabaseConnection(config);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect((error as Error).message).toContain('Authentication failed');
      }
    });

    test('should throw error on database not found', async () => {
      const mockDataSource = {
        initialize: mock(async () => {
          throw new Error('database "nonexistent" does not exist');
        }),
        query: mock(async () => {}),
        destroy: mock(async () => {}),
        isInitialized: false,
      };

      mock.module('typeorm', () => ({
        DataSource: mock(() => mockDataSource),
      }));

      const { testDatabaseConnection } = await import('./connection-tester');

      const config: DatabaseTestConfig = {
        type: 'local',
        database: 'nonexistent',
      };

      try {
        await testDatabaseConnection(config);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect((error as Error).message).toContain('does not exist');
      }
    });

    test('should close connection even if query fails', async () => {
      const mockDataSource = {
        initialize: mock(async () => {}),
        query: mock(async () => {
          throw new Error('Query failed');
        }),
        destroy: mock(async () => {}),
        isInitialized: true,
      };

      mock.module('typeorm', () => ({
        DataSource: mock(() => mockDataSource),
      }));

      const { testDatabaseConnection } = await import('./connection-tester');

      const config: DatabaseTestConfig = {
        type: 'local',
      };

      try {
        await testDatabaseConnection(config);
      } catch (error) {
        // Expected to throw
      }

      // Give time for finally block to execute
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockDataSource.destroy).toHaveBeenCalled();
    });

    test('should timeout after 5 seconds', async () => {
      const mockDataSource = {
        initialize: mock(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10000));
        }),
        query: mock(async () => {}),
        destroy: mock(async () => {}),
        isInitialized: false,
      };

      mock.module('typeorm', () => ({
        DataSource: mock(() => mockDataSource),
      }));

      const { testDatabaseConnection } = await import('./connection-tester');

      const config: DatabaseTestConfig = {
        type: 'local',
      };

      const start = Date.now();
      try {
        await testDatabaseConnection(config);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        const elapsed = Date.now() - start;
        expect(elapsed).toBeLessThan(7000); // Should timeout within ~5s + buffer
        expect((error as Error).message).toContain('timed out');
      }
    }, 10000);
  });

  describe('testRedisConnection', () => {
    test('should return true on successful PING', async () => {
      const mockRedis = {
        ping: mock(async () => 'PONG'),
        disconnect: mock(() => {}),
      };

      mock.module('ioredis', () => ({
        default: mock(() => mockRedis),
      }));

      // Mock parseRedisUrl to return default options
      mock.module('../../config/redis.config', () => ({
        parseRedisUrl: mock(() => ({
          host: 'localhost',
          port: 6379,
          db: 0,
        })),
      }));

      const { testRedisConnection } = await import('./connection-tester');

      const config: RedisTestConfig = {
        url: 'redis://localhost:6379',
      };

      const result = await testRedisConnection(config);
      expect(result).toBe(true);
      expect(mockRedis.ping).toHaveBeenCalled();
      expect(mockRedis.disconnect).toHaveBeenCalled();
    });

    test('should parse URL and extract connection options', async () => {
      let capturedOptions: any = null;
      const mockRedis = {
        ping: mock(async () => 'PONG'),
        disconnect: mock(() => {}),
      };

      mock.module('ioredis', () => ({
        default: mock((options: any) => {
          capturedOptions = options;
          return mockRedis;
        }),
      }));

      mock.module('../../config/redis.config', () => ({
        parseRedisUrl: mock((url: string) => {
          if (url === 'redis://:password@customhost:6380/2') {
            return {
              host: 'customhost',
              port: 6380,
              password: 'password',
              db: 2,
            };
          }
          return { host: 'localhost', port: 6379, db: 0 };
        }),
      }));

      const { testRedisConnection } = await import('./connection-tester');

      const config: RedisTestConfig = {
        url: 'redis://:password@customhost:6380/2',
      };

      const result = await testRedisConnection(config);
      expect(result).toBe(true);
      expect(capturedOptions.host).toBe('customhost');
      expect(capturedOptions.port).toBe(6380);
      expect(capturedOptions.password).toBe('password');
      expect(capturedOptions.db).toBe(2);
    });

    test('should support rediss:// protocol for TLS', async () => {
      let capturedOptions: any = null;
      const mockRedis = {
        ping: mock(async () => 'PONG'),
        disconnect: mock(() => {}),
      };

      mock.module('ioredis', () => ({
        default: mock((options: any) => {
          capturedOptions = options;
          return mockRedis;
        }),
      }));

      mock.module('../../config/redis.config', () => ({
        parseRedisUrl: mock((url: string) => {
          if (url.startsWith('rediss://')) {
            return {
              host: 'region.upstash.io',
              port: 6379,
              password: 'token',
              tls: {},
            };
          }
          return { host: 'localhost', port: 6379, db: 0 };
        }),
      }));

      const { testRedisConnection } = await import('./connection-tester');

      const config: RedisTestConfig = {
        url: 'rediss://default:token@region.upstash.io:6379',
      };

      const result = await testRedisConnection(config);
      expect(result).toBe(true);
      expect(capturedOptions.tls).toEqual({});
    });

    test('should throw error on connection refused', async () => {
      const mockRedis = {
        ping: mock(async () => {
          throw new Error('connect ECONNREFUSED 127.0.0.1:6379');
        }),
        disconnect: mock(() => {}),
      };

      mock.module('ioredis', () => ({
        default: mock(() => mockRedis),
      }));

      mock.module('../../config/redis.config', () => ({
        parseRedisUrl: mock(() => ({ host: 'localhost', port: 6379, db: 0 })),
      }));

      const { testRedisConnection } = await import('./connection-tester');

      const config: RedisTestConfig = {
        url: 'redis://unreachable:6379',
      };

      try {
        await testRedisConnection(config);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect((error as Error).message).toContain('Connection refused');
      }
    });

    test('should throw error on authentication required (NOAUTH)', async () => {
      const mockRedis = {
        ping: mock(async () => {
          throw new Error('NOAUTH Authentication required');
        }),
        disconnect: mock(() => {}),
      };

      mock.module('ioredis', () => ({
        default: mock(() => mockRedis),
      }));

      mock.module('../../config/redis.config', () => ({
        parseRedisUrl: mock(() => ({ host: 'localhost', port: 6379, db: 0 })),
      }));

      const { testRedisConnection } = await import('./connection-tester');

      const config: RedisTestConfig = {
        url: 'redis://localhost:6379',
      };

      try {
        await testRedisConnection(config);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect((error as Error).message).toContain('Authentication required');
      }
    });

    test('should throw error on wrong password (WRONGPASS)', async () => {
      const mockRedis = {
        ping: mock(async () => {
          throw new Error('WRONGPASS invalid username-password pair');
        }),
        disconnect: mock(() => {}),
      };

      mock.module('ioredis', () => ({
        default: mock(() => mockRedis),
      }));

      mock.module('../../config/redis.config', () => ({
        parseRedisUrl: mock(() => ({ host: 'localhost', port: 6379, db: 0 })),
      }));

      const { testRedisConnection } = await import('./connection-tester');

      const config: RedisTestConfig = {
        url: 'redis://:wrongpassword@localhost:6379',
      };

      try {
        await testRedisConnection(config);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect((error as Error).message).toContain('Invalid password');
      }
    });

    test('should disconnect even on error', async () => {
      const mockRedis = {
        ping: mock(async () => {
          throw new Error('Some unexpected error');
        }),
        disconnect: mock(() => {}),
      };

      mock.module('ioredis', () => ({
        default: mock(() => mockRedis),
      }));

      mock.module('../../config/redis.config', () => ({
        parseRedisUrl: mock(() => ({ host: 'localhost', port: 6379, db: 0 })),
      }));

      const { testRedisConnection } = await import('./connection-tester');

      const config: RedisTestConfig = {
        url: 'redis://localhost:6379',
      };

      try {
        await testRedisConnection(config);
      } catch (error) {
        // Expected to throw
      }

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockRedis.disconnect).toHaveBeenCalled();
    });

    test('should timeout after 5 seconds', async () => {
      const mockRedis = {
        ping: mock(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10000));
        }),
        disconnect: mock(() => {}),
      };

      mock.module('ioredis', () => ({
        default: mock(() => mockRedis),
      }));

      mock.module('../../config/redis.config', () => ({
        parseRedisUrl: mock(() => ({ host: 'localhost', port: 6379, db: 0 })),
      }));

      const { testRedisConnection } = await import('./connection-tester');

      const config: RedisTestConfig = {
        url: 'redis://localhost:6379',
      };

      const start = Date.now();
      try {
        await testRedisConnection(config);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        const elapsed = Date.now() - start;
        expect(elapsed).toBeLessThan(7000); // Should timeout within ~5s + buffer
        expect((error as Error).message).toContain('timed out');
      }
    }, 10000);
  });
});
