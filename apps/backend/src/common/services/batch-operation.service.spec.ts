import { Test, TestingModule } from '@nestjs/testing';
import { mock, describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { BadRequestException } from '@nestjs/common';
import { BatchOperationService } from './batch-operation.service';
import { UsersService } from '../../users/users.service';
import { SocialAccountStatus } from '../../entities/social-account.entity';

describe('BatchOperationService', () => {
  let service: BatchOperationService;
  let mockUsersService: any;
  let mockSocialAccountRepository: any;

  beforeEach(async () => {
    mockUsersService = {
      findById: mock(),
    };

    mockSocialAccountRepository = {
      count: mock(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BatchOperationService,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: 'SocialAccountRepository',
          useValue: mockSocialAccountRepository,
        },
      ],
    }).compile();

    service = module.get<BatchOperationService>(BatchOperationService);
  });

  afterEach(() => {
    mockUsersService.findById.mockClear();
    mockSocialAccountRepository.count.mockClear();
  });

  describe('validateBatchSize', () => {
    it('should not throw if batch size is within limit', () => {
      const ids = ['id1', 'id2', 'id3'];
      expect(() => service.validateBatchSize(ids, 5)).not.toThrow();
    });

    it('should not throw if batch size equals limit', () => {
      const ids = ['id1', 'id2', 'id3', 'id4', 'id5'];
      expect(() => service.validateBatchSize(ids, 5)).not.toThrow();
    });

    it('should throw BadRequestException if batch size exceeds limit', () => {
      const ids = ['id1', 'id2', 'id3', 'id4', 'id5', 'id6'];
      expect(() => service.validateBatchSize(ids, 5)).toThrow(BadRequestException);
    });

    it('should throw with correct error message when batch size exceeds limit', () => {
      const ids = ['id1', 'id2', 'id3', 'id4', 'id5', 'id6'];
      try {
        service.validateBatchSize(ids, 5);
        fail('Expected BadRequestException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).message).toBe('Batch size exceeds maximum of 5');
      }
    });

    it('should allow empty array', () => {
      const ids: string[] = [];
      expect(() => service.validateBatchSize(ids, 5)).not.toThrow();
    });

    it('should allow single item', () => {
      const ids = ['id1'];
      expect(() => service.validateBatchSize(ids, 5)).not.toThrow();
    });
  });

  describe('processBatch', () => {
    it('should process all items successfully', async () => {
      const ids = ['id1', 'id2', 'id3'];
      const processor = mock(async (id: string) => ({ id, processed: true }));

      const result = await service.processBatch(ids, processor);

      expect(result.success).toEqual(['id1', 'id2', 'id3']);
      expect(result.failed).toEqual([]);
      expect(result.errors).toEqual([]);
      expect(processor).toHaveBeenCalledTimes(3);
    });

    it('should continue processing after failure', async () => {
      const ids = ['id1', 'id2', 'id3'];
      const processor = mock(async (id: string) => {
        if (id === 'id2') {
          throw new Error('Failed to process id2');
        }
        return { id, processed: true };
      });

      const result = await service.processBatch(ids, processor);

      expect(result.success).toEqual(['id1', 'id3']);
      expect(result.failed).toEqual(['id2']);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to process id2');
      expect(processor).toHaveBeenCalledTimes(3);
    });

    it('should handle all failures', async () => {
      const ids = ['id1', 'id2', 'id3'];
      const processor = mock(async () => {
        throw new Error('All failed');
      });

      const result = await service.processBatch(ids, processor);

      expect(result.success).toEqual([]);
      expect(result.failed).toEqual(['id1', 'id2', 'id3']);
      expect(result.errors).toHaveLength(3);
      expect(processor).toHaveBeenCalledTimes(3);
    });

    it('should handle empty array', async () => {
      const ids: string[] = [];
      const processor = mock(async (id: string) => ({ id }));

      const result = await service.processBatch(ids, processor);

      expect(result.success).toEqual([]);
      expect(result.failed).toEqual([]);
      expect(result.errors).toEqual([]);
      expect(processor).not.toHaveBeenCalled();
    });

    it('should include error message from exception', async () => {
      const ids = ['id1'];
      const processor = mock(async () => {
        throw new Error('Custom error message');
      });

      const result = await service.processBatch(ids, processor);

      expect(result.errors[0]).toBe('Failed to process id1: Custom error message');
    });

    it('should return BatchOperationResult with correct structure', async () => {
      const ids = ['id1'];
      const processor = mock(async (id: string) => ({ id }));

      const result = await service.processBatch(ids, processor);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('failed');
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.success)).toBe(true);
      expect(Array.isArray(result.failed)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });

  describe('checkUserAuthenticationMethods', () => {
    it('should return true if user has password', async () => {
      mockUsersService.findById.mockResolvedValue({
        id: 'user1',
        passwordHash: 'hashed_password',
      });

      const result = await service.checkUserAuthenticationMethods('user1');

      expect(result).toBe(true);
      expect(mockUsersService.findById).toHaveBeenCalledWith('user1');
    });

    it('should return true if user has social accounts', async () => {
      mockUsersService.findById.mockResolvedValue({
        id: 'user1',
        passwordHash: null,
      });
      mockSocialAccountRepository.count.mockResolvedValue(2);

      const result = await service.checkUserAuthenticationMethods('user1');

      expect(result).toBe(true);
      expect(mockSocialAccountRepository.count).toHaveBeenCalledWith({
        where: { userId: 'user1', status: SocialAccountStatus.LINKED },
      });
    });

    it('should return false if user has neither password nor social accounts', async () => {
      mockUsersService.findById.mockResolvedValue({
        id: 'user1',
        passwordHash: null,
      });
      mockSocialAccountRepository.count.mockResolvedValue(0);

      const result = await service.checkUserAuthenticationMethods('user1');

      expect(result).toBe(false);
    });

    it('should return false if user not found', async () => {
      mockUsersService.findById.mockResolvedValue(null);

      const result = await service.checkUserAuthenticationMethods('nonexistent');

      expect(result).toBe(false);
      expect(mockSocialAccountRepository.count).not.toHaveBeenCalled();
    });

    it('should not check social accounts if user has password', async () => {
      mockUsersService.findById.mockResolvedValue({
        id: 'user1',
        passwordHash: 'hashed_password',
      });

      await service.checkUserAuthenticationMethods('user1');

      expect(mockSocialAccountRepository.count).not.toHaveBeenCalled();
    });

    it('should only count linked social accounts', async () => {
      mockUsersService.findById.mockResolvedValue({
        id: 'user1',
        passwordHash: null,
      });
      mockSocialAccountRepository.count.mockResolvedValue(1);

      await service.checkUserAuthenticationMethods('user1');

      expect(mockSocialAccountRepository.count).toHaveBeenCalledWith({
        where: {
          userId: 'user1',
          status: SocialAccountStatus.LINKED,
        },
      });
    });
  });
});
