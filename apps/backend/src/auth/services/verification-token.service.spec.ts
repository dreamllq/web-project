import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VerificationToken, VerificationTokenType } from '../../entities/verification-token.entity';
import { VerificationTokenService } from './verification-token.service';

describe('VerificationTokenService', () => {
  let service: VerificationTokenService;

  const mockTokenRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationTokenService,
        {
          provide: getRepositoryToken(VerificationToken),
          useValue: mockTokenRepository,
        },
      ],
    }).compile();

    service = module.get<VerificationTokenService>(VerificationTokenService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateToken', () => {
    it('should generate a token for email verification with 24h expiration', async () => {
      const userId = 'user-uuid-123';
      const mockToken = {
        id: 'token-uuid',
        userId,
        token: 'abc123def456',
        type: VerificationTokenType.EMAIL_VERIFICATION,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        usedAt: null,
        createdAt: new Date(),
      };

      mockTokenRepository.create.mockReturnValue(mockToken);
      mockTokenRepository.save.mockResolvedValue(mockToken);

      const result = await service.generateToken(userId, VerificationTokenType.EMAIL_VERIFICATION);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBe(64); // 32 bytes = 64 hex characters
      expect(mockTokenRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          type: VerificationTokenType.EMAIL_VERIFICATION,
          usedAt: null,
        })
      );
      expect(mockTokenRepository.save).toHaveBeenCalled();
    });

    it('should generate a token for password reset with 30min expiration', async () => {
      const userId = 'user-uuid-123';
      const mockToken = {
        id: 'token-uuid',
        userId,
        token: 'abc123def456',
        type: VerificationTokenType.PASSWORD_RESET,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        usedAt: null,
        createdAt: new Date(),
      };

      mockTokenRepository.create.mockReturnValue(mockToken);
      mockTokenRepository.save.mockResolvedValue(mockToken);

      const result = await service.generateToken(userId, VerificationTokenType.PASSWORD_RESET);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBe(64); // 32 bytes = 64 hex characters
      expect(mockTokenRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          type: VerificationTokenType.PASSWORD_RESET,
          usedAt: null,
        })
      );
    });

    it('should generate unique tokens each time', async () => {
      const userId = 'user-uuid-123';

      mockTokenRepository.create.mockImplementation((data) => data);
      mockTokenRepository.save.mockImplementation((data) => data);

      const token1 = await service.generateToken(userId, VerificationTokenType.EMAIL_VERIFICATION);
      const token2 = await service.generateToken(userId, VerificationTokenType.EMAIL_VERIFICATION);

      expect(token1).not.toBe(token2);
    });
  });

  describe('validateToken', () => {
    it('should return token if valid', async () => {
      const tokenString = 'abc123def456789';
      const mockToken = {
        id: 'token-uuid',
        userId: 'user-uuid',
        token: tokenString,
        type: VerificationTokenType.EMAIL_VERIFICATION,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Future
        usedAt: null,
        createdAt: new Date(),
      };

      mockTokenRepository.findOne.mockResolvedValue(mockToken);

      const result = await service.validateToken(
        tokenString,
        VerificationTokenType.EMAIL_VERIFICATION
      );

      expect(result).toEqual(mockToken);
      expect(mockTokenRepository.findOne).toHaveBeenCalledWith({
        where: { token: tokenString, type: VerificationTokenType.EMAIL_VERIFICATION },
      });
    });

    it('should return null if token not found', async () => {
      mockTokenRepository.findOne.mockResolvedValue(null);

      const result = await service.validateToken(
        'nonexistent',
        VerificationTokenType.EMAIL_VERIFICATION
      );

      expect(result).toBeNull();
    });

    it('should return null if token already used', async () => {
      const mockToken = {
        id: 'token-uuid',
        userId: 'user-uuid',
        token: 'abc123',
        type: VerificationTokenType.EMAIL_VERIFICATION,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        usedAt: new Date(), // Already used
        createdAt: new Date(),
      };

      mockTokenRepository.findOne.mockResolvedValue(mockToken);

      const result = await service.validateToken(
        'abc123',
        VerificationTokenType.EMAIL_VERIFICATION
      );

      expect(result).toBeNull();
    });

    it('should return null if token expired', async () => {
      const mockToken = {
        id: 'token-uuid',
        userId: 'user-uuid',
        token: 'abc123',
        type: VerificationTokenType.EMAIL_VERIFICATION,
        expiresAt: new Date(Date.now() - 1000), // Past
        usedAt: null,
        createdAt: new Date(),
      };

      mockTokenRepository.findOne.mockResolvedValue(mockToken);

      const result = await service.validateToken(
        'abc123',
        VerificationTokenType.EMAIL_VERIFICATION
      );

      expect(result).toBeNull();
    });

    it('should return null if token type does not match', async () => {
      mockTokenRepository.findOne.mockResolvedValue(null); // Type mismatch returns null from query

      const result = await service.validateToken('abc123', VerificationTokenType.PASSWORD_RESET);

      expect(result).toBeNull();
    });
  });

  describe('markAsUsed', () => {
    it('should mark token as used', async () => {
      const tokenId = 'token-uuid';
      mockTokenRepository.update.mockResolvedValue({ affected: 1 });

      await service.markAsUsed(tokenId);

      expect(mockTokenRepository.update).toHaveBeenCalledWith(
        tokenId,
        expect.objectContaining({
          usedAt: expect.any(Date),
        })
      );
    });
  });

  describe('invalidateUserTokens', () => {
    it('should invalidate all unused tokens of a specific type for a user', async () => {
      const userId = 'user-uuid';
      mockTokenRepository.update.mockResolvedValue({ affected: 3 });

      await service.invalidateUserTokens(userId, VerificationTokenType.EMAIL_VERIFICATION);

      expect(mockTokenRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          type: VerificationTokenType.EMAIL_VERIFICATION,
          usedAt: null,
        }),
        expect.objectContaining({
          usedAt: expect.any(Date),
        })
      );
    });

    it('should handle case where no tokens to invalidate', async () => {
      const userId = 'user-uuid';
      mockTokenRepository.update.mockResolvedValue({ affected: 0 });

      await service.invalidateUserTokens(userId, VerificationTokenType.PASSWORD_RESET);

      expect(mockTokenRepository.update).toHaveBeenCalled();
    });
  });

  describe('findActiveToken', () => {
    it('should return active token for user', async () => {
      const userId = 'user-uuid';
      const mockToken = {
        id: 'token-uuid',
        userId,
        token: 'abc123',
        type: VerificationTokenType.EMAIL_VERIFICATION,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Future
        usedAt: null,
        createdAt: new Date(),
      };

      mockTokenRepository.findOne.mockResolvedValue(mockToken);

      const result = await service.findActiveToken(
        userId,
        VerificationTokenType.EMAIL_VERIFICATION
      );

      expect(result).toEqual(mockToken);
      expect(mockTokenRepository.findOne).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId,
          type: VerificationTokenType.EMAIL_VERIFICATION,
        }),
        order: { createdAt: 'DESC' },
      });
    });

    it('should return null if no active token found', async () => {
      mockTokenRepository.findOne.mockResolvedValue(null);

      const result = await service.findActiveToken(
        'user-uuid',
        VerificationTokenType.EMAIL_VERIFICATION
      );

      expect(result).toBeNull();
    });

    it('should return null if token is expired', async () => {
      const mockToken = {
        id: 'token-uuid',
        userId: 'user-uuid',
        token: 'abc123',
        type: VerificationTokenType.EMAIL_VERIFICATION,
        expiresAt: new Date(Date.now() - 1000), // Past
        usedAt: null,
        createdAt: new Date(),
      };

      mockTokenRepository.findOne.mockResolvedValue(mockToken);

      const result = await service.findActiveToken(
        'user-uuid',
        VerificationTokenType.EMAIL_VERIFICATION
      );

      expect(result).toBeNull();
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should delete expired tokens and return count', async () => {
      const mockQueryBuilder = {
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 5 }),
      };

      mockTokenRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.cleanupExpiredTokens();

      expect(result).toBe(5);
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('expiresAt < :now', {
        now: expect.any(Date),
      });
    });

    it('should return 0 when no tokens to cleanup', async () => {
      const mockQueryBuilder = {
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };

      mockTokenRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.cleanupExpiredTokens();

      expect(result).toBe(0);
    });
  });
});
