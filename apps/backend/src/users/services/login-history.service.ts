import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { LoginHistory, LoginMethod } from '../../entities/login-history.entity';

/**
 * Interface for login information to be recorded
 */
export interface LoginInfo {
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  loginMethod?: LoginMethod;
  success: boolean;
  failureReason?: string;
}

/**
 * Interface for querying login history with pagination and filtering
 */
export interface LoginHistoryQuery {
  limit?: number;
  offset?: number;
  success?: boolean;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Interface for paginated login history result
 */
export interface LoginHistoryResult {
  data: LoginHistory[];
  total: number;
  limit: number;
  offset: number;
}

@Injectable()
export class LoginHistoryService {
  constructor(
    @InjectRepository(LoginHistory)
    private loginHistoryRepository: Repository<LoginHistory>
  ) {}

  /**
   * Record a login attempt
   * @param userId - The user ID (can be null for failed login attempts with unknown user)
   * @param loginInfo - Login information including IP, user agent, success status, etc.
   * @returns The created login history record
   */
  async recordLogin(userId: string | null, loginInfo: LoginInfo): Promise<LoginHistory> {
    const loginRecord = this.loginHistoryRepository.create({
      userId,
      ipAddress: loginInfo.ipAddress || null,
      userAgent: loginInfo.userAgent || null,
      deviceFingerprint: loginInfo.deviceFingerprint || null,
      loginMethod: loginInfo.loginMethod || null,
      success: loginInfo.success,
      failureReason: loginInfo.failureReason || null,
    });

    return this.loginHistoryRepository.save(loginRecord);
  }

  /**
   * Get login history for a user with pagination and filtering
   * @param userId - The user ID to get history for
   * @param query - Query parameters for pagination and filtering
   * @returns Paginated login history result
   */
  async getLoginHistory(
    userId: string,
    query: LoginHistoryQuery = {}
  ): Promise<LoginHistoryResult> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const findOptions: FindManyOptions<LoginHistory> = {
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
      relations: ['user'],
    };

    // Apply filters
    if (query.success !== undefined) {
      findOptions.where = { ...findOptions.where, success: query.success };
    }

    if (query.startDate && query.endDate) {
      findOptions.where = {
        ...findOptions.where,
        createdAt: Between(query.startDate, query.endDate),
      };
    } else if (query.startDate) {
      findOptions.where = {
        ...findOptions.where,
        createdAt: MoreThanOrEqual(query.startDate),
      };
    } else if (query.endDate) {
      findOptions.where = {
        ...findOptions.where,
        createdAt: LessThanOrEqual(query.endDate),
      };
    }

    const [data, total] = await this.loginHistoryRepository.findAndCount(findOptions);

    return {
      data,
      total,
      limit,
      offset,
    };
  }

  /**
   * Get recent login records for a user
   * @param userId - The user ID to get recent logins for
   * @param limit - Maximum number of records to return (default: 10)
   * @returns Array of recent login history records
   */
  async getRecentLogins(userId: string, limit: number = 10): Promise<LoginHistory[]> {
    return this.loginHistoryRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['user'],
    });
  }

  /**
   * Get login statistics for a user
   * @param userId - The user ID to get statistics for
   * @returns Object with total logins, successful logins, failed logins counts
   */
  async getLoginStats(userId: string): Promise<{
    total: number;
    successful: number;
    failed: number;
  }> {
    const [total, successful] = await Promise.all([
      this.loginHistoryRepository.count({ where: { userId } }),
      this.loginHistoryRepository.count({ where: { userId, success: true } }),
    ]);

    return {
      total,
      successful,
      failed: total - successful,
    };
  }

  /**
   * Delete login history older than a specified date
   * @param olderThan - Delete records older than this date
   * @returns Number of deleted records
   */
  async deleteOldHistory(olderThan: Date): Promise<number> {
    const result = await this.loginHistoryRepository
      .createQueryBuilder()
      .delete()
      .where('createdAt < :olderThan', { olderThan })
      .execute();

    return result.affected ?? 0;
  }
}
