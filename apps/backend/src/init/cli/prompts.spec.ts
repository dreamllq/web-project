import { describe, test, expect, mock, beforeEach } from 'bun:test';

describe('prompts', () => {
  // Reset module cache between tests
  beforeEach(() => {
    const modulePath = require.resolve('./prompts');
    delete require.cache[modulePath];
  });

  describe('promptDatabaseConfig', () => {
    test('should return local database config with defaults when local is selected', async () => {
      const promptMock = mock((...args: unknown[]) => {
        return Promise.resolve({ dbType: 'local' });
      });

      mock.module('inquirer', () => ({
        default: {
          prompt: promptMock,
        },
      }));

      const { promptDatabaseConfig } = await import('./prompts');

      const result = await promptDatabaseConfig();

      expect(result).toEqual({
        type: 'local',
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: 'postgres123',
        database: 'app',
      });
    });

    test('should prompt for database URL when remote is selected', async () => {
      const responses = [{ dbType: 'remote' }, { dbUrl: 'postgresql://user:pass@host:5432/db' }];
      let callIndex = 0;
      const promptMock = mock((...args: unknown[]) => {
        return Promise.resolve(responses[callIndex++]);
      });

      mock.module('inquirer', () => ({
        default: {
          prompt: promptMock,
        },
      }));

      const { promptDatabaseConfig } = await import('./prompts');

      const result = await promptDatabaseConfig();

      expect(result).toEqual({
        type: 'remote',
        url: 'postgresql://user:pass@host:5432/db',
      });
    });

    test('should call inquirer.prompt with correct database type choices', async () => {
      const promptMock = mock((...args: unknown[]) => {
        return Promise.resolve({ dbType: 'local' });
      });

      mock.module('inquirer', () => ({
        default: {
          prompt: promptMock,
        },
      }));

      const { promptDatabaseConfig } = await import('./prompts');

      await promptDatabaseConfig();

      const calls = promptMock.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const firstCall = calls[0][0];
      const question = Array.isArray(firstCall) ? firstCall[0] : firstCall;
      expect(question.name).toBe('dbType');
      expect(question.choices).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ value: 'local' }),
          expect.objectContaining({ value: 'remote' }),
        ])
      );
    });
  });

  describe('promptRedisConfig', () => {
    test('should return local Redis config with defaults when local is selected', async () => {
      const responses = [
        { redisType: 'local' },
        {
          host: 'localhost',
          port: '6379',
          password: '',
          db: '0',
        },
      ];
      let callIndex = 0;
      const promptMock = mock((...args: unknown[]) => {
        return Promise.resolve(responses[callIndex++]);
      });

      mock.module('inquirer', () => ({
        default: {
          prompt: promptMock,
        },
      }));

      const { promptRedisConfig } = await import('./prompts');

      const result = await promptRedisConfig();

      expect(result).toEqual({
        type: 'local',
        host: 'localhost',
        port: 6379,
        password: undefined,
        db: 0,
      });
    });

    test('should return Upstash config when upstash is selected', async () => {
      const responses = [
        { redisType: 'upstash' },
        {
          upstashUrl: 'https://example.upstash.io',
          upstashToken: 'test-token',
        },
      ];
      let callIndex = 0;
      const promptMock = mock((...args: unknown[]) => {
        return Promise.resolve(responses[callIndex++]);
      });

      mock.module('inquirer', () => ({
        default: {
          prompt: promptMock,
        },
      }));

      const { promptRedisConfig } = await import('./prompts');

      const result = await promptRedisConfig();

      expect(result).toEqual({
        type: 'upstash',
        upstashUrl: 'https://example.upstash.io',
        upstashToken: 'test-token',
      });
    });

    test('should include password in local config when provided', async () => {
      const responses = [
        { redisType: 'local' },
        {
          host: 'localhost',
          port: '6379',
          password: 'redis-password',
          db: '1',
        },
      ];
      let callIndex = 0;
      const promptMock = mock((...args: unknown[]) => {
        return Promise.resolve(responses[callIndex++]);
      });

      mock.module('inquirer', () => ({
        default: {
          prompt: promptMock,
        },
      }));

      const { promptRedisConfig } = await import('./prompts');

      const result = await promptRedisConfig();

      expect(result).toEqual({
        type: 'local',
        host: 'localhost',
        port: 6379,
        password: 'redis-password',
        db: 1,
      });
    });
  });

  describe('promptAdminConfig', () => {
    test('should return admin config with provided values', async () => {
      const promptMock = mock((...args: unknown[]) => {
        return Promise.resolve({
          username: 'testadmin',
          password: 'TestPass123',
          confirmPassword: 'TestPass123',
        });
      });

      mock.module('inquirer', () => ({
        default: {
          prompt: promptMock,
        },
      }));

      const { promptAdminConfig } = await import('./prompts');

      const result = await promptAdminConfig();

      expect(result).toEqual({
        username: 'testadmin',
        password: 'TestPass123',
      });
    });

    test('should have username default to admin', async () => {
      const promptMock = mock((...args: unknown[]) => {
        return Promise.resolve({
          username: 'admin',
          password: 'AdminPass123',
          confirmPassword: 'AdminPass123',
        });
      });

      mock.module('inquirer', () => ({
        default: {
          prompt: promptMock,
        },
      }));

      const { promptAdminConfig } = await import('./prompts');

      await promptAdminConfig();

      const calls = promptMock.mock.calls;
      const firstCall = calls[0][0];
      const questions = Array.isArray(firstCall) ? firstCall : [firstCall];
      const usernameQuestion = questions.find((q: { name: string }) => q.name === 'username');
      expect(usernameQuestion.default).toBe('admin');
    });

    test('should use password mask for password inputs', async () => {
      const promptMock = mock((...args: unknown[]) => {
        return Promise.resolve({
          username: 'admin',
          password: 'AdminPass123',
          confirmPassword: 'AdminPass123',
        });
      });

      mock.module('inquirer', () => ({
        default: {
          prompt: promptMock,
        },
      }));

      const { promptAdminConfig } = await import('./prompts');

      await promptAdminConfig();

      const calls = promptMock.mock.calls;
      const firstCall = calls[0][0];
      const questions = Array.isArray(firstCall) ? firstCall : [firstCall];

      const passwordQuestion = questions.find((q: { name: string }) => q.name === 'password');
      expect(passwordQuestion.type).toBe('password');
      expect(passwordQuestion.mask).toBe('*');

      const confirmQuestion = questions.find((q: { name: string }) => q.name === 'confirmPassword');
      expect(confirmQuestion.type).toBe('password');
      expect(confirmQuestion.mask).toBe('*');
    });
  });

  describe('runInitPrompts', () => {
    test('should run all prompts and return combined config', async () => {
      const responses = [
        { dbType: 'local' },
        { redisType: 'local' },
        {
          host: 'localhost',
          port: '6379',
          password: '',
          db: '0',
        },
        {
          username: 'admin',
          password: 'AdminPass123',
          confirmPassword: 'AdminPass123',
        },
      ];
      let callIndex = 0;
      const promptMock = mock((...args: unknown[]) => {
        return Promise.resolve(responses[callIndex++]);
      });

      mock.module('inquirer', () => ({
        default: {
          prompt: promptMock,
        },
      }));

      const { runInitPrompts } = await import('./prompts');

      const result = await runInitPrompts();

      expect(result).toEqual({
        database: {
          type: 'local',
          host: 'localhost',
          port: 5432,
          username: 'postgres',
          password: 'postgres123',
          database: 'app',
        },
        redis: {
          type: 'local',
          host: 'localhost',
          port: 6379,
          password: undefined,
          db: 0,
        },
        admin: {
          username: 'admin',
          password: 'AdminPass123',
        },
      });
    });

    test('should call console.log with welcome message', async () => {
      const responses = [
        { dbType: 'local' },
        { redisType: 'local' },
        {
          host: 'localhost',
          port: '6379',
          password: '',
          db: '0',
        },
        {
          username: 'admin',
          password: 'AdminPass123',
          confirmPassword: 'AdminPass123',
        },
      ];
      let callIndex = 0;
      const promptMock = mock((...args: unknown[]) => {
        return Promise.resolve(responses[callIndex++]);
      });

      mock.module('inquirer', () => ({
        default: {
          prompt: promptMock,
        },
      }));

      const { runInitPrompts } = await import('./prompts');

      // Capture console.log calls
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: unknown[]) => {
        logs.push(args.join(' '));
      };

      try {
        await runInitPrompts();

        expect(logs.some((log) => log.includes('🚀 项目初始化向导'))).toBe(true);
      } finally {
        console.log = originalLog;
      }
    });
  });
});
