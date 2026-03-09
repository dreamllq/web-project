import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OAuthClient } from '../entities/oauth-client.entity';
import { CustomCacheService } from '../custom-cache/custom-cache.service';
import { CacheKeyPrefix } from '../custom-cache/custom-cache.constants';
import { OAuthSecretEncryptionService } from './oauth-secret-encryption.service';
import { OAuthTokenService } from './oauth-token.service';

export interface OAuthClientQueryDto {
  keyword?: string;
  limit?: number;
  offset?: number;
}

export interface CreateOAuthClientDto {
  name: string;
  redirectUris: string[];
  scopes?: string[];
  isConfidential?: boolean;
}

export interface UpdateOAuthClientDto {
  name?: string;
  redirectUris?: string[];
  scopes?: string[];
  isConfidential?: boolean;
}

export interface OAuthClientResponse {
  id: string;
  clientId: string;
  clientSecret: string;
  name: string;
  redirectUris: string[];
  allowedScopes: string[];
  isConfidential: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class OAuthClientService {
  private readonly logger = new Logger(OAuthClientService.name);

  constructor(
    @InjectRepository(OAuthClient)
    private readonly clientRepository: Repository<OAuthClient>,
    private readonly cacheService: CustomCacheService,
    private readonly encryptionService: OAuthSecretEncryptionService,
    private readonly tokenService: OAuthTokenService
  ) {}

  /**
   * List all OAuth clients with pagination
   */
  async list(query: OAuthClientQueryDto): Promise<{ data: OAuthClient[]; total: number }> {
    const { keyword, limit = 10, offset = 0 } = query;

    const qb = this.clientRepository.createQueryBuilder('client');

    if (keyword) {
      qb.andWhere('(client.name ILIKE :keyword OR client.clientId ILIKE :keyword)', {
        keyword: `%${keyword}%`,
      });
    }

    qb.orderBy('client.createdAt', 'DESC');

    const total = await qb.getCount();

    qb.skip(offset).take(limit);

    const data = await qb.getMany();

    return { data, total };
  }

  /**
   * Find client by ID
   */
  async findById(id: string): Promise<OAuthClient | null> {
    return this.clientRepository.findOne({ where: { id } });
  }

  /**
   * Find client by clientId
   */
  async findByClientId(clientId: string): Promise<OAuthClient | null> {
    return this.clientRepository.findOne({ where: { clientId } });
  }

  /**
   * Create new OAuth client
   */
  async create(dto: CreateOAuthClientDto): Promise<OAuthClient> {
    const clientId = this.generateClientId();
    const clientSecret = this.generateClientSecret();
    const encryptedSecret = this.encryptionService.encrypt(clientSecret);

    const client = this.clientRepository.create({
      clientId,
      clientSecret: encryptedSecret,
      name: dto.name,
      redirectUris: dto.redirectUris,
      allowedScopes: dto.scopes || ['openid', 'profile', 'email'],
      isConfidential: dto.isConfidential ?? true,
    });

    const savedClient = await this.clientRepository.save(client);

    this.logger.log(`Created OAuth client: ${clientId}`);

    const response = { ...savedClient, clientSecret };
    return response;
  }

  /**
   * Update OAuth client
   */
  async update(id: string, dto: UpdateOAuthClientDto): Promise<OAuthClient> {
    const client = await this.findById(id);
    if (!client) {
      throw new NotFoundException('OAuth client not found');
    }

    const updatePayload: {
      name?: string;
      redirectUris?: string[];
      allowedScopes?: string[];
      isConfidential?: boolean;
    } = {};

    if (dto.name !== undefined) {
      updatePayload.name = dto.name;
    }
    if (dto.redirectUris !== undefined) {
      updatePayload.redirectUris = dto.redirectUris;
    }
    if (dto.scopes !== undefined) {
      updatePayload.allowedScopes = dto.scopes;
    }
    if (dto.isConfidential !== undefined) {
      updatePayload.isConfidential = dto.isConfidential;
    }

    if (Object.keys(updatePayload).length > 0) {
      await this.clientRepository.update(id, updatePayload);
      await this.cacheService.del(`${CacheKeyPrefix.OAUTH_CLIENT}:${client.clientId}`);
    }

    return (await this.findById(id))!;
  }

  /**
   * Delete OAuth client
   */
  async delete(id: string): Promise<void> {
    const client = await this.findById(id);
    if (!client) {
      throw new NotFoundException('OAuth client not found');
    }

    const tokenCount = await this.tokenService.countByClientId(id);
    if (tokenCount > 0) {
      throw new BadRequestException(
        `Cannot delete client with ${tokenCount} active tokens. Revoke tokens first or use force delete.`
      );
    }

    await this.clientRepository.delete(id);
    await this.cacheService.del(`${CacheKeyPrefix.OAUTH_CLIENT}:${client.clientId}`);
    this.logger.log(`Deleted OAuth client: ${client.clientId}`);
  }

  /**
   * Regenerate client secret
   */
  async regenerateSecret(id: string): Promise<OAuthClient> {
    const client = await this.findById(id);
    if (!client) {
      throw new NotFoundException('OAuth client not found');
    }

    const newSecret = this.generateClientSecret();
    const encryptedSecret = this.encryptionService.encrypt(newSecret);
    await this.clientRepository.update(id, { clientSecret: encryptedSecret });
    await this.cacheService.del(`${CacheKeyPrefix.OAUTH_CLIENT}:${client.clientId}`);
    this.logger.log(`Regenerated secret for OAuth client: ${client.clientId}`);

    const updatedClient = (await this.findById(id))!;
    return { ...updatedClient, clientSecret: newSecret };
  }

  /**
   * Map entity to response DTO
   */
  toResponse(client: OAuthClient): OAuthClientResponse {
    return {
      id: client.id,
      clientId: client.clientId,
      clientSecret: '••••••••',
      name: client.name,
      redirectUris: client.redirectUris,
      allowedScopes: client.allowedScopes,
      isConfidential: client.isConfidential,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    };
  }

  // ==================== Private Methods ====================

  /**
   * Generate random client ID
   */
  private generateClientId(): string {
    return `client_${this.randomString(16)}`;
  }

  /**
   * Generate random client secret
   */
  private generateClientSecret(): string {
    return this.randomString(32);
  }

  /**
   * Generate random string
   */
  private randomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
