import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';

// Create mock functions
const mockSend = mock(() => Promise.resolve({}));
const mockGetSignedUrl = mock(() => Promise.resolve('https://signed-url.example.com'));

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
  GetObjectCommand: class MockGetObjectCommand {
    constructor(public input: Record<string, unknown>) {}
  },
}));

mock.module('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl,
}));

// Import after mock is set up
import { MinIOProvider } from './minio.provider';
import type { MinIOConfig } from './minio.provider';

describe('MinIOProvider', () => {
  let provider: MinIOProvider;
  const defaultConfig: MinIOConfig = {
    endpoint: 'http://localhost:9000',
    accessKey: 'minioadmin',
    secretKey: 'minioadmin',
    bucket: 'test-bucket',
    useSSL: false,
  };

  beforeEach(() => {
    mockSend.mockClear();
    mockGetSignedUrl.mockClear();
    provider = new MinIOProvider(defaultConfig);
  });

  afterEach(() => {
    mockSend.mockClear();
    mockGetSignedUrl.mockClear();
  });

  describe('constructor', () => {
    test('should create an instance with required config', () => {
      expect(provider).toBeDefined();
    });

    test('should detect SSL from https endpoint', () => {
      const sslConfig: MinIOConfig = {
        ...defaultConfig,
        endpoint: 'https://minio.example.com',
        useSSL: undefined,
      };
      const sslProvider = new MinIOProvider(sslConfig);
      expect(sslProvider).toBeDefined();
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
    test('should return path-style URL', () => {
      const key = 'test/file.txt';
      const url = provider.getUrl(key);

      expect(url).toBe(`${defaultConfig.endpoint}/${defaultConfig.bucket}/${key}`);
    });

    test('should handle endpoint with trailing slash', () => {
      const customConfig: MinIOConfig = {
        ...defaultConfig,
        endpoint: 'http://localhost:9000/',
      };
      const customProvider = new MinIOProvider(customConfig);
      const key = 'test/file.txt';
      const url = customProvider.getUrl(key);

      expect(url).toBe(`http://localhost:9000/${defaultConfig.bucket}/${key}`);
    });

    test('should handle nested key paths', () => {
      const key = 'nested/path/to/file.txt';
      const url = provider.getUrl(key);

      expect(url).toBe(`${defaultConfig.endpoint}/${defaultConfig.bucket}/${key}`);
    });

    test('should handle https endpoint', () => {
      const sslConfig: MinIOConfig = {
        ...defaultConfig,
        endpoint: 'https://minio.example.com',
      };
      const sslProvider = new MinIOProvider(sslConfig);
      const key = 'test/file.txt';
      const url = sslProvider.getUrl(key);

      expect(url).toBe(`https://minio.example.com/${defaultConfig.bucket}/${key}`);
    });
  });

  describe('getSignedUrl', () => {
    test('should return a signed URL', async () => {
      const key = 'test/file.txt';
      const signedUrl = await provider.getSignedUrl(key);

      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
      expect(signedUrl).toBe('https://signed-url.example.com');
    });

    test('should accept custom expiry time', async () => {
      const key = 'test/file.txt';
      const expiresIn = 7200;
      await provider.getSignedUrl(key, expiresIn);

      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
    });
  });
});
