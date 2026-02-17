import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mailConfig } from './mail.config';

describe('mailConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('default values', () => {
    test('should return default values when env vars are not set', () => {
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;
      delete process.env.SMTP_SECURE;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
      delete process.env.SMTP_FROM;

      const config = mailConfig();

      expect(config.host).toBe('localhost');
      expect(config.port).toBe(587);
      expect(config.secure).toBe(false);
      expect(config.auth.user).toBe('');
      expect(config.auth.pass).toBe('');
      expect(config.from).toBe('noreply@example.com');
    });
  });

  describe('environment variable parsing', () => {
    test('should parse SMTP_HOST', () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      const config = mailConfig();
      expect(config.host).toBe('smtp.example.com');
    });

    test('should parse SMTP_PORT as number', () => {
      process.env.SMTP_PORT = '465';
      const config = mailConfig();
      expect(config.port).toBe(465);
    });

    test('should parse SMTP_SECURE as boolean true', () => {
      process.env.SMTP_SECURE = 'true';
      const config = mailConfig();
      expect(config.secure).toBe(true);
    });

    test('should parse SMTP_SECURE as boolean false', () => {
      process.env.SMTP_SECURE = 'false';
      const config = mailConfig();
      expect(config.secure).toBe(false);
    });

    test('should parse auth credentials', () => {
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'secret123';
      const config = mailConfig();
      expect(config.auth.user).toBe('user@example.com');
      expect(config.auth.pass).toBe('secret123');
    });

    test('should parse SMTP_FROM', () => {
      process.env.SMTP_FROM = 'noreply@myapp.com';
      const config = mailConfig();
      expect(config.from).toBe('noreply@myapp.com');
    });
  });

  describe('full configuration', () => {
    test('should return full config with all env vars set', () => {
      process.env.SMTP_HOST = 'smtp.sendgrid.net';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_SECURE = 'false';
      process.env.SMTP_USER = 'apikey';
      process.env.SMTP_PASS = 'sg-api-key-123';
      process.env.SMTP_FROM = 'notifications@myapp.com';

      const config = mailConfig();

      expect(config).toEqual({
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        auth: {
          user: 'apikey',
          pass: 'sg-api-key-123',
        },
        from: 'notifications@myapp.com',
      });
    });
  });
});
