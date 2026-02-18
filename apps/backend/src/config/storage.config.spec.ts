import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { storageConfig } from './storage.config';
import type { MultiStorageConfig } from './storage.config';

describe('storageConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('provider validation', () => {
    test('should default to s3 provider when STORAGE_PROVIDER is not set', () => {
      delete process.env.STORAGE_PROVIDER;
      process.env.S3_ACCESS_KEY_ID = 'test-key';
      process.env.S3_SECRET_ACCESS_KEY = 'test-secret';
      process.env.S3_BUCKET = 'test-bucket';

      const config = storageConfig();

      expect(config.provider).toBe('s3');
    });

    test('should accept s3 provider', () => {
      process.env.STORAGE_PROVIDER = 's3';
      process.env.S3_ACCESS_KEY_ID = 'test-key';
      process.env.S3_SECRET_ACCESS_KEY = 'test-secret';
      process.env.S3_BUCKET = 'test-bucket';

      const config = storageConfig();

      expect(config.provider).toBe('s3');
    });

    test('should accept minio provider', () => {
      process.env.STORAGE_PROVIDER = 'minio';
      process.env.MINIO_ENDPOINT = 'http://localhost:9000';
      process.env.MINIO_ACCESS_KEY = 'minioadmin';
      process.env.MINIO_SECRET_KEY = 'minioadmin';
      process.env.MINIO_BUCKET = 'test-bucket';

      const config = storageConfig();

      expect(config.provider).toBe('minio');
    });

    test('should accept local provider', () => {
      process.env.STORAGE_PROVIDER = 'local';
      process.env.LOCAL_UPLOAD_DIR = './uploads';
      process.env.LOCAL_BASE_URL = 'http://localhost:3000/uploads';

      const config = storageConfig();

      expect(config.provider).toBe('local');
    });

    test('should throw error for invalid provider', () => {
      process.env.STORAGE_PROVIDER = 'invalid';
      expect(() => storageConfig()).toThrow(
        "Invalid STORAGE_PROVIDER: 'invalid'. Must be one of: s3, minio, local"
      );
    });
  });

  describe('S3 configuration', () => {
    test('should use S3_* environment variables', () => {
      process.env.STORAGE_PROVIDER = 's3';
      process.env.S3_ENDPOINT = 'https://s3.amazonaws.com';
      process.env.S3_REGION = 'us-west-2';
      process.env.S3_BUCKET = 'my-bucket';
      process.env.S3_ACCESS_KEY_ID = 'my-key';
      process.env.S3_SECRET_ACCESS_KEY = 'my-secret';
      process.env.S3_FORCE_PATH_STYLE = 'true';

      const config = storageConfig();

      expect(config.s3.endpoint).toBe('https://s3.amazonaws.com');
      expect(config.s3.region).toBe('us-west-2');
      expect(config.s3.bucket).toBe('my-bucket');
      expect(config.s3.accessKeyId).toBe('my-key');
      expect(config.s3.secretAccessKey).toBe('my-secret');
      expect(config.s3.forcePathStyle).toBe(true);
    });

    test('should fallback to STORAGE_* env vars for backward compatibility', () => {
      process.env.STORAGE_PROVIDER = 's3';
      process.env.STORAGE_ENDPOINT = 'https://s3.amazonaws.com';
      process.env.STORAGE_REGION = 'ap-northeast-1';
      process.env.STORAGE_BUCKET = 'legacy-bucket';
      process.env.STORAGE_ACCESS_KEY_ID = 'legacy-key';
      process.env.STORAGE_SECRET_ACCESS_KEY = 'legacy-secret';
      process.env.STORAGE_FORCE_PATH_STYLE = 'true';

      const config = storageConfig();

      expect(config.s3.endpoint).toBe('https://s3.amazonaws.com');
      expect(config.s3.region).toBe('ap-northeast-1');
      expect(config.s3.bucket).toBe('legacy-bucket');
      expect(config.s3.accessKeyId).toBe('legacy-key');
      expect(config.s3.secretAccessKey).toBe('legacy-secret');
      expect(config.s3.forcePathStyle).toBe(true);
    });

    test('should prefer S3_* over STORAGE_* env vars', () => {
      process.env.STORAGE_PROVIDER = 's3';
      process.env.S3_BUCKET = 'new-bucket';
      process.env.STORAGE_BUCKET = 'old-bucket';
      process.env.S3_ACCESS_KEY_ID = 'new-key';
      process.env.STORAGE_ACCESS_KEY_ID = 'old-key';
      process.env.S3_SECRET_ACCESS_KEY = 'new-secret';
      process.env.STORAGE_SECRET_ACCESS_KEY = 'old-secret';

      const config = storageConfig();

      expect(config.s3.bucket).toBe('new-bucket');
      expect(config.s3.accessKeyId).toBe('new-key');
      expect(config.s3.secretAccessKey).toBe('new-secret');
    });

    test('should throw error for missing S3 required fields', () => {
      process.env.STORAGE_PROVIDER = 's3';
      delete process.env.S3_ACCESS_KEY_ID;
      delete process.env.STORAGE_ACCESS_KEY_ID;
      delete process.env.S3_SECRET_ACCESS_KEY;
      delete process.env.STORAGE_SECRET_ACCESS_KEY;
      delete process.env.S3_BUCKET;
      delete process.env.STORAGE_BUCKET;

      expect(() => storageConfig()).toThrow('Missing required S3 configuration');
    });

    test('should throw error for missing S3_ACCESS_KEY_ID', () => {
      process.env.STORAGE_PROVIDER = 's3';
      process.env.S3_SECRET_ACCESS_KEY = 'my-secret';
      process.env.S3_BUCKET = 'my-bucket';
      delete process.env.S3_ACCESS_KEY_ID;
      delete process.env.STORAGE_ACCESS_KEY_ID;

      expect(() => storageConfig()).toThrow('Missing required S3 configuration');
      expect(() => storageConfig()).toThrow('S3_ACCESS_KEY_ID');
    });

    test('should throw error for missing S3_SECRET_ACCESS_KEY', () => {
      process.env.STORAGE_PROVIDER = 's3';
      process.env.S3_ACCESS_KEY_ID = 'my-key';
      process.env.S3_BUCKET = 'my-bucket';
      delete process.env.S3_SECRET_ACCESS_KEY;
      delete process.env.STORAGE_SECRET_ACCESS_KEY;

      expect(() => storageConfig()).toThrow('Missing required S3 configuration');
      expect(() => storageConfig()).toThrow('S3_SECRET_ACCESS_KEY');
    });

    test('should throw error for missing S3_BUCKET', () => {
      process.env.STORAGE_PROVIDER = 's3';
      process.env.S3_ACCESS_KEY_ID = 'my-key';
      process.env.S3_SECRET_ACCESS_KEY = 'my-secret';
      delete process.env.S3_BUCKET;
      delete process.env.STORAGE_BUCKET;

      expect(() => storageConfig()).toThrow('Missing required S3 configuration');
      expect(() => storageConfig()).toThrow('S3_BUCKET');
    });
  });

  describe('MinIO configuration', () => {
    test('should use MINIO_* environment variables', () => {
      process.env.STORAGE_PROVIDER = 'minio';
      process.env.MINIO_ENDPOINT = 'http://localhost:9000';
      process.env.MINIO_ACCESS_KEY = 'minioadmin';
      process.env.MINIO_SECRET_KEY = 'minioadmin';
      process.env.MINIO_BUCKET = 'avatars';
      process.env.MINIO_USE_SSL = 'true';

      const config = storageConfig();

      expect(config.minio.endpoint).toBe('http://localhost:9000');
      expect(config.minio.accessKey).toBe('minioadmin');
      expect(config.minio.secretKey).toBe('minioadmin');
      expect(config.minio.bucket).toBe('avatars');
      expect(config.minio.useSSL).toBe(true);
    });

    test('should infer useSSL from endpoint scheme', () => {
      process.env.STORAGE_PROVIDER = 'minio';
      process.env.MINIO_ENDPOINT = 'https://minio.example.com';
      process.env.MINIO_ACCESS_KEY = 'key';
      process.env.MINIO_SECRET_KEY = 'secret';
      process.env.MINIO_BUCKET = 'bucket';
      delete process.env.MINIO_USE_SSL;

      const config = storageConfig();

      expect(config.minio.useSSL).toBe(true);
    });

    test('should throw error for missing MinIO required fields', () => {
      process.env.STORAGE_PROVIDER = 'minio';
      delete process.env.MINIO_ENDPOINT;
      delete process.env.MINIO_ACCESS_KEY;
      delete process.env.MINIO_SECRET_KEY;
      delete process.env.MINIO_BUCKET;

      expect(() => storageConfig()).toThrow('Missing required MinIO configuration');
    });

    test('should throw error for missing MINIO_ENDPOINT', () => {
      process.env.STORAGE_PROVIDER = 'minio';
      process.env.MINIO_ACCESS_KEY = 'minioadmin';
      process.env.MINIO_SECRET_KEY = 'minioadmin';
      process.env.MINIO_BUCKET = 'bucket';
      delete process.env.MINIO_ENDPOINT;

      expect(() => storageConfig()).toThrow('Missing required MinIO configuration');
      expect(() => storageConfig()).toThrow('MINIO_ENDPOINT');
    });

    test('should throw error for missing MINIO_ACCESS_KEY', () => {
      process.env.STORAGE_PROVIDER = 'minio';
      process.env.MINIO_ENDPOINT = 'http://localhost:9000';
      process.env.MINIO_SECRET_KEY = 'minioadmin';
      process.env.MINIO_BUCKET = 'bucket';
      delete process.env.MINIO_ACCESS_KEY;

      expect(() => storageConfig()).toThrow('Missing required MinIO configuration');
      expect(() => storageConfig()).toThrow('MINIO_ACCESS_KEY');
    });

    test('should throw error for missing MINIO_SECRET_KEY', () => {
      process.env.STORAGE_PROVIDER = 'minio';
      process.env.MINIO_ENDPOINT = 'http://localhost:9000';
      process.env.MINIO_ACCESS_KEY = 'minioadmin';
      process.env.MINIO_BUCKET = 'bucket';
      delete process.env.MINIO_SECRET_KEY;

      expect(() => storageConfig()).toThrow('Missing required MinIO configuration');
      expect(() => storageConfig()).toThrow('MINIO_SECRET_KEY');
    });

    test('should throw error for missing MINIO_BUCKET', () => {
      process.env.STORAGE_PROVIDER = 'minio';
      process.env.MINIO_ENDPOINT = 'http://localhost:9000';
      process.env.MINIO_ACCESS_KEY = 'minioadmin';
      process.env.MINIO_SECRET_KEY = 'minioadmin';
      delete process.env.MINIO_BUCKET;

      expect(() => storageConfig()).toThrow('Missing required MinIO configuration');
      expect(() => storageConfig()).toThrow('MINIO_BUCKET');
    });
  });

  describe('Local configuration', () => {
    test('should use LOCAL_* environment variables', () => {
      process.env.STORAGE_PROVIDER = 'local';
      process.env.LOCAL_UPLOAD_DIR = './uploads';
      process.env.LOCAL_BASE_URL = 'http://localhost:3000/uploads';

      const config = storageConfig();

      expect(config.local.uploadDir).toBe('./uploads');
      expect(config.local.baseUrl).toBe('http://localhost:3000/uploads');
    });

    test('should throw error for missing Local required fields', () => {
      process.env.STORAGE_PROVIDER = 'local';
      delete process.env.LOCAL_UPLOAD_DIR;
      delete process.env.LOCAL_BASE_URL;

      expect(() => storageConfig()).toThrow('Missing required Local storage configuration');
    });

    test('should throw error for missing LOCAL_UPLOAD_DIR', () => {
      process.env.STORAGE_PROVIDER = 'local';
      process.env.LOCAL_BASE_URL = 'http://localhost:3000/uploads';
      delete process.env.LOCAL_UPLOAD_DIR;

      expect(() => storageConfig()).toThrow('Missing required Local storage configuration');
      expect(() => storageConfig()).toThrow('LOCAL_UPLOAD_DIR');
    });

    test('should throw error for missing LOCAL_BASE_URL', () => {
      process.env.STORAGE_PROVIDER = 'local';
      process.env.LOCAL_UPLOAD_DIR = './uploads';
      delete process.env.LOCAL_BASE_URL;

      expect(() => storageConfig()).toThrow('Missing required Local storage configuration');
      expect(() => storageConfig()).toThrow('LOCAL_BASE_URL');
    });
  });

  describe('backward compatibility (legacy flat fields)', () => {
    test('should expose flat fields for S3 provider', () => {
      process.env.STORAGE_PROVIDER = 's3';
      process.env.S3_ENDPOINT = 'https://s3.amazonaws.com';
      process.env.S3_REGION = 'eu-west-1';
      process.env.S3_BUCKET = 'compat-bucket';
      process.env.S3_ACCESS_KEY_ID = 'compat-key';
      process.env.S3_SECRET_ACCESS_KEY = 'compat-secret';
      process.env.S3_FORCE_PATH_STYLE = 'false';

      const config = storageConfig();

      // Legacy flat fields should match s3 config
      expect(config.accessKeyId).toBe('compat-key');
      expect(config.secretAccessKey).toBe('compat-secret');
      expect(config.region).toBe('eu-west-1');
      expect(config.bucket).toBe('compat-bucket');
      expect(config.endpoint).toBe('https://s3.amazonaws.com');
      expect(config.forcePathStyle).toBe(false);
    });

    test('should expose flat fields for MinIO provider', () => {
      process.env.STORAGE_PROVIDER = 'minio';
      process.env.MINIO_ENDPOINT = 'http://localhost:9000';
      process.env.MINIO_ACCESS_KEY = 'minioadmin';
      process.env.MINIO_SECRET_KEY = 'minioadmin';
      process.env.MINIO_BUCKET = 'minio-bucket';

      const config = storageConfig();

      // Legacy flat fields should map from minio config
      expect(config.accessKeyId).toBe('minioadmin');
      expect(config.secretAccessKey).toBe('minioadmin');
      expect(config.region).toBe('local');
      expect(config.bucket).toBe('minio-bucket');
      expect(config.endpoint).toBe('http://localhost:9000');
      expect(config.forcePathStyle).toBe(true);
    });

    test('should expose flat fields for Local provider', () => {
      process.env.STORAGE_PROVIDER = 'local';
      process.env.LOCAL_UPLOAD_DIR = './uploads';
      process.env.LOCAL_BASE_URL = 'http://localhost:3000/uploads';

      const config = storageConfig();

      // Local provider has empty/minimal S3-style fields
      expect(config.accessKeyId).toBe('');
      expect(config.secretAccessKey).toBe('');
      expect(config.region).toBe('local');
      expect(config.bucket).toBe('local');
      expect(config.endpoint).toBeUndefined();
      expect(config.forcePathStyle).toBe(false);
    });
  });

  describe('full configuration output', () => {
    test('should return complete MultiStorageConfig for S3 provider', () => {
      process.env.STORAGE_PROVIDER = 's3';
      process.env.S3_ENDPOINT = 'https://s3.amazonaws.com';
      process.env.S3_REGION = 'us-west-2';
      process.env.S3_BUCKET = 'my-s3-bucket';
      process.env.S3_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
      process.env.S3_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
      process.env.S3_FORCE_PATH_STYLE = 'false';

      const config = storageConfig() as MultiStorageConfig;

      expect(config.provider).toBe('s3');
      expect(config.s3).toEqual({
        endpoint: 'https://s3.amazonaws.com',
        region: 'us-west-2',
        bucket: 'my-s3-bucket',
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        forcePathStyle: false,
      });
      // Verify backward-compatible flat fields
      expect(config.accessKeyId).toBe('AKIAIOSFODNN7EXAMPLE');
      expect(config.secretAccessKey).toBe('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
      expect(config.region).toBe('us-west-2');
      expect(config.bucket).toBe('my-s3-bucket');
    });

    test('should return complete MultiStorageConfig for MinIO provider', () => {
      process.env.STORAGE_PROVIDER = 'minio';
      process.env.MINIO_ENDPOINT = 'http://localhost:9000';
      process.env.MINIO_ACCESS_KEY = 'minioadmin';
      process.env.MINIO_SECRET_KEY = 'minioadmin';
      process.env.MINIO_BUCKET = 'avatars';
      process.env.MINIO_USE_SSL = 'false';

      const config = storageConfig() as MultiStorageConfig;

      expect(config.provider).toBe('minio');
      expect(config.minio).toEqual({
        endpoint: 'http://localhost:9000',
        accessKey: 'minioadmin',
        secretKey: 'minioadmin',
        bucket: 'avatars',
        useSSL: false,
      });
      // Verify backward-compatible flat fields
      expect(config.accessKeyId).toBe('minioadmin');
      expect(config.secretAccessKey).toBe('minioadmin');
      expect(config.region).toBe('local');
      expect(config.bucket).toBe('avatars');
      expect(config.endpoint).toBe('http://localhost:9000');
      expect(config.forcePathStyle).toBe(true);
    });

    test('should return complete MultiStorageConfig for Local provider', () => {
      process.env.STORAGE_PROVIDER = 'local';
      process.env.LOCAL_UPLOAD_DIR = './uploads';
      process.env.LOCAL_BASE_URL = 'http://localhost:3000/uploads';

      const config = storageConfig() as MultiStorageConfig;

      expect(config.provider).toBe('local');
      expect(config.local).toEqual({
        uploadDir: './uploads',
        baseUrl: 'http://localhost:3000/uploads',
      });
    });
  });
});
