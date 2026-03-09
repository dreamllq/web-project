import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SocialAccount, SocialAccountStatus } from '../entities/social-account.entity';
import { SocialProvider } from '../entities/social-provider.enum';
import { UsersService } from '../users/users.service';
import { LoginHistoryService } from '../users/services/login-history.service';
import {
  SocialAccountQueryDto,
  BatchOperationResult,
  SocialAccountDetail,
} from './dto/social-account.dto';

export interface SocialAccountResponse {
  id: string;
  userId: string;
  provider: SocialProvider;
  providerUserId: string;
  providerData: Record<string, unknown> | null;
  status: SocialAccountStatus;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class SocialAccountService {
  private readonly logger = new Logger(SocialAccountService.name);

  constructor(
    @InjectRepository(SocialAccount)
    private readonly socialAccountRepository: Repository<SocialAccount>,
    private readonly usersService: UsersService,
    private readonly loginHistoryService: LoginHistoryService
  ) {}

  async findById(id: string): Promise<SocialAccount | null> {
    return this.socialAccountRepository.findOne({
      where: { id },
      relations: ['user'],
    });
  }

  async findByUser(userId: string): Promise<SocialAccount[]> {
    return this.socialAccountRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByProvider(
    provider: SocialProvider,
    providerUserId: string
  ): Promise<SocialAccount | null> {
    return this.socialAccountRepository.findOne({
      where: { provider, providerUserId },
      relations: ['user'],
    });
  }

  async unlink(id: string): Promise<SocialAccount> {
    const socialAccount = await this.findById(id);
    if (!socialAccount) {
      throw new NotFoundException('Social account not found');
    }

    if (socialAccount.status === SocialAccountStatus.UNLINKED) {
      throw new BadRequestException('Social account already unlinked');
    }

    await this.socialAccountRepository.update(id, {
      status: SocialAccountStatus.UNLINKED,
      unboundAt: new Date(),
      accessToken: null,
      refreshToken: null,
    });

    this.logger.log(`Unlinked social account: ${id}`);

    return (await this.findById(id))!;
  }

  async refreshToken(id: string): Promise<SocialAccount> {
    const socialAccount = await this.findById(id);
    if (!socialAccount) {
      throw new NotFoundException('Social account not found');
    }

    if (socialAccount.status === SocialAccountStatus.UNLINKED) {
      throw new BadRequestException('Cannot refresh token for unlinked social account');
    }

    if (!socialAccount.refreshToken) {
      throw new BadRequestException('No refresh token available for this social account');
    }

    this.logger.warn(
      `Token refresh for social account ${id} requires provider-specific implementation`
    );

    throw new BadRequestException(
      'Token refresh requires provider-specific OAuth implementation. ' +
        'Please re-authenticate with the provider.'
    );
  }

  async updateTokens(
    id: string,
    accessToken: string,
    refreshToken?: string,
    expiresAt?: Date
  ): Promise<SocialAccount> {
    const socialAccount = await this.findById(id);
    if (!socialAccount) {
      throw new NotFoundException('Social account not found');
    }

    await this.socialAccountRepository.update(id, {
      accessToken,
      refreshToken: refreshToken ?? undefined,
      tokenExpiresAt: expiresAt ?? undefined,
    });

    return (await this.findById(id))!;
  }

  toResponse(socialAccount: SocialAccount): SocialAccountResponse {
    return {
      id: socialAccount.id,
      userId: socialAccount.userId,
      provider: socialAccount.provider,
      providerUserId: socialAccount.providerUserId,
      providerData: socialAccount.providerData,
      status: socialAccount.status,
      createdAt: socialAccount.createdAt,
      updatedAt: socialAccount.updatedAt,
    };
  }

  async list(query: SocialAccountQueryDto): Promise<{ data: SocialAccount[]; total: number }> {
    const qb = this.socialAccountRepository
      .createQueryBuilder('account')
      .leftJoinAndSelect('account.user', 'user');

    if (query.provider) {
      qb.andWhere('account.provider = :provider', { provider: query.provider });
    }

    if (query.userId) {
      qb.andWhere('account.userId = :userId', { userId: query.userId });
    }

    if (query.keyword) {
      qb.andWhere('(user.username ILIKE :keyword OR user.email ILIKE :keyword)', {
        keyword: `%${query.keyword}%`,
      });
    }

    qb.orderBy('account.createdAt', 'DESC');

    const total = await qb.getCount();

    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    qb.skip(offset).take(limit);

    const data = await qb.getMany();

    return { data, total };
  }

  async batchUnlink(ids: string[]): Promise<BatchOperationResult> {
    if (ids.length > 50) {
      throw new BadRequestException('Cannot unlink more than 50 accounts at once');
    }

    const result: BatchOperationResult = {
      success: [],
      failed: [],
      errors: [],
    };

    for (const id of ids) {
      try {
        const account = await this.findById(id);
        if (!account) {
          result.failed.push(id);
          result.errors.push(`Account ${id} not found`);
          continue;
        }

        const hasOtherAuth = await this.checkUserAuthenticationMethods(account.userId);
        if (!hasOtherAuth) {
          result.failed.push(id);
          result.errors.push(
            `Cannot unlink the only authentication method for user ${account.userId}`
          );
          continue;
        }

        await this.unlink(id);
        result.success.push(id);
      } catch (error: any) {
        result.failed.push(id);
        result.errors.push(`Failed to unlink ${id}: ${error.message}`);
      }
    }

    return result;
  }

  async getDetail(id: string): Promise<SocialAccountDetail> {
    const account = await this.findById(id);
    if (!account) {
      throw new NotFoundException('Social account not found');
    }

    const loginHistory = await this.loginHistoryService.getRecentLogins(account.userId, 10);

    return {
      id: account.id,
      userId: account.userId,
      provider: account.provider,
      providerUserId: account.providerUserId,
      providerData: account.providerData,
      status: account.status,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      user: {
        id: account.user.id,
        username: account.user.username,
        email: account.user.email,
      },
      loginHistory: {
        lastLoginAt: loginHistory[0]?.createdAt || null,
        lastLoginIp: loginHistory[0]?.ipAddress || null,
        loginCount: loginHistory.length,
      },
    };
  }

  private async checkUserAuthenticationMethods(userId: string): Promise<boolean> {
    const user = await this.usersService.findById(userId);
    if (!user) return false;

    if (user.passwordHash) return true;

    const otherAccountsCount = await this.socialAccountRepository.count({
      where: { userId, status: SocialAccountStatus.LINKED },
    });

    return otherAccountsCount > 1;
  }
}
