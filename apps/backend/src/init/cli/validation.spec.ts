import {
  validatePassword,
  validateUsername,
  validateDatabaseUrl,
  validateRedisHost,
  validatePort,
  validatePasswordConfirmation,
} from './validation';

describe('validation', () => {
  describe('validatePassword', () => {
    it('should reject empty password', () => {
      const result = validatePassword('');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('空');
    });

    it('should reject password shorter than 8 characters', () => {
      const result = validatePassword('Abc123');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('8');
    });

    it('should reject password without uppercase letter', () => {
      const result = validatePassword('abcdefgh123');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('大写');
    });

    it('should reject password without lowercase letter', () => {
      const result = validatePassword('ABCDEFGH123');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('小写');
    });

    it('should reject password without number', () => {
      const result = validatePassword('Abcdefgh');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('数字');
    });

    it('should accept valid password with all requirements', () => {
      const result = validatePassword('Password123');
      expect(result.valid).toBe(true);
    });

    it('should accept password with special characters', () => {
      const result = validatePassword('P@ssw0rd!test');
      expect(result.valid).toBe(true);
    });

    it('should accept exactly 8 character password meeting all criteria', () => {
      const result = validatePassword('Abcdef12');
      expect(result.valid).toBe(true);
    });
  });

  describe('validateUsername', () => {
    it('should reject empty username', () => {
      const result = validateUsername('');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('空');
    });

    it('should reject username shorter than 3 characters', () => {
      const result = validateUsername('ab');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('3');
    });

    it('should reject username longer than 32 characters', () => {
      const result = validateUsername('a'.repeat(33));
      expect(result.valid).toBe(false);
      expect(result.message).toContain('32');
    });

    it('should reject username starting with number', () => {
      const result = validateUsername('123user');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('字母或下划线');
    });

    it('should reject username with special characters', () => {
      const result = validateUsername('user@test');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('字母、数字和下划线');
    });

    it('should reject username with spaces', () => {
      const result = validateUsername('user name');
      expect(result.valid).toBe(false);
    });

    it('should accept valid alphanumeric username', () => {
      const result = validateUsername('admin');
      expect(result.valid).toBe(true);
    });

    it('should accept username with underscore', () => {
      const result = validateUsername('admin_user');
      expect(result.valid).toBe(true);
    });

    it('should accept username starting with underscore', () => {
      const result = validateUsername('_admin');
      expect(result.valid).toBe(true);
    });

    it('should accept username with numbers after first character', () => {
      const result = validateUsername('user123');
      expect(result.valid).toBe(true);
    });

    it('should accept exactly 3 character username', () => {
      const result = validateUsername('abc');
      expect(result.valid).toBe(true);
    });

    it('should accept exactly 32 character username', () => {
      const result = validateUsername('a'.repeat(32));
      expect(result.valid).toBe(true);
    });
  });

  describe('validateDatabaseUrl', () => {
    it('should reject empty URL', () => {
      const result = validateDatabaseUrl('');
      expect(result.valid).toBe(false);
    });

    it('should reject URL without postgresql protocol', () => {
      const result = validateDatabaseUrl('mysql://localhost:3306/db');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('postgresql');
    });

    it('should accept postgresql:// URL', () => {
      const result = validateDatabaseUrl('postgresql://user:pass@localhost:5432/db');
      expect(result.valid).toBe(true);
    });

    it('should accept postgres:// URL', () => {
      const result = validateDatabaseUrl('postgres://user:pass@localhost:5432/db');
      expect(result.valid).toBe(true);
    });

    it('should accept Neon database URL', () => {
      const result = validateDatabaseUrl(
        'postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/db?sslmode=require'
      );
      expect(result.valid).toBe(true);
    });
  });

  describe('validateRedisHost', () => {
    it('should reject empty host', () => {
      const result = validateRedisHost('');
      expect(result.valid).toBe(false);
    });

    it('should accept localhost', () => {
      const result = validateRedisHost('localhost');
      expect(result.valid).toBe(true);
    });

    it('should accept IP address', () => {
      const result = validateRedisHost('127.0.0.1');
      expect(result.valid).toBe(true);
    });

    it('should accept domain name', () => {
      const result = validateRedisHost('redis.example.com');
      expect(result.valid).toBe(true);
    });
  });

  describe('validatePort', () => {
    it('should reject empty port', () => {
      const result = validatePort('');
      expect(result.valid).toBe(false);
    });

    it('should reject non-numeric port', () => {
      const result = validatePort('abc');
      expect(result.valid).toBe(false);
    });

    it('should reject port below 1', () => {
      const result = validatePort('0');
      expect(result.valid).toBe(false);
    });

    it('should reject port above 65535', () => {
      const result = validatePort('65536');
      expect(result.valid).toBe(false);
    });

    it('should accept valid port', () => {
      const result = validatePort('6379');
      expect(result.valid).toBe(true);
    });

    it('should accept port 5432', () => {
      const result = validatePort('5432');
      expect(result.valid).toBe(true);
    });

    it('should accept port 1', () => {
      const result = validatePort('1');
      expect(result.valid).toBe(true);
    });

    it('should accept port 65535', () => {
      const result = validatePort('65535');
      expect(result.valid).toBe(true);
    });
  });

  describe('validatePasswordConfirmation', () => {
    it('should reject mismatched passwords', () => {
      const result = validatePasswordConfirmation('Password123', 'Password456');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('不一致');
    });

    it('should accept matching passwords', () => {
      const result = validatePasswordConfirmation('Password123', 'Password123');
      expect(result.valid).toBe(true);
    });
  });
});
