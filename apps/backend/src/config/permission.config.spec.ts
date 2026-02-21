import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { permissionConfig } from './permission.config';

describe('permissionConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('default values', () => {
    test('should return default values when env vars are not set', () => {
      delete process.env.USE_ABAC_ONLY;

      const config = permissionConfig();

      expect(config.useAbacOnly).toBe(false);
    });
  });

  describe('environment variable parsing', () => {
    test('should parse USE_ABAC_ONLY as boolean true', () => {
      process.env.USE_ABAC_ONLY = 'true';
      const config = permissionConfig();
      expect(config.useAbacOnly).toBe(true);
    });

    test('should parse USE_ABAC_ONLY as boolean false when set to "false"', () => {
      process.env.USE_ABAC_ONLY = 'false';
      const config = permissionConfig();
      expect(config.useAbacOnly).toBe(false);
    });

    test('should parse USE_ABAC_ONLY as boolean false when set to any other value', () => {
      process.env.USE_ABAC_ONLY = 'yes';
      const config = permissionConfig();
      expect(config.useAbacOnly).toBe(false);
    });

    test('should parse USE_ABAC_ONLY as boolean false when set to "1"', () => {
      process.env.USE_ABAC_ONLY = '1';
      const config = permissionConfig();
      expect(config.useAbacOnly).toBe(false);
    });
  });

  describe('full configuration', () => {
    test('should return full config with USE_ABAC_ONLY=true', () => {
      process.env.USE_ABAC_ONLY = 'true';

      const config = permissionConfig();

      expect(config).toEqual({
        useAbacOnly: true,
      });
    });

    test('should return full config with USE_ABAC_ONLY=false', () => {
      process.env.USE_ABAC_ONLY = 'false';

      const config = permissionConfig();

      expect(config).toEqual({
        useAbacOnly: false,
      });
    });
  });
});
