import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { ApiKey } from '../entities/api-key.entity';

export interface CreateApiKeyData {
  name: string;
  userId: string;
  scopes?: string[];
  expiresAt?: Date;
}

export interface ApiKeyWithPlainKey {
  apiKey: ApiKey;
  plainKey: string;
}

@Injectable()
export class ApiKeyService {
  private readonly SALT_ROUNDS = 10;

  constructor(
    @InjectRepository(ApiKey)
    private apiKeyRepository: Repository<ApiKey>
  ) {}

  async create(data: CreateApiKeyData): Promise<ApiKeyWithPlainKey> {
    const plainKey = crypto.randomBytes(32).toString('hex');
    const hashedKey = await bcrypt.hash(plainKey, this.SALT_ROUNDS);

    const apiKey = this.apiKeyRepository.create({
      userId: data.userId,
      name: data.name,
      key: hashedKey,
      scopes: data.scopes || null,
      expiresAt: data.expiresAt || null,
    });

    const savedApiKey = await this.apiKeyRepository.save(apiKey);

    return { apiKey: savedApiKey, plainKey };
  }

  async findByKey(key: string): Promise<ApiKey | null> {
    const apiKeys = await this.apiKeyRepository.find({
      relations: ['user'],
    });

    for (const apiKey of apiKeys) {
      const isValid = await bcrypt.compare(key, apiKey.key);
      if (isValid) {
        return apiKey;
      }
    }

    return null;
  }

  async findByUser(userId: string): Promise<ApiKey[]> {
    return this.apiKeyRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async revoke(id: string): Promise<void> {
    const apiKey = await this.apiKeyRepository.findOne({ where: { id } });
    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    if (apiKey.revokedAt) {
      throw new BadRequestException('API key is already revoked');
    }

    await this.apiKeyRepository.update(id, { revokedAt: new Date() });
  }

  async updateLastUsed(id: string): Promise<void> {
    await this.apiKeyRepository.update(id, { lastUsedAt: new Date() });
  }

  async delete(id: string): Promise<void> {
    const apiKey = await this.apiKeyRepository.findOne({ where: { id } });
    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    await this.apiKeyRepository.delete(id);
  }

  async findById(id: string): Promise<ApiKey | null> {
    return this.apiKeyRepository.findOne({ where: { id } });
  }
}
