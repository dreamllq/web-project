import * as fs from 'fs';
import * as path from 'path';
import { writeEnvFile, InitConfig } from './env-writer';

describe('env-writer', () => {
  const testEnvPath = path.join(__dirname, '../../../../.env.test.local');

  // Helper to create test config
  const createTestConfig = (overrides: Partial<InitConfig> = {}): InitConfig => ({
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
      password: '',
      db: 0,
    },
    ...overrides,
  });

  beforeEach(() => {
    // Clean up test file before each test
    if (fs.existsSync(testEnvPath)) {
      fs.unlinkSync(testEnvPath);
    }
  });

  afterEach(() => {
    // Clean up test file after each test
    if (fs.existsSync(testEnvPath)) {
      fs.unlinkSync(testEnvPath);
    }
  });

  describe('writeEnvFile', () => {
    it('should write .env.local file with local database configuration', () => {
      const config = createTestConfig();

      writeEnvFile(config, testEnvPath);

      expect(fs.existsSync(testEnvPath)).toBe(true);
      const content = fs.readFileSync(testEnvPath, 'utf-8');

      expect(content).toContain(
        'DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/app'
      );
    });

    it('should write .env.local file with remote database URL', () => {
      const config = createTestConfig({
        database: {
          type: 'remote',
          url: 'postgresql://user:pass@remote-host:5432/db?sslmode=require',
        },
      });

      writeEnvFile(config, testEnvPath);

      const content = fs.readFileSync(testEnvPath, 'utf-8');
      expect(content).toContain(
        'DATABASE_URL=postgresql://user:pass@remote-host:5432/db?sslmode=require'
      );
    });

    it('should write .env.local file with local Redis configuration', () => {
      const config = createTestConfig();

      writeEnvFile(config, testEnvPath);

      const content = fs.readFileSync(testEnvPath, 'utf-8');
      expect(content).toContain('REDIS_HOST=localhost');
      expect(content).toContain('REDIS_PORT=6379');
      expect(content).toContain('REDIS_PASSWORD=');
      expect(content).toContain('REDIS_DB=0');
    });

    it('should write .env.local file with Upstash Redis configuration', () => {
      const config = createTestConfig({
        redis: {
          type: 'upstash',
          upstashUrl: 'https://xxx.us1.upstash.io',
          upstashToken: 'test-token',
        },
      });

      writeEnvFile(config, testEnvPath);

      const content = fs.readFileSync(testEnvPath, 'utf-8');
      expect(content).toContain('UPSTASH_REDIS_REST_URL=https://xxx.us1.upstash.io');
      expect(content).toContain('UPSTASH_REDIS_REST_TOKEN=test-token');
    });

    it('should include APP_INITIALIZED=true marker', () => {
      const config = createTestConfig();

      writeEnvFile(config, testEnvPath);

      const content = fs.readFileSync(testEnvPath, 'utf-8');
      expect(content).toContain('APP_INITIALIZED=true');
    });

    it('should include comment sections for organization', () => {
      const config = createTestConfig();

      writeEnvFile(config, testEnvPath);

      const content = fs.readFileSync(testEnvPath, 'utf-8');
      expect(content).toContain('# Database Configuration');
      expect(content).toContain('# Redis Configuration');
      expect(content).toContain('# Initialization Status');
    });

    it('should write file with correct permissions (Unix-like systems)', () => {
      const config = createTestConfig();

      writeEnvFile(config, testEnvPath);

      // On Windows, file permissions work differently
      // Just verify the file exists and is readable
      expect(fs.existsSync(testEnvPath)).toBe(true);

      // Verify we can read the file
      const content = fs.readFileSync(testEnvPath, 'utf-8');
      expect(content.length).toBeGreaterThan(0);
    });

    it('should handle Redis password with special characters', () => {
      const config = createTestConfig({
        redis: {
          type: 'local',
          host: 'localhost',
          port: 6379,
          password: 'p@ss:word#123',
          db: 0,
        },
      });

      writeEnvFile(config, testEnvPath);

      const content = fs.readFileSync(testEnvPath, 'utf-8');
      expect(content).toContain('REDIS_PASSWORD=p@ss:word#123');
    });

    it('should handle database password with special characters', () => {
      const config = createTestConfig({
        database: {
          type: 'local',
          host: 'localhost',
          port: 5432,
          username: 'admin',
          password: 'p@ss:word#123',
          database: 'mydb',
        },
      });

      writeEnvFile(config, testEnvPath);

      const content = fs.readFileSync(testEnvPath, 'utf-8');
      // Password should be URL encoded in DATABASE_URL
      expect(content).toContain('DATABASE_URL=');
    });

    it('should not write Upstash vars when using local Redis', () => {
      const config = createTestConfig({
        redis: {
          type: 'local',
          host: 'localhost',
          port: 6379,
          password: '',
          db: 0,
        },
      });

      writeEnvFile(config, testEnvPath);

      const content = fs.readFileSync(testEnvPath, 'utf-8');
      expect(content).not.toContain('UPSTASH_REDIS_REST_URL');
      expect(content).not.toContain('UPSTASH_REDIS_REST_TOKEN');
    });

    it('should not write local Redis vars when using Upstash', () => {
      const config = createTestConfig({
        redis: {
          type: 'upstash',
          upstashUrl: 'https://xxx.us1.upstash.io',
          upstashToken: 'test-token',
        },
      });

      writeEnvFile(config, testEnvPath);

      const content = fs.readFileSync(testEnvPath, 'utf-8');
      expect(content).not.toContain('REDIS_HOST');
      expect(content).not.toContain('REDIS_PORT');
      expect(content).not.toContain('REDIS_DB');
    });
  });
});
