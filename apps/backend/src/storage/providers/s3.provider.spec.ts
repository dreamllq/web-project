import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';

// Create mock function
const mockSend = mock(() => Promise.resolve({}));

// Mock the AWS SDK before importing the provider
mock.module('@aws-sdk/client-s3', () => ({
  S3Client: class MockS3Client {
    send = mockSend;
    constructor(_config: Record<string, unknown>) {}
  },
  PutObjectCommand: class MockPutObjectCommand {
    constructor(public input: Record<string, unknown>) {}
  },
  DeleteObjectCommand: class MockDeleteObjectCommand {
    constructor(public input: Record<string, unknown>) {}
  },
}));

// Import after mock is set up
import { S3Provider } from './s3.provider';
import type { S3Config } from './s3.provider';

describe('S3Provider', () => {
  let provider: S3Provider;
  const defaultConfig: S3Config = {
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    region: 'us-east-1',
    bucket: 'test-bucket',
  };

  beforeEach(() => {
    mockSend.mockClear();
    provider = new S3Provider(defaultConfig);
  });

  afterEach(() => {
    mockSend.mockClear();
  });

  describe('constructor', () => {
    test('should create an instance with required config', () => {
      expect(provider).toBeDefined();
    });
  });

  describe('upload', () => {
    test('should upload a file and return correct result', async () => {
      const key = 'test/file.txt';
      const body = Buffer.from('test content');
      const result = await provider.upload(key, body);

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(result.key).toBe(key);
      expect(result.bucket).toBe(defaultConfig.bucket);
      expect(result.url).toContain(key);
    });

    test('should upload with content type and metadata', async () => {
      const key = 'test/file.txt';
      const body = Buffer.from('test content');
      const options = {
        contentType: 'text/plain',
        metadata: { 'custom-key': 'custom-value' },
      };

      const result = await provider.upload(key, body, options);

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(result.key).toBe(key);
    });

    test('should upload string body', async () => {
      const key = 'test/string.txt';
      const body = 'string content';
      const result = await provider.upload(key, body);

      expect(result.key).toBe(key);
      expect(result.url).toContain(key);
    });

    test('should upload Uint8Array body', async () => {
      const key = 'test/binary.bin';
      const body = new Uint8Array([1, 2, 3, 4, 5]);
      const result = await provider.upload(key, body);

      expect(result.key).toBe(key);
    });
  });

  describe('delete', () => {
    test('should delete a file', async () => {
      const key = 'test/file.txt';
      await provider.delete(key);

      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('getUrl', () => {
    test('should return standard AWS S3 URL format when no endpoint', () => {
      const key = 'test/file.txt';
      const url = provider.getUrl(key);

      expect(url).toBe(
        `https://${defaultConfig.bucket}.s3.${defaultConfig.region}.amazonaws.com/${key}`
      );
    });

    test('should return path-style URL when forcePathStyle is true', () => {
      const customConfig: S3Config = {
        ...defaultConfig,
        endpoint: 'http://localhost:9000',
        forcePathStyle: true,
      };
      const customProvider = new S3Provider(customConfig);
      const key = 'test/file.txt';
      const url = customProvider.getUrl(key);

      expect(url).toBe(`http://localhost:9000/${defaultConfig.bucket}/${key}`);
    });

    test('should return virtual-hosted style URL when endpoint is set and forcePathStyle is false', () => {
      const customConfig: S3Config = {
        ...defaultConfig,
        endpoint: 'https://oss-cn-hangzhou.aliyuncs.com',
        forcePathStyle: false,
      };
      const customProvider = new S3Provider(customConfig);
      const key = 'test/file.txt';
      const url = customProvider.getUrl(key);

      expect(url).toBe(`https://${defaultConfig.bucket}.oss-cn-hangzhou.aliyuncs.com/${key}`);
    });

    test('should handle endpoint with trailing slash', () => {
      const customConfig: S3Config = {
        ...defaultConfig,
        endpoint: 'http://localhost:9000/',
        forcePathStyle: true,
      };
      const customProvider = new S3Provider(customConfig);
      const key = 'test/file.txt';
      const url = customProvider.getUrl(key);

      expect(url).toBe(`http://localhost:9000/${defaultConfig.bucket}/${key}`);
    });

    test('should handle nested key paths', () => {
      const key = 'nested/path/to/file.txt';
      const url = provider.getUrl(key);

      expect(url).toBe(
        `https://${defaultConfig.bucket}.s3.${defaultConfig.region}.amazonaws.com/${key}`
      );
    });
  });
});
