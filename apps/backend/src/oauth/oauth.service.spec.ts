import { Test, TestingModule } from '@nestjs/testing';
import { mock, describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { OAuthService } from './oauth.service';
import { OAuthClient } from '../entities/oauth-client.entity';
import { OAuthToken } from '../entities/oauth-token.entity';
import { CustomCacheService } from '../custom-cache/custom-cache.service';
import { UsersService } from '../users/users.service';
import { CacheKeyPrefix, CacheTTL } from '../custom-cache/custom-cache.constants';
import { User, UserStatus } from '../entities/user.entity';

describe('OAuthService', () => {
  let service: OAuthService;
  let clientRepository: Repository<OAuthClient>;
  let tokenRepository: Repository<OAuthToken>;
  let cacheService: CustomCacheService;
  let usersService: UsersService;

  const mockClientRepository = {
    create: mock(),
    save: mock(),
    findOne: mock(),
  };

  const mockTokenRepository = {
    create: mock(),
    save: mock(),
    findOne: mock(),
  };

  const mockCacheService = {
    set: mock(),
    get: mock(),
    del: mock(),
  };

  const mockUsersService = {
    findById: mock(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthService,
        {
          provide: getRepositoryToken(OAuthClient),
          useValue: mockClientRepository,
        },
        {
          provide: getRepositoryToken(OAuthToken),
          useValue: mockTokenRepository,
        },
        {
          provide: CustomCacheService,
          useValue: mockCacheService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    service = module.get<OAuthService>(OAuthService);
    clientRepository = module.get<Repository<OAuthClient>>(getRepositoryToken(OAuthClient));
    tokenRepository = module.get<Repository<OAuthToken>>(getRepositoryToken(OAuthToken));
    cacheService = module.get<CustomCacheService>(CustomCacheService);
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    mockClientRepository.create.mockClear();
    mockClientRepository.save.mockClear();
    mockClientRepository.findOne.mockClear();
    mockTokenRepository.create.mockClear();
    mockTokenRepository.save.mockClear();
    mockTokenRepository.findOne.mockClear();
    mockCacheService.set.mockClear();
    mockCacheService.get.mockClear();
    mockCacheService.del.mockClear();
    mockUsersService.findById.mockClear();
  });

  describe('registerClient', () => {
    it('should register a new OAuth client and save to database', async () => {
      const userId = 'user-123';
      const dto = {
        name: 'Test App',
        redirectUris: ['http://localhost:3000/callback'],
        scopes: ['openid', 'profile'],
      };

      const savedClient = {
        id: 'client-uuid',
        clientId: 'client_abc123',
        clientSecret: 'secret123',
        name: dto.name,
        redirectUris: dto.redirectUris,
        allowedScopes: dto.scopes,
        isConfidential: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockClientRepository.create.mockReturnValue(savedClient);
      mockClientRepository.save.mockResolvedValue(savedClient);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.registerClient(userId, dto);

      expect(mockClientRepository.create).toHaveBeenCalled();
      expect(mockClientRepository.save).toHaveBeenCalled();
      expect(mockCacheService.set).toHaveBeenCalled();
      expect(result.client_id).toBe(savedClient.clientId);
      expect(result.name).toBe(dto.name);
      expect(result.redirect_uris).toEqual(dto.redirectUris);
    });
  });

  describe('getClient', () => {
    it('should return cached client if available', async () => {
      const clientId = 'client_abc123';
      const cachedClient = {
        id: 'client-uuid',
        clientId,
        clientSecret: 'secret123',
        name: 'Test App',
        redirectUris: ['http://localhost:3000/callback'],
        scopes: ['openid', 'profile'],
        userId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCacheService.get.mockResolvedValue(cachedClient);

      // Access private method via any
      const client = await (service as any).getClient(clientId);

      expect(mockCacheService.get).toHaveBeenCalledWith(
        `${CacheKeyPrefix.OAUTH_CLIENT}:${clientId}`
      );
      expect(client).toEqual(cachedClient);
      expect(mockClientRepository.findOne).not.toHaveBeenCalled();
    });

    it('should fall back to database if cache miss', async () => {
      const clientId = 'client_abc123';
      const dbClient = {
        id: 'client-uuid',
        clientId,
        clientSecret: 'secret123',
        name: 'Test App',
        redirectUris: ['http://localhost:3000/callback'],
        allowedScopes: ['openid', 'profile'],
        isConfidential: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCacheService.get.mockResolvedValue(null);
      mockClientRepository.findOne.mockResolvedValue(dbClient);
      mockCacheService.set.mockResolvedValue(undefined);

      const client = await (service as any).getClient(clientId);

      expect(mockCacheService.get).toHaveBeenCalled();
      expect(mockClientRepository.findOne).toHaveBeenCalledWith({
        where: { clientId },
      });
      expect(mockCacheService.set).toHaveBeenCalled();
      expect(client).toBeDefined();
      expect(client.clientId).toBe(clientId);
    });

    it('should return null if client not found in cache or database', async () => {
      const clientId = 'nonexistent';

      mockCacheService.get.mockResolvedValue(null);
      mockClientRepository.findOne.mockResolvedValue(null);

      const client = await (service as any).getClient(clientId);

      expect(client).toBeNull();
    });
  });

  describe('getAccessToken', () => {
    it('should return cached token if available', async () => {
      const token = 'access_token_123';
      const cachedTokenData = {
        accessToken: token,
        clientId: 'client_abc123',
        userId: 'user-123',
        scopes: ['openid', 'profile'],
        expiresAt: Date.now() + CacheTTL.OAUTH_ACCESS_TOKEN * 1000,
      };

      mockCacheService.get.mockResolvedValue(cachedTokenData);

      const tokenData = await (service as any).getAccessToken(token);

      expect(mockCacheService.get).toHaveBeenCalledWith(`${CacheKeyPrefix.OAUTH_TOKEN}:${token}`);
      expect(tokenData).toEqual(cachedTokenData);
      expect(mockTokenRepository.findOne).not.toHaveBeenCalled();
    });

    it('should fall back to database if cache miss', async () => {
      const token = 'access_token_123';
      const dbToken = {
        id: 'token-uuid',
        clientId: 'client-uuid',
        userId: 'user-uuid',
        accessToken: token,
        refreshToken: null,
        scopes: ['openid', 'profile'],
        expiresAt: new Date(Date.now() + CacheTTL.OAUTH_ACCESS_TOKEN * 1000),
        revokedAt: null,
        createdAt: new Date(),
        client: {
          id: 'client-uuid',
          clientId: 'client_abc123',
        },
      };

      mockCacheService.get.mockResolvedValue(null);
      mockTokenRepository.findOne.mockResolvedValue(dbToken);
      mockCacheService.set.mockResolvedValue(undefined);

      const tokenData = await (service as any).getAccessToken(token);

      expect(mockCacheService.get).toHaveBeenCalled();
      expect(mockTokenRepository.findOne).toHaveBeenCalledWith({
        where: { accessToken: token },
        relations: ['client'],
      });
      expect(mockCacheService.set).toHaveBeenCalled();
      expect(tokenData).toBeDefined();
      expect(tokenData.accessToken).toBe(token);
    });

    it('should return null if token is revoked', async () => {
      const token = 'revoked_token';
      const dbToken = {
        id: 'token-uuid',
        accessToken: token,
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 100000),
      };

      mockCacheService.get.mockResolvedValue(null);
      mockTokenRepository.findOne.mockResolvedValue(dbToken);

      const tokenData = await (service as any).getAccessToken(token);

      expect(tokenData).toBeNull();
    });

    it('should return null if token is expired', async () => {
      const token = 'expired_token';
      const dbToken = {
        id: 'token-uuid',
        accessToken: token,
        revokedAt: null,
        expiresAt: new Date(Date.now() - 100000),
      };

      mockCacheService.get.mockResolvedValue(null);
      mockTokenRepository.findOne.mockResolvedValue(dbToken);

      const tokenData = await (service as any).getAccessToken(token);

      expect(tokenData).toBeNull();
    });
  });

  describe('userinfo', () => {
    it('should return user info for valid access token', async () => {
      const token = 'access_token_123';
      const authHeader = `Bearer ${token}`;
      const userId = 'user-123';
      const tokenData = {
        accessToken: token,
        clientId: 'client_abc123',
        userId,
        scopes: ['openid', 'profile', 'email', 'phone'],
        expiresAt: Date.now() + CacheTTL.OAUTH_ACCESS_TOKEN * 1000,
      };
      const user = {
        id: userId,
        username: 'testuser',
        email: 'test@example.com',
        nickname: 'Test User',
        avatarUrl: 'http://example.com/avatar.jpg',
        phone: '+1234567890',
      } as User;

      mockCacheService.get.mockResolvedValue(tokenData);
      mockUsersService.findById.mockResolvedValue(user);

      const result = await service.userinfo(authHeader);

      expect(result.sub).toBe(userId);
      expect(result.username).toBe(user.username);
      expect(result.email).toBe(user.email);
      expect(result.nickname).toBe(user.nickname);
      expect(result.avatar_url).toBe(user.avatarUrl);
      expect(result.phone).toBe(user.phone);
    });

    it('should throw UnauthorizedException if token is missing', async () => {
      await expect(service.userinfo('')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if token is invalid', async () => {
      const token = 'invalid_token';
      const authHeader = `Bearer ${token}`;

      mockCacheService.get.mockResolvedValue(null);
      mockTokenRepository.findOne.mockResolvedValue(null);

      await expect(service.userinfo(authHeader)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const token = 'access_token_123';
      const authHeader = `Bearer ${token}`;
      const userId = 'user-123';
      const tokenData = {
        accessToken: token,
        clientId: 'client_abc123',
        userId,
        scopes: ['openid'],
        expiresAt: Date.now() + CacheTTL.OAUTH_ACCESS_TOKEN * 1000,
      };

      mockCacheService.get.mockResolvedValue(tokenData);
      mockUsersService.findById.mockResolvedValue(null);

      await expect(service.userinfo(authHeader)).rejects.toThrow(UnauthorizedException);
    });
  });
});
