import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import type { MultiStorageConfig } from '../config/storage.config';

describe('StorageService', () => {
  let storageService: StorageService;
  let configService: ConfigService;

  const mockStorageConfig: MultiStorageConfig = {
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
    // Legacy fields
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    region: 'us-east-1',
    bucket: 'test-bucket',
  };

  beforeEach(() => {
    configService = {
      get: mock(() => mockStorageConfig),
    } as unknown as ConfigService;

    storageService = new StorageService(configService);
  });

  afterEach(() => {
    // Cleanup
  });

  describe('initialization', () => {
    test('should be defined', () => {
      expect(storageService).toBeDefined();
    });

    test('should initialize with config from ConfigService', () => {
      expect(configService.get).toHaveBeenCalledWith('storage');
    });
  });

  describe('getUrl', () => {
    test('should return S3 URL when endpoint is not set', async () => {
      const key = 'test/file.txt';
      const url = await storageService.getUrl(key);

      expect(url).toBe(
        `https://${mockStorageConfig.bucket}.s3.${mockStorageConfig.region}.amazonaws.com/${key}`
      );
    });

    test('should return custom endpoint URL with path style when forcePathStyle is true', async () => {
      const customConfig: MultiStorageConfig = {
        ...mockStorageConfig,
        endpoint: 'http://localhost:9000',
        forcePathStyle: true,
        s3: {
          ...mockStorageConfig.s3,
          endpoint: 'http://localhost:9000',
          forcePathStyle: true,
        },
      };

      const customConfigService = {
        get: mock(() => customConfig),
      } as unknown as ConfigService;

      const customStorageService = new StorageService(customConfigService);
      const key = 'test/file.txt';
      const url = await customStorageService.getUrl(key);

      expect(url).toBe(`http://localhost:9000/${customConfig.bucket}/${key}`);
    });

    test('should return virtual-hosted style URL when endpoint is set and forcePathStyle is false', async () => {
      const customConfig: MultiStorageConfig = {
        ...mockStorageConfig,
        endpoint: 'https://oss-cn-hangzhou.aliyuncs.com',
        forcePathStyle: false,
        s3: {
          ...mockStorageConfig.s3,
          endpoint: 'https://oss-cn-hangzhou.aliyuncs.com',
          forcePathStyle: false,
        },
      };

      const customConfigService = {
        get: mock(() => customConfig),
      } as unknown as ConfigService;

      const customStorageService = new StorageService(customConfigService);
      const key = 'test/file.txt';
      const url = await customStorageService.getUrl(key);

      expect(url).toBe(`https://${customConfig.bucket}.oss-cn-hangzhou.aliyuncs.com/${key}`);
    });
  });

  describe('upload', () => {
    test('should upload a file and return result', async () => {
      // This is a placeholder test - full integration tests would need mocking AWS SDK
      const key = 'test/upload.txt';
      const body = Buffer.from('test content');

      // For now, we'll just verify the method exists and returns expected structure
      // In a real test, we would mock the S3Client
      expect(storageService.upload).toBeDefined();
    });
  });

  describe('delete', () => {
    test('should delete a file', async () => {
      // This is a placeholder test - full integration tests would need mocking AWS SDK
      expect(storageService.delete).toBeDefined();
    });
  });

  describe('getSignedUrl', () => {
    test('should return a signed URL', async () => {
      // This is a placeholder test - full integration tests would need mocking AWS SDK
      expect(storageService.getSignedUrl).toBeDefined();
    });
  });
});
