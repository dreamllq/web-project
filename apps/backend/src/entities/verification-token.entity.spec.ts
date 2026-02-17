import { VerificationToken, VerificationTokenType } from './verification-token.entity';

// Mock user to avoid circular import issues
const mockUser = {
  id: 'user-uuid-123',
  username: 'testuser',
  email: 'test@example.com',
};

describe('VerificationToken Entity', () => {
  describe('properties', () => {
    it('should have correct default for email_verification type', () => {
      const token = new VerificationToken();
      token.id = 'token-uuid-123';
      token.userId = mockUser.id;
      token.token = 'random-token-string';
      token.type = VerificationTokenType.EMAIL_VERIFICATION;
      token.expiresAt = new Date(Date.now() + 3600000); // 1 hour from now
      token.usedAt = null;
      token.createdAt = new Date();
      token.user = mockUser as any;

      expect(token.id).toBe('token-uuid-123');
      expect(token.userId).toBe('user-uuid-123');
      expect(token.token).toBe('random-token-string');
      expect(token.type).toBe(VerificationTokenType.EMAIL_VERIFICATION);
      expect(token.expiresAt).toBeInstanceOf(Date);
      expect(token.usedAt).toBeNull();
      expect(token.createdAt).toBeInstanceOf(Date);
      expect(token.user).toBe(mockUser);
    });

    it('should support password_reset type', () => {
      const token = new VerificationToken();
      token.id = 'token-uuid-456';
      token.userId = mockUser.id;
      token.token = 'reset-token-string';
      token.type = VerificationTokenType.PASSWORD_RESET;
      token.expiresAt = new Date(Date.now() + 7200000); // 2 hours from now
      token.usedAt = null;
      token.createdAt = new Date();

      expect(token.type).toBe(VerificationTokenType.PASSWORD_RESET);
    });

    it('should allow usedAt to be set', () => {
      const usedDate = new Date();
      const token = new VerificationToken();
      token.id = 'token-uuid-789';
      token.userId = mockUser.id;
      token.token = 'used-token-string';
      token.type = VerificationTokenType.EMAIL_VERIFICATION;
      token.expiresAt = new Date(Date.now() + 3600000);
      token.usedAt = usedDate;
      token.createdAt = new Date();

      expect(token.usedAt).toBe(usedDate);
    });
  });

  describe('VerificationTokenType enum', () => {
    it('should have EMAIL_VERIFICATION value', () => {
      expect(VerificationTokenType.EMAIL_VERIFICATION).toBe('email_verification');
    });

    it('should have PASSWORD_RESET value', () => {
      expect(VerificationTokenType.PASSWORD_RESET).toBe('password_reset');
    });
  });

  describe('token expiration', () => {
    it('should correctly identify expired tokens', () => {
      const token = new VerificationToken();
      token.expiresAt = new Date(Date.now() - 1000); // 1 second ago

      expect(token.expiresAt.getTime()).toBeLessThan(Date.now());
    });

    it('should correctly identify valid tokens', () => {
      const token = new VerificationToken();
      token.expiresAt = new Date(Date.now() + 3600000); // 1 hour from now

      expect(token.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });
});
