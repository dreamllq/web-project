import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { LocalProvider } from './local.provider';
import type { LocalConfig } from './local.provider';

describe('LocalProvider', () => {
  let provider: LocalProvider;
  let tempDir: string;
  const baseUrl = 'http://localhost:3000/uploads';

  beforeEach(() => {
    // Create unique temp directory for each test
    tempDir = join(
      tmpdir(),
      `local-provider-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    const config: LocalConfig = {
      uploadDir: tempDir,
      baseUrl,
    };
    provider = new LocalProvider(config);
  });

  afterEach(() => {
    // Clean up temp directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    test('should create an instance with required config', () => {
      expect(provider).toBeDefined();
    });

    test('should create upload directory if it does not exist', async () => {
      // Wait for async directory creation
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(existsSync(tempDir)).toBe(true);
    });
  });

  describe('upload', () => {
    test('should upload a file and return correct result', async () => {
      const key = 'test/file.txt';
      const body = Buffer.from('test content');
      const result = await provider.upload(key, body);

      expect(result.key).toBe(key);
      expect(result.bucket).toBe(tempDir);
      expect(result.url).toBe(`${baseUrl}/${key}`);

      // Verify file was created
      const filePath = join(tempDir, key);
      expect(existsSync(filePath)).toBe(true);
      expect(readFileSync(filePath, 'utf-8')).toBe('test content');
    });

    test('should upload string body', async () => {
      const key = 'test/string.txt';
      const body = 'string content';
      const result = await provider.upload(key, body);

      expect(result.key).toBe(key);
      expect(result.url).toBe(`${baseUrl}/${key}`);

      const filePath = join(tempDir, key);
      expect(readFileSync(filePath, 'utf-8')).toBe(body);
    });

    test('should upload Uint8Array body', async () => {
      const key = 'test/binary.bin';
      const body = new Uint8Array([1, 2, 3, 4, 5]);
      const result = await provider.upload(key, body);

      expect(result.key).toBe(key);

      const filePath = join(tempDir, key);
      const content = readFileSync(filePath);
      expect(new Uint8Array(content)).toEqual(body);
    });

    test('should create nested directories for nested key paths', async () => {
      const key = 'nested/path/to/file.txt';
      const body = Buffer.from('nested content');
      const result = await provider.upload(key, body);

      expect(result.key).toBe(key);
      expect(existsSync(join(tempDir, key))).toBe(true);
      expect(existsSync(join(tempDir, 'nested/path/to'))).toBe(true);
    });

    test('should overwrite existing file', async () => {
      const key = 'test/overwrite.txt';
      const body1 = Buffer.from('original content');
      await provider.upload(key, body1);

      const body2 = Buffer.from('updated content');
      const result = await provider.upload(key, body2);

      expect(result.key).toBe(key);
      const filePath = join(tempDir, key);
      expect(readFileSync(filePath, 'utf-8')).toBe('updated content');
    });
  });

  describe('delete', () => {
    test('should delete an existing file', async () => {
      const key = 'test/delete.txt';
      const body = Buffer.from('to be deleted');
      await provider.upload(key, body);

      const filePath = join(tempDir, key);
      expect(existsSync(filePath)).toBe(true);

      await provider.delete(key);

      expect(existsSync(filePath)).toBe(false);
    });

    test('should silently ignore non-existent file', async () => {
      const key = 'test/nonexistent.txt';
      // Should not throw
      await expect(provider.delete(key)).resolves.toBeUndefined();
    });

    test('should delete file in nested directory', async () => {
      const key = 'nested/path/to/delete.txt';
      const body = Buffer.from('to be deleted');
      await provider.upload(key, body);

      const filePath = join(tempDir, key);
      expect(existsSync(filePath)).toBe(true);

      await provider.delete(key);

      expect(existsSync(filePath)).toBe(false);
    });
  });

  describe('getUrl', () => {
    test('should return URL with base URL and key', () => {
      const key = 'test/file.txt';
      const url = provider.getUrl(key);

      expect(url).toBe(`${baseUrl}/${key}`);
    });

    test('should handle nested key paths', () => {
      const key = 'nested/path/to/file.txt';
      const url = provider.getUrl(key);

      expect(url).toBe(`${baseUrl}/${key}`);
    });

    test('should handle key with special characters', () => {
      const key = 'test/file with spaces.txt';
      const url = provider.getUrl(key);

      expect(url).toBe(`${baseUrl}/${key}`);
    });
  });
});
