import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { mock, describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { BadRequestException } from '@nestjs/common';
import { OAuthClientService } from './oauth-client.service';
import { OAuthClient } from '../entities/oauth-client.entity';
import { CustomCacheService } from '../custom-cache/custom-cache.service';
import { OAuthTokenService } from './oauth-token.service';
import { OAuthSecretEncryptionService } from './oauth-secret-encryption.service';

describe('OAuthClientService', () => {
  let service: OAuthClientService;
  let mockClientRepository: any;
  let mockCacheService: any;
  let mockTokenService: any;
  let mockEncryptionService: any;

  const mockClient: OAuthClient = {
    id: 'test-id',
    clientId: 'client_test123',
    clientSecret: 'secret123',
    name: 'Test Client',
    redirectUris: ['http://localhost:3000/callback'],
    allowedScopes: ['openid', 'profile'],
    isConfidential: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    tokens: [],
  };

  beforeEach(async () => {
    mockClientRepository = {
      createQueryBuilder: mock(() => ({
        andWhere: mock().mockReturnThis(),
        orderBy: mock().mockReturnThis(),
        getCount: mock().mockResolvedValue(1),
        skip: mock().mockReturnThis(),
        take: mock().mockReturnThis(),
        getMany: mock().mockResolvedValue([mockClient]),
      })),
      findOne: mock().mockResolvedValue(mockClient),
      create: mock().mockReturnValue(mockClient),
      save: mock().mockResolvedValue(mockClient),
      update: mock().mockResolvedValue(undefined),
      delete: mock().mockResolvedValue(undefined),
    };

    mockCacheService = {
      del: mock().mockResolvedValue(undefined),
    };

    mockTokenService = {
      countByClientId: mock().mockResolvedValue(0),
    };

    mockEncryptionService = {
      encrypt: mock((text: string) => `encrypted_${text}`),
      decrypt: mock((text: string) => text.replace('encrypted_', '')),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthClientService,
        {
          provide: getRepositoryToken(OAuthClient),
          useValue: mockClientRepository,
        },
        {
          provide: CustomCacheService,
          useValue: mockCacheService,
        },
        {
          provide: OAuthTokenService,
          useValue: mockTokenService,
        },
        {
          provide: OAuthSecretEncryptionService,
          useValue: mockEncryptionService,
        },
      ],
    }).compile();

    service = module.get<OAuthClientService>(OAuthClientService);
  });

  afterEach(() => {
    mockClientRepository.findOne.mockClear();
    mockClientRepository.createQueryBuilder.mockClear();
  });

  it('should list clients with pagination', async () => {
    const result = await service.list({ limit: 10, offset: 0 });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('should find client by id', async () => {
    const result = await service.findById('test-id');

    expect(result).toEqual(mockClient);
  });

  it('should create new client', async () => {
    const dto = {
      name: 'New Client',
      redirectUris: ['http://localhost:3000/callback'],
    };

    await service.create(dto);

    expect(mockClientRepository.create).toHaveBeenCalled();
    expect(mockClientRepository.save).toHaveBeenCalled();
  });

  it('should update client', async () => {
    const dto = {
      name: 'Updated Client',
    };

    await service.update('test-id', dto);

    expect(mockClientRepository.update).toHaveBeenCalled();
    expect(mockCacheService.del).toHaveBeenCalled();
  });

  it('should delete client', async () => {
    await service.delete('test-id');

    expect(mockClientRepository.delete).toHaveBeenCalled();
    expect(mockCacheService.del).toHaveBeenCalled();
  });

  it('should regenerate client secret', async () => {
    await service.regenerateSecret('test-id');

    expect(mockClientRepository.update).toHaveBeenCalled();
    expect(mockCacheService.del).toHaveBeenCalled();
  });

  it('should throw BadRequestException when deleting client with active tokens', async () => {
    mockTokenService.countByClientId.mockResolvedValue(5);

    await expect(service.delete('test-id')).rejects.toThrow(BadRequestException);
    await expect(service.delete('test-id')).rejects.toThrow(
      'Cannot delete client with 5 active tokens. Revoke tokens first or use force delete.'
    );
  });

  it('should delete client when no tokens exist', async () => {
    mockTokenService.countByClientId.mockResolvedValueOnce(0);

    await service.delete('test-id');

    expect(mockClientRepository.delete).toHaveBeenCalled();
    expect(mockCacheService.del).toHaveBeenCalled();
  });

  it('should mask clientSecret in toResponse', () => {
    const clientWithSecret = {
      ...mockClient,
      clientSecret: 'encrypted_secret123',
    };

    const response = service.toResponse(clientWithSecret);

    expect(response.clientSecret).toBe('••••••••');
  });

  it('should return plain secret when creating client', async () => {
    const dto = {
      name: 'New Client',
      redirectUris: ['http://localhost:3000/callback'],
    };

    const result = await service.create(dto);

    expect(result.clientSecret).not.toContain('encrypted_');
    expect(mockEncryptionService.encrypt).toHaveBeenCalled();
  });

  it('should return plain secret when regenerating secret', async () => {
    mockClientRepository.findOne.mockResolvedValueOnce({
      ...mockClient,
      clientSecret: 'encrypted_old_secret',
    });

    const result = await service.regenerateSecret('test-id');

    expect(result.clientSecret).not.toContain('encrypted_');
    expect(mockEncryptionService.encrypt).toHaveBeenCalled();
    expect(mockClientRepository.update).toHaveBeenCalled();
  });
});
