import { Test, TestingModule } from '@nestjs/testing';
import { mock, describe, it, expect, beforeEach, afterEach } from 'bun:test';
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
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockRepository = {
      find: mock(),
      findOne: mock(),
      save: mock(),
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
});
