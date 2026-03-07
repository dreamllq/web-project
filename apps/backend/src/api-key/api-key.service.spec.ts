import { Test, TestingModule } from '@nestjs/testing';
import { mock, describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ApiKeyService } from './api-key.service';
import { ApiKey } from '../entities/api-key.entity';
import { getRepositoryToken } from '@nestjs/typeorm';

mock.module('bcrypt', () => ({
  hash: mock(async (plain: string) => `hashed_${plain}`),
  compare: mock(async (plain: string, hashed: string) => hashed === `hashed_${plain}`),
}));

describe('ApiKeyService', () => {
  let service: ApiKeyService;

  const mockRepository = {
    create: mock(),
    save: mock(),
    find: mock(),
    findOne: mock(),
    update: mock(),
    delete: mock(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyService,
        {
          provide: getRepositoryToken(ApiKey),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ApiKeyService>(ApiKeyService);
  });

  afterEach(() => {
    mockRepository.create.mockClear();
    mockRepository.save.mockClear();
    mockRepository.find.mockClear();
    mockRepository.findOne.mockClear();
    mockRepository.update.mockClear();
    mockRepository.delete.mockClear();
  });

  describe('create', () => {
    it('should create a new API key with hashed key', async () => {
      const data = {
        name: 'Test Key',
        userId: 'user-123',
        scopes: ['read', 'write'],
      };

      const mockApiKey = {
        id: 'key-123',
        ...data,
        key: 'hashed_test_key',
        scopes: data.scopes,
        expiresAt: null,
        lastUsedAt: null,
        createdAt: new Date(),
        revokedAt: null,
      };

      mockRepository.create.mockReturnValue(mockApiKey);
      mockRepository.save.mockResolvedValue(mockApiKey);

      const result = await service.create(data);

      expect(result.plainKey).toBeDefined();
      expect(result.plainKey.length).toBe(64);
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should create API key with expiration date', async () => {
      const expiresAt = new Date('2025-12-31');
      const data = {
        name: 'Test Key',
        userId: 'user-123',
        expiresAt,
      };

      const mockApiKey = {
        id: 'key-123',
        ...data,
        key: 'hashed_test_key',
        scopes: null,
        lastUsedAt: null,
        createdAt: new Date(),
        revokedAt: null,
      };

      mockRepository.create.mockReturnValue(mockApiKey);
      mockRepository.save.mockResolvedValue(mockApiKey);

      const result = await service.create(data);

      expect(result.apiKey.expiresAt).toEqual(expiresAt);
    });
  });

  describe('findByKey', () => {
    it('should find API key by plain key', async () => {
      const plainKey = 'test_plain_key';
      const mockApiKey = {
        id: 'key-123',
        key: `hashed_${plainKey}`,
        name: 'Test Key',
        userId: 'user-123',
        user: { id: 'user-123', username: 'testuser' },
      };

      mockRepository.find.mockResolvedValue([mockApiKey]);

      const result = await service.findByKey(plainKey);

      expect(result).toBeDefined();
      expect(result?.id).toBe('key-123');
    });

    it('should return null if key not found', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.findByKey('nonexistent_key');

      expect(result).toBeNull();
    });
  });

  describe('findByUser', () => {
    it('should return all API keys for a user', async () => {
      const userId = 'user-123';
      const mockApiKeys = [
        { id: 'key-1', userId, name: 'Key 1' },
        { id: 'key-2', userId, name: 'Key 2' },
      ];

      mockRepository.find.mockResolvedValue(mockApiKeys);

      const result = await service.findByUser(userId);

      expect(result).toHaveLength(2);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { userId },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('revoke', () => {
    it('should revoke an API key', async () => {
      const keyId = 'key-123';
      const mockApiKey = {
        id: keyId,
        revokedAt: null,
      };

      mockRepository.findOne.mockResolvedValue(mockApiKey);
      mockRepository.update.mockResolvedValue({ affected: 1 });

      await service.revoke(keyId);

      expect(mockRepository.update).toHaveBeenCalledWith(keyId, { revokedAt: expect.any(Date) });
    });

    it('should throw NotFoundException if key not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.revoke('nonexistent')).rejects.toThrow('API key not found');
    });
  });

  describe('updateLastUsed', () => {
    it('should update last used timestamp', async () => {
      const keyId = 'key-123';
      mockRepository.update.mockResolvedValue({ affected: 1 });

      await service.updateLastUsed(keyId);

      expect(mockRepository.update).toHaveBeenCalledWith(keyId, { lastUsedAt: expect.any(Date) });
    });
  });

  describe('delete', () => {
    it('should delete an API key', async () => {
      const keyId = 'key-123';
      const mockApiKey = { id: keyId };

      mockRepository.findOne.mockResolvedValue(mockApiKey);
      mockRepository.delete.mockResolvedValue({ affected: 1 });

      await service.delete(keyId);

      expect(mockRepository.delete).toHaveBeenCalledWith(keyId);
    });

    it('should throw NotFoundException if key not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.delete('nonexistent')).rejects.toThrow('API key not found');
    });
  });

  describe('findById', () => {
    it('should find API key by ID', async () => {
      const keyId = 'key-123';
      const mockApiKey = { id: keyId, name: 'Test Key' };

      mockRepository.findOne.mockResolvedValue(mockApiKey);

      const result = await service.findById(keyId);

      expect(result).toEqual(mockApiKey);
    });

    it('should return null if key not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });
  });
});
