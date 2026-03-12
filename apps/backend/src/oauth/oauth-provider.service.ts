import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { OAuthProviderConfig, OAuthProviderCode } from '../entities/oauth-provider-config.entity';

export interface UpdateProviderData {
  name?: string;
  appId?: string;
  appSecret?: string;
  redirectUri?: string | null;
  enabled?: boolean;
  config?: Record<string, unknown> | null;
}

export interface UpdateProviderMetadataDto {
  displayName?: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
}

export interface ProviderMetadata {
  code: OAuthProviderCode;
  displayName: string;
  icon: string;
  color: string;
  providerType: string;
  isEnabled: boolean;
}

export interface CreateProviderData {
  code: OAuthProviderCode;
  configName: string;
  appId: string;
  appSecret: string;
  redirectUri?: string;
  displayName?: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
  isDefault?: boolean;
}

@Injectable()
export class OAuthProviderService {
  private cache: Map<OAuthProviderCode, OAuthProviderConfig> = new Map();

  constructor(
    @InjectRepository(OAuthProviderConfig)
    private configRepository: Repository<OAuthProviderConfig>
  ) {}

  async list(): Promise<OAuthProviderConfig[]> {
    return this.configRepository.find({
      order: { createdAt: 'ASC' },
    });
  }

  async getByCode(code: OAuthProviderCode): Promise<OAuthProviderConfig | null> {
    if (this.cache.has(code)) {
      return this.cache.get(code)!;
    }

    const config = await this.configRepository.findOne({ where: { code } });

    if (config) {
      this.cache.set(code, config);
    }

    return config;
  }

  async update(id: string, data: UpdateProviderData): Promise<OAuthProviderConfig> {
    const config = await this.configRepository.findOne({ where: { id } });
    if (!config) {
      throw new NotFoundException('Provider configuration not found');
    }

    const updatedConfig = await this.configRepository.save({
      ...config,
      ...data,
    });

    this.cache.delete(config.code);

    return updatedConfig;
  }

  async enable(id: string): Promise<OAuthProviderConfig> {
    return this.update(id, { enabled: true });
  }

  async disable(id: string): Promise<OAuthProviderConfig> {
    return this.update(id, { enabled: false });
  }

  async create(data: CreateProviderData): Promise<OAuthProviderConfig> {
    const config = this.configRepository.create({
      code: data.code,
      configName: data.configName,
      name: data.configName,
      appId: data.appId,
      appSecret: data.appSecret,
      redirectUri: data.redirectUri || null,
      displayName: data.displayName || null,
      icon: data.icon || null,
      color: data.color || null,
      sortOrder: data.sortOrder ?? null,
      isDefault: data.isDefault ?? false,
      enabled: true,
    });

    const savedConfig = await this.configRepository.save(config);
    this.clearCacheForProvider(data.code);

    return savedConfig;
  }

  async delete(id: string): Promise<void> {
    const config = await this.configRepository.findOne({ where: { id } });
    if (!config) {
      throw new NotFoundException('Provider configuration not found');
    }

    await this.configRepository.delete(id);
    this.clearCacheForProvider(config.code);
  }

  async getByConfigId(id: string): Promise<OAuthProviderConfig | null> {
    return this.configRepository.findOne({ where: { id } });
  }

