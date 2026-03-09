import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OAuthToken } from '../entities/oauth-token.entity';
import { CustomCacheService } from '../custom-cache/custom-cache.service';
import { CacheKeyPrefix } from '../custom-cache/custom-cache.constants';

export interface OAuthTokenQueryDto {
  clientId?: string;
  userId?: string;
  revoked?: boolean;
  limit?: number;
  offset?: number;
}

export interface OAuthTokenResponse {
  id: string;
  clientId: string;
  userId: string | null;
  accessToken: string;
  scopes: string[];
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface BatchOperationResult {
  success: string[];
  failed: string[];
  errors: string[];
}

@Injectable()
export class OAuthTokenService {
  private readonly logger = new Logger(OAuthTokenService.name);

  constructor(
    @InjectRepository(OAuthToken)
    private readonly tokenRepository: Repository<OAuthToken>,
    private readonly cacheService: CustomCacheService
  ) {}

  async list(query: OAuthTokenQueryDto): Promise<{ data: OAuthToken[]; total: number }> {
    const { clientId, userId, revoked, limit = 10, offset = 0 } = query;

    const qb = this.tokenRepository.createQueryBuilder('token');

    if (clientId) {
      qb.andWhere('token.clientId = :clientId', { clientId });
    }

    if (userId) {
      qb.andWhere('token.userId = :userId', { userId });
    }

    if (revoked !== undefined) {
      if (revoked) {
        qb.andWhere('token.revokedAt IS NOT NULL');
      } else {
        qb.andWhere('token.revokedAt IS NULL');
      }
    }

    qb.orderBy('token.createdAt', 'DESC');

    const total = await qb.getCount();
    qb.skip(offset).take(limit);

    const data = await qb.getMany();

    return { data, total };
  }

  async findById(id: string): Promise<OAuthToken | null> {
    return this.tokenRepository.findOne({
      where: { id },
      relations: ['client'],
    });
  }

  async findByClient(clientId: string): Promise<OAuthToken[]> {
    return this.tokenRepository.find({
      where: { clientId },
      relations: ['client'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByUser(userId: string): Promise<OAuthToken[]> {
    return this.tokenRepository.find({
      where: { userId },
      relations: ['client'],
      order: { createdAt: 'DESC' },
    });
  }

  async revoke(id: string): Promise<OAuthToken> {
    const token = await this.findById(id);
    if (!token) {
      throw new NotFoundException('OAuth token not found');
    }

    if (token.revokedAt) {
      return token;
    }

    const revokedAt = new Date();
    await this.tokenRepository.update(id, { revokedAt });
    await this.cacheService.del(`${CacheKeyPrefix.OAUTH_TOKEN}:${token.accessToken}`);

    this.logger.log(`Revoked OAuth token: ${id}`);

    return { ...token, revokedAt };
  }

  async revokeByUser(userId: string): Promise<void> {
    const tokens = await this.findByUser(userId);

    for (const token of tokens) {
      if (!token.revokedAt) {
        await this.tokenRepository.update(token.id, { revokedAt: new Date() });
        await this.cacheService.del(`${CacheKeyPrefix.OAUTH_TOKEN}:${token.accessToken}`);
      }
    }

    this.logger.log(`Revoked ${tokens.length} tokens for user: ${userId}`);
  }

  async countByClientId(clientId: string): Promise<number> {
    return this.tokenRepository.count({
      where: { clientId },
    });
  }

  async batchRevoke(ids: string[]): Promise<BatchOperationResult> {
    if (ids.length > 100) {
      throw new BadRequestException('Cannot revoke more than 100 tokens at once');
    }

    const result: BatchOperationResult = {
      success: [],
      failed: [],
      errors: [],
    };

    for (const id of ids) {
      try {
        await this.revoke(id);
        result.success.push(id);
      } catch (error) {
        result.failed.push(id);
        result.errors.push(
          `Failed to revoke token ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    this.logger.log(
      `Batch revoke completed: ${result.success.length} succeeded, ${result.failed.length} failed`
    );

    return result;
  }

  toResponse(token: OAuthToken): OAuthTokenResponse {
    return {
      id: token.id,
      clientId: token.clientId,
      userId: token.userId,
      accessToken: token.accessToken,
      scopes: token.scopes,
      expiresAt: token.expiresAt,
      revokedAt: token.revokedAt,
      createdAt: token.createdAt,
    };
  }

  async export(query: OAuthTokenQueryDto): Promise<string> {
    const { data } = await this.list({ ...query, limit: 10000 });

    const headers = ['Access Token', 'Client ID', 'User ID', 'Scope', 'Expires At', 'Created At'];

    const rows = data.map((token) => [
      this.maskToken(token.accessToken),
      token.clientId,
      token.userId || '',
      token.scopes.join(';'),
      token.expiresAt.toISOString(),
      token.createdAt.toISOString(),
    ]);

    return [headers, ...rows].map((row) => row.join(',')).join('\n');
  }

  private maskToken(token: string): string {
    if (!token) return '';
    if (token.length <= 20) return '***';
    return `${token.slice(0, 10)}...${token.slice(-10)}`;
  }
}
