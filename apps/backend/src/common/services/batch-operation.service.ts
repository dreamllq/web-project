import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../../users/users.service';
import { SocialAccount, SocialAccountStatus } from '../../entities/social-account.entity';

export interface BatchOperationResult {
  success: string[];
  failed: string[];
  errors: string[];
}

@Injectable()
export class BatchOperationService {
  constructor(
    private readonly usersService: UsersService,
    @InjectRepository(SocialAccount)
    private readonly socialAccountRepository: Repository<SocialAccount>
  ) {}

  validateBatchSize(ids: string[], maxSize: number): void {
    if (ids.length > maxSize) {
      throw new BadRequestException(`Batch size exceeds maximum of ${maxSize}`);
    }
  }

  async processBatch<T>(
    ids: string[],
    processor: (id: string) => Promise<T>
  ): Promise<BatchOperationResult> {
    const result: BatchOperationResult = {
      success: [],
      failed: [],
      errors: [],
    };

    for (const id of ids) {
      try {
        await processor(id);
        result.success.push(id);
      } catch (error) {
        result.failed.push(id);
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push(`Failed to process ${id}: ${errorMessage}`);
      }
    }

    return result;
  }

  async checkUserAuthenticationMethods(userId: string): Promise<boolean> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      return false;
    }

    if (user.passwordHash) {
      return true;
    }

    const socialAccountsCount = await this.socialAccountRepository.count({
      where: {
        userId,
        status: SocialAccountStatus.LINKED,
      },
    });

    return socialAccountsCount > 0;
  }
}
