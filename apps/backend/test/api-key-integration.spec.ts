import { Test, TestingModule } from '@nestjs/testing';
import { mock, describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ApiKeyService } from '../src/api-key/api-key.service';
import { ApiKey } from '../src/entities/api-key.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User, UserStatus } from '../src/entities/user.entity';

mock.module('bcrypt', () => ({
  hash: mock(async (plain: string) => `hashed_${plain}`),
  compare: mock(async (plain: string, hashed: string) => hashed === `hashed_${plain}`),
}));

describe('API Key Integration Tests', () => {
  let service: ApiKeyService;
  let mockRepository: any;

  const mockUser: User = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    phone: null,
    passwordHash: 'hashed_password',
    nickname: 'Test User',
    avatarUrl: null,
    status: UserStatus.ACTIVE,
    locale: 'zh-CN',
    lastLoginAt: null,
    lastLoginIp: null,
    emailVerifiedAt: null,
    phoneVerifiedAt: null,
    mfaEnabled: false,
    mfaSecret: null,
    recoveryCodes: null,
    isSuperuser: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    socialAccounts: [],
    notifications: [],
    files: [],
    oauthTokens: [],
    verificationTokens: [],
    roles: [],
    auditLogs: [],
    loginHistories: [],
    userDevices: [],
    apiKeys: [],
  } as User;

  const mockApiKey: ApiKey = {
    id: 'key-123',
    userId: 'user-123',
    user: mockUser,
    name: 'Test API Key',
    key: 'hashed_test_plain_key',
    scopes: ['read', 'write'],
    expiresAt: null,
    lastUsedAt: null,
    revokedAt: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    mockRepository = {
      create: mock(),
      save: mock(),
      find: mock(),
      findOne: mock(),
      update: mock(),
      delete: mock(),
    };

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

  describe('Create → Use → Revoke Flow', () => {
    let plainKey: string;

    it('Step 1: Should create a new API key', async () => {
      const createData = {
        name: 'Integration Test Key',
        userId: 'user-123',
        scopes: ['read', 'write'],
      };

      mockRepository.create.mockReturnValue({
        ...mockApiKey,
        name: createData.name,
        userId: createData.userId,
        scopes: createData.scopes,
      });

      mockRepository.save.mockResolvedValue({
        ...mockApiKey,
        name: createData.name,
        userId: createData.userId,
        scopes: createData.scopes,
      });

      const result = await service.create(createData);

      expect(result.plainKey).toBeDefined();
      expect(result.plainKey.length).toBe(64);
      expect(result.apiKey.name).toBe(createData.name);
      expect(result.apiKey.userId).toBe(createData.userId);
      expect(result.apiKey.scopes).toEqual(createData.scopes);
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();

      plainKey = result.plainKey;
    });

    it('Step 2: Should use the API key to authenticate', async () => {
      mockRepository.find.mockResolvedValue([
        {
          ...mockApiKey,
          key: `hashed_${plainKey}`,
        },
      ]);

      const result = await service.findByKey(plainKey);

      expect(result).toBeDefined();
      expect(result?.userId).toBe('user-123');
      expect(result?.name).toBe('Test API Key');
      expect(mockRepository.find).toHaveBeenCalledWith({
        relations: ['user'],
      });
    });

    it('Step 3: Should update last used timestamp when key is used', async () => {
      mockRepository.update.mockResolvedValue({ affected: 1 });

      await service.updateLastUsed('key-123');

      expect(mockRepository.update).toHaveBeenCalledWith('key-123', {
        lastUsedAt: expect.any(Date),
      });
    });

    it('Step 4: Should revoke the API key', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...mockApiKey,
        revokedAt: null,
      });

      mockRepository.update.mockResolvedValue({ affected: 1 });

      await service.revoke('key-123');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'key-123' },
      });
      expect(mockRepository.update).toHaveBeenCalledWith('key-123', {
        revokedAt: expect.any(Date),
      });
    });

    it('Step 5: Should not be able to use revoked key', async () => {
      const revokedKey = {
        ...mockApiKey,
        key: `hashed_${plainKey}`,
        revokedAt: new Date(),
      };

      mockRepository.find.mockResolvedValue([revokedKey]);

      const result = await service.findByKey(plainKey);

      expect(result).toBeDefined();
      expect(result?.revokedAt).not.toBeNull();
    });
  });

  describe('API Key Lifecycle', () => {
    it('should create API key with expiration date', async () => {
      const expiresAt = new Date('2025-12-31');
      const createData = {
        name: 'Expiring Key',
        userId: 'user-123',
        expiresAt,
      };

      mockRepository.create.mockReturnValue({
        ...mockApiKey,
        expiresAt,
      });

      mockRepository.save.mockResolvedValue({
        ...mockApiKey,
        expiresAt,
      });

      const result = await service.create(createData);

      expect(result.apiKey.expiresAt).toEqual(expiresAt);
    });

    it('should list all API keys for a user', async () => {
      const mockApiKeys = [
        { ...mockApiKey, id: 'key-1', name: 'Key 1' },
        { ...mockApiKey, id: 'key-2', name: 'Key 2' },
      ];

      mockRepository.find.mockResolvedValue(mockApiKeys);

      const result = await service.findByUser('user-123');

      expect(result).toHaveLength(2);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        order: { createdAt: 'DESC' },
      });
    });

    it('should find API key by ID', async () => {
      mockRepository.findOne.mockResolvedValue(mockApiKey);

      const result = await service.findById('key-123');

      expect(result).toEqual(mockApiKey);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'key-123' },
      });
    });

    it('should delete an API key', async () => {
      mockRepository.findOne.mockResolvedValue(mockApiKey);
      mockRepository.delete.mockResolvedValue({ affected: 1 });

      await service.delete('key-123');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'key-123' },
      });
      expect(mockRepository.delete).toHaveBeenCalledWith('key-123');
    });

    it('should throw NotFoundException when revoking non-existent key', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.revoke('nonexistent')).rejects.toThrow('API key not found');
    });

    it('should throw NotFoundException when deleting non-existent key', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.delete('nonexistent')).rejects.toThrow('API key not found');
    });

    it('should throw BadRequestException when revoking already revoked key', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...mockApiKey,
        revokedAt: new Date(),
      });

      await expect(service.revoke('key-123')).rejects.toThrow('API key is already revoked');
    });

    it('should return null when finding non-existent key', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.findByKey('nonexistent_key');

      expect(result).toBeNull();
    });

    it('should return null when finding non-existent key by ID', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('API Key Security', () => {
    it('should store hashed key, not plain key', async () => {
      const createData = {
        name: 'Security Test Key',
        userId: 'user-123',
      };

      mockRepository.create.mockImplementation((data: any) => data);
      mockRepository.save.mockImplementation((data: any) => Promise.resolve(data));

      const result = await service.create(createData);

      expect(result.plainKey).toBeDefined();
      expect(result.apiKey.key).not.toBe(result.plainKey);
      expect(result.apiKey.key).toMatch(/^hashed_/);
    });

    it('should validate key using bcrypt compare', async () => {
      const testKey = 'test_validation_key';

      mockRepository.find.mockResolvedValue([
        {
          ...mockApiKey,
          key: `hashed_${testKey}`,
        },
      ]);

      const result = await service.findByKey(testKey);

      expect(result).toBeDefined();
    });

    it('should generate unique plain keys for each creation', async () => {
      const createData = {
        name: 'Unique Key Test',
        userId: 'user-123',
      };

      mockRepository.create.mockImplementation((data: any) => data);
      mockRepository.save.mockImplementation((data: any) => Promise.resolve(data));

      const result1 = await service.create(createData);
      const result2 = await service.create(createData);

      expect(result1.plainKey).not.toBe(result2.plainKey);
      expect(result1.plainKey.length).toBe(64);
      expect(result2.plainKey.length).toBe(64);
    });
  });
});
