import { describe, test, expect } from 'bun:test';
import {
  createStorageProvider,
  supportsSignedUrl,
  S3Provider,
  MinIOProvider,
  LocalProvider,
} from './index';
import type { MultiStorageConfig } from '../../config/storage.config';

describe('Storage Provider Factory', () => {
  describe('createStorageProvider', () => {
    test('should create S3Provider when provider is s3', () => {
      const config: MultiStorageConfig = {
        provider: 's3',
        s3: {
          endpoint: '',
          region: 'us-east-1',
          bucket: 'test-bucket',
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          forcePathStyle: false,
        },
        minio: {
          endpoint: '',
          accessKey: '',
          secretKey: '',
          bucket: '',
          useSSL: false,
        },
        local: {
          uploadDir: '',
          baseUrl: '',
        },
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        region: 'us-east-1',
        bucket: 'test-bucket',
      };

      const provider = createStorageProvider(config);

      expect(provider).toBeInstanceOf(S3Provider);
    });

    test('should create S3Provider with custom endpoint', () => {
      const config: MultiStorageConfig = {
        provider: 's3',
        s3: {
          endpoint: 'https://oss-cn-hangzhou.aliyuncs.com',
          region: 'us-east-1',
          bucket: 'test-bucket',
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          forcePathStyle: true,
        },
        minio: {
          endpoint: '',
          accessKey: '',
          secretKey: '',
          bucket: '',
          useSSL: false,
        },
        local: {
          uploadDir: '',
          baseUrl: '',
        },
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        region: 'us-east-1',
        bucket: 'test-bucket',
        endpoint: 'https://oss-cn-hangzhou.aliyuncs.com',
        forcePathStyle: true,
      };

      const provider = createStorageProvider(config);

      expect(provider).toBeInstanceOf(S3Provider);
      const url = provider.getUrl('test.txt');
      expect(url).toContain('oss-cn-hangzhou.aliyuncs.com');
    });

    test('should create MinIOProvider when provider is minio', () => {
      const config: MultiStorageConfig = {
        provider: 'minio',
        s3: {
          endpoint: '',
          region: 'us-east-1',
          bucket: '',
          accessKeyId: '',
          secretAccessKey: '',
          forcePathStyle: false,
        },
        minio: {
          endpoint: 'http://localhost:9000',
          accessKey: 'minioadmin',
          secretKey: 'minioadmin',
          bucket: 'test-bucket',
          useSSL: false,
        },
        local: {
          uploadDir: '',
          baseUrl: '',
        },
        accessKeyId: 'minioadmin',
        secretAccessKey: 'minioadmin',
        region: 'local',
        bucket: 'test-bucket',
        endpoint: 'http://localhost:9000',
        forcePathStyle: true,
      };

      const provider = createStorageProvider(config);

      expect(provider).toBeInstanceOf(MinIOProvider);
    });

    test('should create LocalProvider when provider is local', () => {
      const config: MultiStorageConfig = {
        provider: 'local',
        s3: {
          endpoint: '',
          region: 'us-east-1',
          bucket: '',
          accessKeyId: '',
          secretAccessKey: '',
          forcePathStyle: false,
        },
        minio: {
          endpoint: '',
          accessKey: '',
          secretKey: '',
          bucket: '',
          useSSL: false,
        },
        local: {
          uploadDir: './uploads',
          baseUrl: 'http://localhost:3000/uploads',
        },
        accessKeyId: '',
        secretAccessKey: '',
        region: 'local',
        bucket: 'local',
      };

      const provider = createStorageProvider(config);

      expect(provider).toBeInstanceOf(LocalProvider);
    });

    test('should throw error for invalid provider type', () => {
      const config = {
        provider: 'invalid',
        s3: {
          endpoint: '',
          region: '',
          bucket: '',
          accessKeyId: '',
          secretAccessKey: '',
          forcePathStyle: false,
        },
        minio: {
          endpoint: '',
          accessKey: '',
          secretKey: '',
          bucket: '',
          useSSL: false,
        },
        local: {
          uploadDir: '',
          baseUrl: '',
        },
        accessKeyId: '',
        secretAccessKey: '',
        region: '',
        bucket: '',
      } as unknown as MultiStorageConfig;

      expect(() => createStorageProvider(config)).toThrow('Unsupported storage provider: invalid');
    });
  });

  describe('supportsSignedUrl', () => {
    test('should return true for MinIOProvider', () => {
      const config: MultiStorageConfig = {
        provider: 'minio',
        s3: {
          endpoint: '',
          region: 'us-east-1',
          bucket: '',
          accessKeyId: '',
          secretAccessKey: '',
          forcePathStyle: false,
        },
        minio: {
          endpoint: 'http://localhost:9000',
          accessKey: 'minioadmin',
          secretKey: 'minioadmin',
          bucket: 'test-bucket',
          useSSL: false,
        },
        local: {
          uploadDir: '',
          baseUrl: '',
        },
        accessKeyId: 'minioadmin',
        secretAccessKey: 'minioadmin',
        region: 'local',
        bucket: 'test-bucket',
      };

      const provider = createStorageProvider(config);
      expect(supportsSignedUrl(provider)).toBe(true);
    });

    test('should return false for S3Provider', () => {
      const config: MultiStorageConfig = {
        provider: 's3',
        s3: {
          endpoint: '',
          region: 'us-east-1',
          bucket: 'test-bucket',
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          forcePathStyle: false,
        },
        minio: {
          endpoint: '',
          accessKey: '',
          secretKey: '',
          bucket: '',
          useSSL: false,
        },
        local: {
          uploadDir: '',
          baseUrl: '',
        },
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        region: 'us-east-1',
        bucket: 'test-bucket',
      };

      const provider = createStorageProvider(config);
      expect(supportsSignedUrl(provider)).toBe(false);
    });

    test('should return false for LocalProvider', () => {
      const config: MultiStorageConfig = {
        provider: 'local',
        s3: {
          endpoint: '',
          region: 'us-east-1',
          bucket: '',
          accessKeyId: '',
          secretAccessKey: '',
          forcePathStyle: false,
        },
        minio: {
          endpoint: '',
          accessKey: '',
          secretKey: '',
          bucket: '',
          useSSL: false,
        },
        local: {
          uploadDir: './uploads',
          baseUrl: 'http://localhost:3000/uploads',
        },
        accessKeyId: '',
        secretAccessKey: '',
        region: 'local',
        bucket: 'local',
      };

      const provider = createStorageProvider(config);
      expect(supportsSignedUrl(provider)).toBe(false);
    });
  });

  describe('exports', () => {
    test('should export S3Provider class', () => {
      expect(S3Provider).toBeDefined();
    });

    test('should export MinIOProvider class', () => {
      expect(MinIOProvider).toBeDefined();
    });

    test('should export LocalProvider class', () => {
      expect(LocalProvider).toBeDefined();
    });
  });
});
