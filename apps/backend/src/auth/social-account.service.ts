import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SocialAccount, SocialAccountStatus } from '../entities/social-account.entity';
import { SocialProvider } from '../entities/social-provider.enum';

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
    private readonly socialAccountRepository: Repository<SocialAccount>
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
}
