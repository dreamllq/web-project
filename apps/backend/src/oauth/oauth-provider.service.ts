import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OAuthProviderConfig, OAuthProviderCode } from '../entities/oauth-provider-config.entity';

export interface UpdateProviderData {
  name?: string;
  appId?: string;
  appSecret?: string;
  redirectUri?: string | null;
  enabled?: boolean;
  config?: Record<string, unknown> | null;
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

  clearCache(): void {
    this.cache.clear();
  }

  clearCacheForProvider(code: OAuthProviderCode): void {
    this.cache.delete(code);
  }
}