  async listByCode(code: OAuthProviderCode): Promise<OAuthProviderConfig[]> {
    return this.configRepository.find({
      where: { code },
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
  }

  clearCache(): void {
    this.cache.clear();
  }

  clearCacheForProvider(code: OAuthProviderCode): void {
    this.cache.delete(code);
  }

  async getProvidersMetadata(): Promise<ProviderMetadata[]> {
    const configs = await this.configRepository.find({
      where: { enabled: true },
      order: { sortOrder: 'ASC' },
    });

    return configs.map((config) => ({
      code: config.code,
      displayName: config.displayName || this.getDefaultDisplayName(config.code),
      icon: config.icon || this.getDefaultIcon(config.code),
      color: config.color || this.getDefaultColor(config.code),
      providerType: config.providerType || this.getDefaultProviderType(config.code),
      isEnabled: config.enabled,
    }));
  }

  async updateMetadata(id: string, dto: UpdateProviderMetadataDto): Promise<OAuthProviderConfig> {
    const config = await this.configRepository.findOne({ where: { id } });
    if (!config) {
      throw new NotFoundException('Provider configuration not found');
    }

    const updatePayload: any = {};
    if (dto.displayName !== undefined) updatePayload.displayName = dto.displayName;
    if (dto.icon !== undefined) updatePayload.icon = dto.icon;
    if (dto.color !== undefined) updatePayload.color = dto.color;
    if (dto.sortOrder !== undefined) updatePayload.sortOrder = dto.sortOrder;

    if (Object.keys(updatePayload).length > 0) {
      await this.configRepository.update(id, updatePayload);
      this.clearCacheForProvider(config.code);
    }

    return (await this.configRepository.findOne({ where: { id } }))!;
  }

  async batchEnable(ids: string[]): Promise<void> {
    await this.configRepository.update(ids, { enabled: true });
    const configs = await this.configRepository.find({
      where: { id: In(ids) },
    });
    configs.forEach((config) => this.clearCacheForProvider(config.code));
  }

  async batchDisable(ids: string[]): Promise<void> {
    await this.configRepository.update(ids, { enabled: false });
    const configs = await this.configRepository.find({
      where: { id: In(ids) },
    });
    configs.forEach((config) => this.clearCacheForProvider(config.code));
  }

  private getDefaultDisplayName(code: OAuthProviderCode): string {
    const displayNames: Record<OAuthProviderCode, string> = {
      [OAuthProviderCode.WECHAT]: '微信',
      [OAuthProviderCode.WECHAT_MINIPROGRAM]: '微信小程序',
      [OAuthProviderCode.DINGTALK]: '钉钉',
      [OAuthProviderCode.DINGTALK_MINIPROGRAM]: '钉钉小程序',
      [OAuthProviderCode.FEISHU]: '飞书',
      [OAuthProviderCode.DOUYIN]: '抖音',
      [OAuthProviderCode.QQ]: 'QQ',
      [OAuthProviderCode.BAIDU]: '百度',
    };
    return displayNames[code] || code;
  }

  private getDefaultIcon(code: OAuthProviderCode): string {
    const icons: Record<OAuthProviderCode, string> = {
      [OAuthProviderCode.WECHAT]: 'ChatDotRound',
      [OAuthProviderCode.WECHAT_MINIPROGRAM]: 'ChatDotRound',
      [OAuthProviderCode.DINGTALK]: 'Message',
      [OAuthProviderCode.DINGTALK_MINIPROGRAM]: 'Message',
      [OAuthProviderCode.FEISHU]: 'ChatLineRound',
      [OAuthProviderCode.DOUYIN]: 'VideoPlay',
      [OAuthProviderCode.QQ]: 'User',
      [OAuthProviderCode.BAIDU]: 'Search',
    };
    return icons[code] || 'Connection';
  }

  private getDefaultColor(code: OAuthProviderCode): string {
    const colors: Record<OAuthProviderCode, string> = {
      [OAuthProviderCode.WECHAT]: '#07C160',
      [OAuthProviderCode.WECHAT_MINIPROGRAM]: '#07C160',
      [OAuthProviderCode.DINGTALK]: '#0089FF',
      [OAuthProviderCode.DINGTALK_MINIPROGRAM]: '#0089FF',
      [OAuthProviderCode.FEISHU]: '#3370FF',
      [OAuthProviderCode.DOUYIN]: '#000000',
      [OAuthProviderCode.QQ]: '#12B7F5',
      [OAuthProviderCode.BAIDU]: '#2932E1',
    };
    return colors[code] || '#409EFF';
  }

  private getDefaultProviderType(code: OAuthProviderCode): string {
    if (code.endsWith('_miniprogram')) {
      return 'miniprogram';
    }
    return 'oauth2';
  }
}
