import { describe, it, expect, beforeEach, afterEach, jest } from 'bun:test';
import {
  testDatabaseConnection,
  testRedisConnection,
  DatabaseTestConfig,
  RedisTestConfig,
} from './connection-tester';

// Mock modules
jest.mock('typeorm', () => ({
  DataSource: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    query: jest.fn(),
    destroy: jest.fn(),
    isInitialized: false,
  })),
}));

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    ping: jest.fn(),
    disconnect: jest.fn(),
  }));
});

jest.mock('@upstash/redis', () => ({
  Redis: jest.fn().mockImplementation(() => ({
    ping: jest.fn(),
  })),
}));

describe('connection-tester', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('testDatabaseConnection', () => {
    it('should return true on successful connection with URL config', async () => {
      const { DataSource } = await import('typeorm');
      const mockDataSource = {
        initialize: jest.fn().mockResolvedValue(undefined),
        query: jest.fn().mockResolvedValue([{ '1': 1 }]),
        destroy: jest.fn().mockResolvedValue(undefined),
        isInitialized: true,
      };
      (DataSource as jest.Mock).mockReturnValue(mockDataSource);

      const config: DatabaseTestConfig = {
        type: 'remote',
        url: 'postgresql://user:pass@localhost:5432/testdb',
      };

      const result = await testDatabaseConnection(config);
      expect(result).toBe(true);
      expect(mockDataSource.initialize).toHaveBeenCalled();
      expect(mockDataSource.query).toHaveBeenCalledWith('SELECT 1');
      expect(mockDataSource.destroy).toHaveBeenCalled();
    });

    it('should return true on successful connection with individual params', async () => {
      const { DataSource } = await import('typeorm');
      const mockDataSource = {
        initialize: jest.fn().mockResolvedValue(undefined),
        query: jest.fn().mockResolvedValue([{ '1': 1 }]),
        destroy: jest.fn().mockResolvedValue(undefined),
        isInitialized: true,
      };
      (DataSource as jest.Mock).mockReturnValue(mockDataSource);

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
    });

    it('should throw error on connection refused', async () => {
      const { DataSource } = await import('typeorm');
      const mockDataSource = {
        initialize: jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED')),
        query: jest.fn(),
        destroy: jest.fn().mockResolvedValue(undefined),
        isInitialized: false,
      };
      (DataSource as jest.Mock).mockReturnValue(mockDataSource);

      const config: DatabaseTestConfig = {
        type: 'local',
        host: 'localhost',
        port: 5432,
      };

      await expect(testDatabaseConnection(config)).rejects.toThrow('Connection refused');
    });

    it('should throw error on authentication failure', async () => {
      const { DataSource } = await import('typeorm');
      const mockDataSource = {
        initialize: jest.fn().mockRejectedValue(new Error('authentication failed for user')),
        query: jest.fn(),
        destroy: jest.fn().mockResolvedValue(undefined),
        isInitialized: false,
      };
      (DataSource as jest.Mock).mockReturnValue(mockDataSource);

      const config: DatabaseTestConfig = {
        type: 'local',
        username: 'wronguser',
        password: 'wrongpass',
      };

      await expect(testDatabaseConnection(config)).rejects.toThrow('Authentication failed');
    });

    it('should throw error on database not found', async () => {
      const { DataSource } = await import('typeorm');
      const mockDataSource = {
        initialize: jest.fn().mockRejectedValue(new Error('database "nonexistent" does not exist')),
        query: jest.fn(),
        destroy: jest.fn().mockResolvedValue(undefined),
        isInitialized: false,
      };
      (DataSource as jest.Mock).mockReturnValue(mockDataSource);

      const config: DatabaseTestConfig = {
        type: 'local',
        database: 'nonexistent',
      };

      await expect(testDatabaseConnection(config)).rejects.toThrow('does not exist');
    });

    it('should configure SSL when ssl option is true', async () => {
      const { DataSource } = await import('typeorm');
      const mockDataSource = {
        initialize: jest.fn().mockResolvedValue(undefined),
        query: jest.fn().mockResolvedValue([{ '1': 1 }]),
        destroy: jest.fn().mockResolvedValue(undefined),
        isInitialized: true,
      };
      (DataSource as jest.Mock).mockReturnValue(mockDataSource);

      const config: DatabaseTestConfig = {
        type: 'remote',
        url: 'postgresql://user:pass@remote:5432/testdb',
        ssl: true,
      };

      const result = await testDatabaseConnection(config);
      expect(result).toBe(true);
      expect(DataSource).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: { rejectUnauthorized: false },
        })
      );
    });

    it('should close connection even if query fails', async () => {
      const { DataSource } = await import('typeorm');
      const mockDataSource = {
        initialize: jest.fn().mockResolvedValue(undefined),
        query: jest.fn().mockRejectedValue(new Error('Query failed')),
        destroy: jest.fn().mockResolvedValue(undefined),
        isInitialized: true,
      };
      (DataSource as jest.Mock).mockReturnValue(mockDataSource);

      const config: DatabaseTestConfig = {
        type: 'local',
      };

      await expect(testDatabaseConnection(config)).rejects.toThrow();
      expect(mockDataSource.destroy).toHaveBeenCalled();
    });
  });

  describe('testRedisConnection', () => {
    describe('local Redis', () => {
      it('should return true on successful PING', async () => {
        const Redis = (await import('ioredis')).default;
        const mockRedis = {
          ping: jest.fn().mockResolvedValue('PONG'),
          disconnect: jest.fn(),
        };
        (Redis as jest.Mock).mockReturnValue(mockRedis);

        const config: RedisTestConfig = {
          type: 'local',
          host: 'localhost',
          port: 6379,
        };

        const result = await testRedisConnection(config);
        expect(result).toBe(true);
        expect(mockRedis.ping).toHaveBeenCalled();
        expect(mockRedis.disconnect).toHaveBeenCalled();
      });

      it('should use default values for host and port', async () => {
        const Redis = (await import('ioredis')).default;
        const mockRedis = {
          ping: jest.fn().mockResolvedValue('PONG'),
          disconnect: jest.fn(),
        };
        (Redis as jest.Mock).mockReturnValue(mockRedis);

        const config: RedisTestConfig = {
          type: 'local',
        };

        const result = await testRedisConnection(config);
        expect(result).toBe(true);
        expect(Redis).toHaveBeenCalledWith(
          expect.objectContaining({
            host: 'localhost',
            port: 6379,
          })
        );
      });

      it('should throw error on connection refused', async () => {
        const Redis = (await import('ioredis')).default;
        const mockRedis = {
          ping: jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED')),
          disconnect: jest.fn(),
        };
        (Redis as jest.Mock).mockReturnValue(mockRedis);

        const config: RedisTestConfig = {
          type: 'local',
          host: 'unreachable',
          port: 6379,
        };

        await expect(testRedisConnection(config)).rejects.toThrow('Connection refused');
      });

      it('should throw error on authentication required', async () => {
        const Redis = (await import('ioredis')).default;
        const mockRedis = {
          ping: jest.fn().mockRejectedValue(new Error('NOAUTH Authentication required')),
          disconnect: jest.fn(),
        };
        (Redis as jest.Mock).mockReturnValue(mockRedis);

        const config: RedisTestConfig = {
          type: 'local',
          host: 'localhost',
        };

        await expect(testRedisConnection(config)).rejects.toThrow('Authentication required');
      });

      it('should throw error on wrong password', async () => {
        const Redis = (await import('ioredis')).default;
        const mockRedis = {
          ping: jest.fn().mockRejectedValue(new Error('WRONGPASS invalid username-password pair')),
          disconnect: jest.fn(),
        };
        (Redis as jest.Mock).mockReturnValue(mockRedis);

        const config: RedisTestConfig = {
          type: 'local',
          password: 'wrongpassword',
        };

        await expect(testRedisConnection(config)).rejects.toThrow('Invalid password');
      });

      it('should disconnect even on error', async () => {
        const Redis = (await import('ioredis')).default;
        const mockRedis = {
          ping: jest.fn().mockRejectedValue(new Error('Some error')),
          disconnect: jest.fn(),
        };
        (Redis as jest.Mock).mockReturnValue(mockRedis);

        const config: RedisTestConfig = {
          type: 'local',
        };

        await expect(testRedisConnection(config)).rejects.toThrow();
        expect(mockRedis.disconnect).toHaveBeenCalled();
      });
    });

    describe('Upstash Redis', () => {
      it('should return true on successful PING', async () => {
        const { Redis } = await import('@upstash/redis');
        const mockRedis = {
          ping: jest.fn().mockResolvedValue('PONG'),
        };
        (Redis as jest.Mock).mockReturnValue(mockRedis);

        const config: RedisTestConfig = {
          type: 'upstash',
          upstashUrl: 'https://test.upstash.io',
          upstashToken: 'test-token',
        };

        const result = await testRedisConnection(config);
        expect(result).toBe(true);
        expect(Redis).toHaveBeenCalledWith({
          url: 'https://test.upstash.io',
          token: 'test-token',
        });
      });

      it('should throw error when upstashUrl is missing', async () => {
        const config: RedisTestConfig = {
          type: 'upstash',
          upstashToken: 'test-token',
        };

        await expect(testRedisConnection(config)).rejects.toThrow(
          'requires upstashUrl and upstashToken'
        );
      });

      it('should throw error when upstashToken is missing', async () => {
        const config: RedisTestConfig = {
          type: 'upstash',
          upstashUrl: 'https://test.upstash.io',
        };

        await expect(testRedisConnection(config)).rejects.toThrow(
          'requires upstashUrl and upstashToken'
        );
      });

      it('should throw error on unauthorized', async () => {
        const { Redis } = await import('@upstash/redis');
        const mockRedis = {
          ping: jest.fn().mockRejectedValue(new Error('Unauthorized 401')),
        };
        (Redis as jest.Mock).mockReturnValue(mockRedis);

        const config: RedisTestConfig = {
          type: 'upstash',
          upstashUrl: 'https://test.upstash.io',
          upstashToken: 'invalid-token',
        };

        await expect(testRedisConnection(config)).rejects.toThrow('Invalid credentials');
      });
    });
  });

  describe('timeout behavior', () => {
    it('should timeout database connection after 5 seconds', async () => {
      const { DataSource } = await import('typeorm');
      const mockDataSource = {
        initialize: jest
          .fn()
          .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 10000))),
        query: jest.fn(),
        destroy: jest.fn().mockResolvedValue(undefined),
        isInitialized: false,
      };
      (DataSource as jest.Mock).mockReturnValue(mockDataSource);

      const config: DatabaseTestConfig = {
        type: 'local',
      };

      await expect(testDatabaseConnection(config)).rejects.toThrow('timeout');
    }, 10000);

    it('should timeout Redis connection after 5 seconds', async () => {
      const Redis = (await import('ioredis')).default;
      const mockRedis = {
        ping: jest
          .fn()
          .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 10000))),
        disconnect: jest.fn(),
      };
      (Redis as jest.Mock).mockReturnValue(mockRedis);

      const config: RedisTestConfig = {
        type: 'local',
      };

      await expect(testRedisConnection(config)).rejects.toThrow('timeout');
    }, 10000);
  });
});
