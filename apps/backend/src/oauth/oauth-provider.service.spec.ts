import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OAuthProviderService } from './oauth-provider.service';
import { OAuthProviderConfig, OAuthProviderCode } from '../entities/oauth-provider-config.entity';

describe('OAuthProviderService', () => {
  let service: OAuthProviderService;
  let mockRepository: jest.Mocked<Repository<OAuthProviderConfig>>;

  const mockConfig: OAuthProviderConfig = {
    id: 'test-id',
    code: OAuthProviderCode.WECHAT,
    name: 'WeChat',
    appId: 'wx123456',
    appSecret: 'secret123',
    redirectUri: 'https://example.com/callback',
    enabled: true,
    config: null,
    displayName: null,
    icon: null,
    color: null,
    providerType: null,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthProviderService,
        {
          provide: getRepositoryToken(OAuthProviderConfig),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<OAuthProviderService>(OAuthProviderService);
  });

  afterEach(() => {
    service.clearCache();
  });

  describe('list', () => {
    it('should return all provider configurations', async () => {
      const configs = [mockConfig];
      mockRepository.find.mockResolvedValue(configs);

      const result = await service.list();

      expect(result).toEqual(configs);
      expect(mockRepository.find).toHaveBeenCalledWith({
        order: { createdAt: 'ASC' },
      });
    });

    it('should return empty array when no configurations exist', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.list();

      expect(result).toEqual([]);
    });
  });

  describe('getByCode', () => {
    it('should return config from cache if available', async () => {
      mockRepository.findOne.mockResolvedValue(mockConfig);

      await service.getByCode(OAuthProviderCode.WECHAT);
      mockRepository.findOne.mockClear();

      const result = await service.getByCode(OAuthProviderCode.WECHAT);

      expect(result).toEqual(mockConfig);
      expect(mockRepository.findOne).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache if not in cache', async () => {
      mockRepository.findOne.mockResolvedValue(mockConfig);

      const result = await service.getByCode(OAuthProviderCode.WECHAT);

      expect(result).toEqual(mockConfig);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { code: OAuthProviderCode.WECHAT },
      });
    });

    it('should return null if config not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.getByCode(OAuthProviderCode.WECHAT);

      expect(result).toBeNull();
    });

    it('should not cache null results', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await service.getByCode(OAuthProviderCode.WECHAT);
      mockRepository.findOne.mockClear();
      await service.getByCode(OAuthProviderCode.WECHAT);

      expect(mockRepository.findOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('update', () => {
    it('should update config and invalidate cache', async () => {
      const updatedConfig = { ...mockConfig, name: 'Updated WeChat' };
      mockRepository.findOne.mockResolvedValue(mockConfig);
      mockRepository.save.mockResolvedValue(updatedConfig);

      const result = await service.update('test-id', { name: 'Updated WeChat' });

      expect(result).toEqual(updatedConfig);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if config not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.update('non-existent', { name: 'Test' })).rejects.toThrow(
        NotFoundException
      );
    });

    it('should clear cache for the provider after update', async () => {
      mockRepository.findOne.mockResolvedValue(mockConfig);
      mockRepository.save.mockResolvedValue(mockConfig);

      service.clearCache();
      await service.getByCode(OAuthProviderCode.WECHAT);
      expect(mockRepository.findOne).toHaveBeenCalledTimes(1);

      mockRepository.findOne.mockClear();
      mockRepository.findOne.mockResolvedValue(mockConfig);

      await service.update('test-id', { name: 'Updated' });
      expect(mockRepository.findOne).toHaveBeenCalledTimes(1);

      mockRepository.findOne.mockClear();
      mockRepository.findOne.mockResolvedValue(mockConfig);

      await service.getByCode(OAuthProviderCode.WECHAT);
      expect(mockRepository.findOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('enable', () => {
    it('should enable provider by calling update with enabled=true', async () => {
      const enabledConfig = { ...mockConfig, enabled: true };
      mockRepository.findOne.mockResolvedValue(mockConfig);
      mockRepository.save.mockResolvedValue(enabledConfig);

      const result = await service.enable('test-id');

      expect(result.enabled).toBe(true);
      expect(mockRepository.save).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
    });
  });

  describe('disable', () => {
    it('should disable provider by calling update with enabled=false', async () => {
      const disabledConfig = { ...mockConfig, enabled: false };
      mockRepository.findOne.mockResolvedValue(mockConfig);
      mockRepository.save.mockResolvedValue(disabledConfig);

      const result = await service.disable('test-id');

      expect(result.enabled).toBe(false);
      expect(mockRepository.save).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
    });
  });

  describe('clearCache', () => {
    it('should clear all cached configs', async () => {
      mockRepository.findOne.mockResolvedValue(mockConfig);

      await service.getByCode(OAuthProviderCode.WECHAT);
      service.clearCache();
      await service.getByCode(OAuthProviderCode.WECHAT);

      expect(mockRepository.findOne).toHaveBeenCalledTimes(2);
    });
  });

  describe('clearCacheForProvider', () => {
    it('should clear cache for specific provider only', async () => {
      const wechatConfig = { ...mockConfig, code: OAuthProviderCode.WECHAT };
      const dingtalkConfig = {
        ...mockConfig,
        id: 'dingtalk-id',
        code: OAuthProviderCode.DINGTALK,
        name: 'DingTalk',
      };

      mockRepository.findOne
        .mockResolvedValueOnce(wechatConfig)
        .mockResolvedValueOnce(dingtalkConfig)
        .mockResolvedValueOnce(wechatConfig);

      await service.getByCode(OAuthProviderCode.WECHAT);
      await service.getByCode(OAuthProviderCode.DINGTALK);

      expect(mockRepository.findOne).toHaveBeenCalledTimes(2);

      service.clearCacheForProvider(OAuthProviderCode.WECHAT);

      await service.getByCode(OAuthProviderCode.WECHAT);
      expect(mockRepository.findOne).toHaveBeenCalledTimes(3);

      await service.getByCode(OAuthProviderCode.DINGTALK);
      expect(mockRepository.findOne).toHaveBeenCalledTimes(3);
    });
  });

  describe('getProvidersMetadata', () => {
    it('should return metadata for enabled providers only', async () => {
      const enabledConfig = {
        ...mockConfig,
        code: OAuthProviderCode.WECHAT,
        enabled: true,
        displayName: '微信',
        icon: 'ChatDotRound',
        color: '#07C160',
        providerType: 'oauth2',
        sortOrder: 1,
      };

      mockRepository.find.mockResolvedValue([enabledConfig]);

      const result = await service.getProvidersMetadata();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        code: OAuthProviderCode.WECHAT,
        displayName: '微信',
        icon: 'ChatDotRound',
        color: '#07C160',
        providerType: 'oauth2',
        isEnabled: true,
      });
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { enabled: true },
        order: { sortOrder: 'ASC' },
      });
    });

    it('should fill default values when displayName/icon/color/providerType are null', async () => {
      const configWithNulls = {
        ...mockConfig,
        code: OAuthProviderCode.WECHAT,
        enabled: true,
        displayName: null,
        icon: null,
        color: null,
        providerType: null,
        sortOrder: 1,
      };

      mockRepository.find.mockResolvedValue([configWithNulls]);

      const result = await service.getProvidersMetadata();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        code: OAuthProviderCode.WECHAT,
        displayName: '微信',
        icon: 'ChatDotRound',
        color: '#07C160',
        providerType: 'oauth2',
        isEnabled: true,
      });
    });

    it('should sort providers by sortOrder', async () => {
      const config1 = {
        ...mockConfig,
        id: 'id-1',
        code: OAuthProviderCode.DINGTALK,
        enabled: true,
        displayName: '钉钉',
        sortOrder: 2,
      };
      const config2 = {
        ...mockConfig,
        id: 'id-2',
        code: OAuthProviderCode.WECHAT,
        enabled: true,
        displayName: '微信',
        sortOrder: 1,
      };

      mockRepository.find.mockResolvedValue([config2, config1]);

      const result = await service.getProvidersMetadata();

      expect(result[0].code).toBe(OAuthProviderCode.WECHAT);
      expect(result[1].code).toBe(OAuthProviderCode.DINGTALK);
    });

    it('should infer providerType as miniprogram for *_miniprogram codes', async () => {
      const miniprogramConfig = {
        ...mockConfig,
        code: OAuthProviderCode.WECHAT_MINIPROGRAM,
        enabled: true,
        displayName: null,
        icon: null,
        color: null,
        providerType: null,
        sortOrder: 1,
      };

      mockRepository.find.mockResolvedValue([miniprogramConfig]);

      const result = await service.getProvidersMetadata();

      expect(result[0].providerType).toBe('miniprogram');
    });

    it('should return empty array when no enabled providers exist', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.getProvidersMetadata();

      expect(result).toEqual([]);
    });
  });

  describe('updateMetadata', () => {
    it('should update metadata fields and return updated config', async () => {
      const updatedConfig = {
        ...mockConfig,
        displayName: '微信登录',
        icon: 'WechatIcon',
        color: '#07C160',
        sortOrder: 10,
      };
      mockRepository.findOne.mockResolvedValue(mockConfig);
      mockRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockRepository.findOne.mockResolvedValue(updatedConfig);

      const result = await service.updateMetadata('test-id', {
        displayName: '微信登录',
        icon: 'WechatIcon',
        color: '#07C160',
        sortOrder: 10,
      });

      expect(result).toEqual(updatedConfig);
      expect(mockRepository.update).toHaveBeenCalledWith('test-id', {
        displayName: '微信登录',
        icon: 'WechatIcon',
        color: '#07C160',
        sortOrder: 10,
      });
    });

    it('should only update provided fields (partial update)', async () => {
      const updatedConfig = { ...mockConfig, displayName: '微信登录' };
      mockRepository.findOne.mockResolvedValue(mockConfig);
      mockRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockRepository.findOne.mockResolvedValue(updatedConfig);

      const result = await service.updateMetadata('test-id', {
        displayName: '微信登录',
      });

      expect(result).toEqual(updatedConfig);
      expect(mockRepository.update).toHaveBeenCalledWith('test-id', {
        displayName: '微信登录',
      });
    });

    it('should clear cache for the provider after update', async () => {
      mockRepository.findOne.mockResolvedValue(mockConfig);
      mockRepository.update.mockResolvedValue({ affected: 1 } as any);

      // First, cache the config
      await service.getByCode(OAuthProviderCode.WECHAT);
      expect(mockRepository.findOne).toHaveBeenCalledTimes(1);

      // Update metadata
      mockRepository.findOne.mockClear();
      mockRepository.findOne.mockResolvedValue(mockConfig);
      await service.updateMetadata('test-id', { displayName: 'New Name' });

      // Cache should be cleared, so next call hits DB
      mockRepository.findOne.mockClear();
      mockRepository.findOne.mockResolvedValue(mockConfig);
      await service.getByCode(OAuthProviderCode.WECHAT);
      expect(mockRepository.findOne).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException if config not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.updateMetadata('non-existent', { displayName: 'Test' })).rejects.toThrow(
        NotFoundException
      );
    });

    it('should not call update if no fields provided', async () => {
      mockRepository.findOne.mockResolvedValue(mockConfig);

      const result = await service.updateMetadata('test-id', {});

      expect(result).toEqual(mockConfig);
      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('batchEnable', () => {
    it('should enable multiple providers by IDs', async () => {
      const configs = [
        { ...mockConfig, id: 'id-1', code: OAuthProviderCode.WECHAT },
        { ...mockConfig, id: 'id-2', code: OAuthProviderCode.DINGTALK },
      ];
      mockRepository.update.mockResolvedValue({ affected: 2 } as any);
      mockRepository.find.mockResolvedValue(configs);

      await service.batchEnable(['id-1', 'id-2']);

      expect(mockRepository.update).toHaveBeenCalledWith(['id-1', 'id-2'], {
        enabled: true,
      });
      expect(mockRepository.find).toHaveBeenCalled();
    });

    it('should clear cache for all affected providers', async () => {
      const configs = [
        { ...mockConfig, id: 'id-1', code: OAuthProviderCode.WECHAT },
        { ...mockConfig, id: 'id-2', code: OAuthProviderCode.DINGTALK },
      ];
      mockRepository.update.mockResolvedValue({ affected: 2 } as any);
      mockRepository.find.mockResolvedValue(configs);

      // Cache configs first
      mockRepository.findOne.mockResolvedValueOnce(configs[0]).mockResolvedValueOnce(configs[1]);
      await service.getByCode(OAuthProviderCode.WECHAT);
      await service.getByCode(OAuthProviderCode.DINGTALK);
      expect(mockRepository.findOne).toHaveBeenCalledTimes(2);

      // Batch enable
      mockRepository.find.mockResolvedValue(configs);
      await service.batchEnable(['id-1', 'id-2']);

      // Cache should be cleared for both
      mockRepository.findOne.mockResolvedValueOnce(configs[0]).mockResolvedValueOnce(configs[1]);
      await service.getByCode(OAuthProviderCode.WECHAT);
      await service.getByCode(OAuthProviderCode.DINGTALK);
      expect(mockRepository.findOne).toHaveBeenCalledTimes(4);
    });

    it('should handle empty array', async () => {
      mockRepository.update.mockResolvedValue({ affected: 0 } as any);
      mockRepository.find.mockResolvedValue([]);

      await service.batchEnable([]);

      expect(mockRepository.update).toHaveBeenCalledWith([], { enabled: true });
    });
  });

  describe('batchDisable', () => {
    it('should disable multiple providers by IDs', async () => {
      const configs = [
        { ...mockConfig, id: 'id-1', code: OAuthProviderCode.WECHAT },
        { ...mockConfig, id: 'id-2', code: OAuthProviderCode.DINGTALK },
      ];
      mockRepository.update.mockResolvedValue({ affected: 2 } as any);
      mockRepository.find.mockResolvedValue(configs);

      await service.batchDisable(['id-1', 'id-2']);

      expect(mockRepository.update).toHaveBeenCalledWith(['id-1', 'id-2'], {
        enabled: false,
      });
      expect(mockRepository.find).toHaveBeenCalled();
    });

    it('should clear cache for all affected providers', async () => {
      const configs = [
        { ...mockConfig, id: 'id-1', code: OAuthProviderCode.WECHAT },
        { ...mockConfig, id: 'id-2', code: OAuthProviderCode.DINGTALK },
      ];
      mockRepository.update.mockResolvedValue({ affected: 2 } as any);
      mockRepository.find.mockResolvedValue(configs);

      // Cache configs first
      mockRepository.findOne.mockResolvedValueOnce(configs[0]).mockResolvedValueOnce(configs[1]);
      await service.getByCode(OAuthProviderCode.WECHAT);
      await service.getByCode(OAuthProviderCode.DINGTALK);
      expect(mockRepository.findOne).toHaveBeenCalledTimes(2);

      // Batch disable
      mockRepository.find.mockResolvedValue(configs);
      await service.batchDisable(['id-1', 'id-2']);

      // Cache should be cleared for both
      mockRepository.findOne.mockResolvedValueOnce(configs[0]).mockResolvedValueOnce(configs[1]);
      await service.getByCode(OAuthProviderCode.WECHAT);
      await service.getByCode(OAuthProviderCode.DINGTALK);
      expect(mockRepository.findOne).toHaveBeenCalledTimes(4);
    });

    it('should handle empty array', async () => {
      mockRepository.update.mockResolvedValue({ affected: 0 } as any);
      mockRepository.find.mockResolvedValue([]);

      await service.batchDisable([]);

      expect(mockRepository.update).toHaveBeenCalledWith([], { enabled: false });
    });
  });
});
