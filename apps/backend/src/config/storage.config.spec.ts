import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { storageConfig } from './storage.config';

describe('storageConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('default values', () => {
    test('should return default values when env vars are not set', () => {
      delete process.env.STORAGE_PROVIDER;
      delete process.env.STORAGE_ACCESS_KEY_ID;
      delete process.env.STORAGE_SECRET_ACCESS_KEY;
      delete process.env.STORAGE_REGION;
      delete process.env.STORAGE_BUCKET;
      delete process.env.STORAGE_ENDPOINT;
      delete process.env.STORAGE_FORCE_PATH_STYLE;

      const config = storageConfig();

      expect(config.provider).toBe('s3');
      expect(config.accessKeyId).toBe('');
      expect(config.secretAccessKey).toBe('');
      expect(config.region).toBe('us-east-1');
      expect(config.bucket).toBe('');
      expect(config.endpoint).toBeUndefined();
      expect(config.forcePathStyle).toBe(false);
    });
  });

  describe('environment variable parsing', () => {
    test('should parse STORAGE_PROVIDER', () => {
      process.env.STORAGE_PROVIDER = 'oss';
      const config = storageConfig();
      expect(config.provider).toBe('oss');
    });

    test('should parse STORAGE_PROVIDER as minio', () => {
      process.env.STORAGE_PROVIDER = 'minio';
      const config = storageConfig();
      expect(config.provider).toBe('minio');
    });

    test('should parse STORAGE_ACCESS_KEY_ID', () => {
      process.env.STORAGE_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
      const config = storageConfig();
      expect(config.accessKeyId).toBe('AKIAIOSFODNN7EXAMPLE');
    });

    test('should parse STORAGE_SECRET_ACCESS_KEY', () => {
      process.env.STORAGE_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
      const config = storageConfig();
      expect(config.secretAccessKey).toBe('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
    });

    test('should parse STORAGE_REGION', () => {
      process.env.STORAGE_REGION = 'ap-northeast-1';
      const config = storageConfig();
      expect(config.region).toBe('ap-northeast-1');
    });

    test('should parse STORAGE_BUCKET', () => {
      process.env.STORAGE_BUCKET = 'my-app-bucket';
      const config = storageConfig();
      expect(config.bucket).toBe('my-app-bucket');
    });

    test('should parse STORAGE_ENDPOINT', () => {
      process.env.STORAGE_ENDPOINT = 'https://oss-cn-hangzhou.aliyuncs.com';
      const config = storageConfig();
      expect(config.endpoint).toBe('https://oss-cn-hangzhou.aliyuncs.com');
    });

    test('should parse STORAGE_FORCE_PATH_STYLE as true', () => {
      process.env.STORAGE_FORCE_PATH_STYLE = 'true';
      const config = storageConfig();
      expect(config.forcePathStyle).toBe(true);
    });

    test('should parse STORAGE_FORCE_PATH_STYLE as false', () => {
      process.env.STORAGE_FORCE_PATH_STYLE = 'false';
      const config = storageConfig();
      expect(config.forcePathStyle).toBe(false);
    });
  });

  describe('full configuration', () => {
    test('should return full config with all env vars set for S3', () => {
      process.env.STORAGE_PROVIDER = 's3';
      process.env.STORAGE_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
      process.env.STORAGE_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
      process.env.STORAGE_REGION = 'us-west-2';
      process.env.STORAGE_BUCKET = 'my-s3-bucket';

      const config = storageConfig();

      expect(config).toEqual({
        provider: 's3',
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        region: 'us-west-2',
        bucket: 'my-s3-bucket',
        endpoint: undefined,
        forcePathStyle: false,
      });
    });

    test('should return full config with all env vars set for OSS', () => {
      process.env.STORAGE_PROVIDER = 'oss';
      process.env.STORAGE_ACCESS_KEY_ID = 'LTAI4xxx';
      process.env.STORAGE_SECRET_ACCESS_KEY = 'oss-secret-key';
      process.env.STORAGE_REGION = 'oss-cn-hangzhou';
      process.env.STORAGE_BUCKET = 'my-oss-bucket';
      process.env.STORAGE_ENDPOINT = 'https://oss-cn-hangzhou.aliyuncs.com';

      const config = storageConfig();

      expect(config).toEqual({
        provider: 'oss',
        accessKeyId: 'LTAI4xxx',
        secretAccessKey: 'oss-secret-key',
        region: 'oss-cn-hangzhou',
        bucket: 'my-oss-bucket',
        endpoint: 'https://oss-cn-hangzhou.aliyuncs.com',
        forcePathStyle: false,
      });
    });

    test('should return full config with all env vars set for MinIO', () => {
      process.env.STORAGE_PROVIDER = 'minio';
      process.env.STORAGE_ACCESS_KEY_ID = 'minioadmin';
      process.env.STORAGE_SECRET_ACCESS_KEY = 'minioadmin';
      process.env.STORAGE_REGION = 'local';
      process.env.STORAGE_BUCKET = 'local-bucket';
      process.env.STORAGE_ENDPOINT = 'http://localhost:9000';
      process.env.STORAGE_FORCE_PATH_STYLE = 'true';

      const config = storageConfig();

      expect(config).toEqual({
        provider: 'minio',
        accessKeyId: 'minioadmin',
        secretAccessKey: 'minioadmin',
        region: 'local',
        bucket: 'local-bucket',
        endpoint: 'http://localhost:9000',
        forcePathStyle: true,
      });
    });
  });
});
