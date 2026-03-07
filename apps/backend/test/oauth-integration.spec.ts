import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { mock, describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { BaiduOAuthService } from '../src/auth/oauth/baidu.service';
import { QQOAuthService } from '../src/auth/oauth/qq.service';
import { DouyinOAuthService } from '../src/auth/oauth/douyin.service';
import { FeishuOAuthService } from '../src/auth/oauth/feishu.service';
import { OAuthClientService } from '../src/oauth/oauth-client.service';
import { AuthService } from '../src/auth/auth.service';
import { UsersService } from '../src/users/users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OAuthClient } from '../src/entities/oauth-client.entity';
import { CustomCacheService } from '../src/custom-cache/custom-cache.service';

describe('OAuth Integration Tests', () => {
  describe('OAuth Provider Authorization URL Generation', () => {
    let baiduService: BaiduOAuthService;
    let qqService: QQOAuthService;
    let douyinService: DouyinOAuthService;
    let feishuService: FeishuOAuthService;

    const mockConfigService = {
      get: mock(),
    };

    const mockHttpService = {
      get: mock(),
      post: mock(),
    };

    const mockUsersService = {
      findSocialAccount: mock(),
      createOAuthUser: mock(),
      createSocialAccount: mock(),
      generateOAuthUsername: mock(),
      updateLastLogin: mock(),
    };

    const mockAuthService = {
      generateTokens: mock(),
    };

    beforeEach(() => {
      mockConfigService.get.mockReset();
    });

    describe('Baidu OAuth', () => {
      beforeEach(async () => {
        mockConfigService.get.mockReturnValue({
          appId: 'baidu_app_id',
          appSecret: 'baidu_app_secret',
          redirectUri: 'http://localhost:3001/api/auth/oauth/baidu/callback',
        });

        const module: TestingModule = await Test.createTestingModule({
          providers: [
            BaiduOAuthService,
            { provide: ConfigService, useValue: mockConfigService },
            { provide: HttpService, useValue: mockHttpService },
            { provide: UsersService, useValue: mockUsersService },
            { provide: AuthService, useValue: mockAuthService },
          ],
        }).compile();

        baiduService = module.get<BaiduOAuthService>(BaiduOAuthService);
      });

      it('should generate Baidu OAuth authorization URL', async () => {
        const result = await baiduService.getAuthorizationUrl('test_state');

        expect(result.url).toContain('https://openapi.baidu.com/oauth/2.0/authorize');
        expect(result.url).toContain('client_id=baidu_app_id');
        expect(result.url).toContain('state=test_state');
        expect(result.url).toContain('response_type=code');
      });

      it('should generate random state if not provided', async () => {
        const result = await baiduService.getAuthorizationUrl();

        expect(result.url).toContain('state=');
      });

      it('should throw error if config is missing', async () => {
        mockConfigService.get.mockReturnValueOnce(null);

        await expect(baiduService.getAuthorizationUrl()).rejects.toThrow(
          'Baidu OAuth configuration is missing'
        );
      });
    });

    describe('QQ OAuth', () => {
      beforeEach(async () => {
        mockConfigService.get.mockReturnValue({
          appId: 'qq_app_id',
          appSecret: 'qq_app_secret',
          redirectUri: 'http://localhost:3001/api/auth/oauth/qq/callback',
        });

        const module: TestingModule = await Test.createTestingModule({
          providers: [
            QQOAuthService,
            { provide: ConfigService, useValue: mockConfigService },
            { provide: HttpService, useValue: mockHttpService },
            { provide: UsersService, useValue: mockUsersService },
            { provide: AuthService, useValue: mockAuthService },
          ],
        }).compile();

        qqService = module.get<QQOAuthService>(QQOAuthService);
      });

      it('should generate QQ OAuth authorization URL', async () => {
        const result = await qqService.getAuthorizationUrl('test_state');

        expect(result.url).toContain('https://graph.qq.com/oauth2.0/authorize');
        expect(result.url).toContain('client_id=qq_app_id');
        expect(result.url).toContain('state=test_state');
        expect(result.url).toContain('response_type=code');
      });

      it('should generate random state if not provided', async () => {
        const result = await qqService.getAuthorizationUrl();

        expect(result.url).toContain('state=');
      });

      it('should throw error if config is missing', async () => {
        mockConfigService.get.mockReturnValueOnce(null);

        await expect(qqService.getAuthorizationUrl()).rejects.toThrow(
          'QQ OAuth configuration is missing'
        );
      });
    });

    describe('Douyin OAuth', () => {
      beforeEach(async () => {
        mockConfigService.get.mockReturnValue({
          appId: 'douyin_app_id',
          appSecret: 'douyin_app_secret',
          redirectUri: 'https://localhost:3001/api/auth/oauth/douyin/callback',
        });

        const module: TestingModule = await Test.createTestingModule({
          providers: [
            DouyinOAuthService,
            { provide: ConfigService, useValue: mockConfigService },
            { provide: HttpService, useValue: mockHttpService },
            { provide: UsersService, useValue: mockUsersService },
            { provide: AuthService, useValue: mockAuthService },
          ],
        }).compile();

        douyinService = module.get<DouyinOAuthService>(DouyinOAuthService);
      });

      it('should generate Douyin OAuth authorization URL', async () => {
        const result = await douyinService.getAuthorizationUrl('test_state');

        expect(result.url).toContain('https://open.douyin.com/platform/oauth/connect');
        expect(result.url).toContain('client_key=douyin_app_id');
        expect(result.url).toContain('state=test_state');
        expect(result.url).toContain('response_type=code');
      });

      it('should include scope parameter', async () => {
        const result = await douyinService.getAuthorizationUrl('test_state');

        expect(result.url).toContain('scope=user_info');
      });

      it('should throw error if redirect_uri is not HTTPS', async () => {
        mockConfigService.get.mockReturnValue({
          appId: 'douyin_app_id',
          appSecret: 'douyin_app_secret',
          redirectUri: 'http://localhost:3001/callback',
        });

        await expect(douyinService.getAuthorizationUrl()).rejects.toThrow(
          'Douyin redirect_uri must use HTTPS'
        );
      });

      it('should throw error if config is missing', async () => {
        mockConfigService.get.mockReturnValueOnce(null);

        await expect(douyinService.getAuthorizationUrl()).rejects.toThrow(
          'Douyin OAuth configuration is missing'
        );
      });
    });

    describe('Feishu OAuth', () => {
      beforeEach(async () => {
        mockConfigService.get.mockReturnValue({
          appId: 'feishu_app_id',
          appSecret: 'feishu_app_secret',
          redirectUri: 'http://localhost:3001/api/auth/oauth/feishu/callback',
        });

        const module: TestingModule = await Test.createTestingModule({
          providers: [
            FeishuOAuthService,
            { provide: ConfigService, useValue: mockConfigService },
            { provide: HttpService, useValue: mockHttpService },
            { provide: UsersService, useValue: mockUsersService },
            { provide: AuthService, useValue: mockAuthService },
          ],
        }).compile();

        feishuService = module.get<FeishuOAuthService>(FeishuOAuthService);
      });

      it('should generate Feishu OAuth authorization URL', async () => {
        const result = await feishuService.getAuthorizationUrl('test_state');

        expect(result.url).toContain('https://passport.feishu.cn/suite/passport/oauth/authorize');
        expect(result.url).toContain('app_id=feishu_app_id');
        expect(result.url).toContain('state=test_state');
        expect(result.url).toContain('response_type=code');
      });

      it('should generate random state if not provided', async () => {
        const result = await feishuService.getAuthorizationUrl();

        expect(result.url).toContain('state=');
      });

      it('should throw error if config is missing', async () => {
        mockConfigService.get.mockReturnValueOnce(null);

        await expect(feishuService.getAuthorizationUrl()).rejects.toThrow(
          'Feishu OAuth configuration is missing'
        );
      });
    });
  });

  describe('OAuth2 Client Persistence', () => {
    let clientService: OAuthClientService;
    let mockClientRepository: any;
    let mockCacheService: any;

    const mockClient: OAuthClient = {
      id: 'test-client-id',
      clientId: 'client_test123',
      clientSecret: 'secret123',
      name: 'Test Client',
      redirectUris: ['http://localhost:3000/callback'],
      allowedScopes: ['openid', 'profile', 'email'],
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
        ],
      }).compile();

      clientService = module.get<OAuthClientService>(OAuthClientService);
    });

    afterEach(() => {
      mockClientRepository.findOne.mockClear();
      mockClientRepository.create.mockClear();
      mockClientRepository.save.mockClear();
      mockClientRepository.update.mockClear();
      mockClientRepository.delete.mockClear();
    });

    it('should create OAuth2 client and persist to database', async () => {
      const createDto = {
        name: 'New OAuth Client',
        redirectUris: ['https://example.com/callback'],
        scopes: ['openid', 'profile'],
        isConfidential: true,
      };

      const result = await clientService.create(createDto);

      expect(mockClientRepository.create).toHaveBeenCalled();
      expect(mockClientRepository.save).toHaveBeenCalled();
      expect(result.clientId).toBeDefined();
      expect(result.clientSecret).toBeDefined();
      expect(result.name).toBe(mockClient.name);
    });

    it('should retrieve persisted OAuth2 client by clientId', async () => {
      const result = await clientService.findByClientId('client_test123');

      expect(mockClientRepository.findOne).toHaveBeenCalledWith({
        where: { clientId: 'client_test123' },
      });
      expect(result).toEqual(mockClient);
    });

    it('should retrieve persisted OAuth2 client by id', async () => {
      const result = await clientService.findById('test-client-id');

      expect(mockClientRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'test-client-id' },
      });
      expect(result).toEqual(mockClient);
    });

    it('should list persisted OAuth2 clients with pagination', async () => {
      const result = await clientService.list({ limit: 10, offset: 0 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.data[0]).toEqual(mockClient);
    });

    it('should update persisted OAuth2 client', async () => {
      const updateDto = {
        name: 'Updated Client',
        redirectUris: ['https://example.com/new-callback'],
      };

      await clientService.update('test-client-id', updateDto);

      expect(mockClientRepository.update).toHaveBeenCalled();
      expect(mockCacheService.del).toHaveBeenCalled();
    });

    it('should delete persisted OAuth2 client', async () => {
      await clientService.delete('test-client-id');

      expect(mockClientRepository.delete).toHaveBeenCalledWith('test-client-id');
      expect(mockCacheService.del).toHaveBeenCalled();
    });

    it('should regenerate client secret for persisted client', async () => {
      await clientService.regenerateSecret('test-client-id');

      expect(mockClientRepository.update).toHaveBeenCalled();
      expect(mockCacheService.del).toHaveBeenCalled();
    });
  });
});
