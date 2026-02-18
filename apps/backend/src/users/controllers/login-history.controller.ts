import { Controller, Get, Query, UseGuards, Version } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../entities/user.entity';
import { LoginHistoryService, LoginHistoryQuery } from '../services/login-history.service';
import { LoginHistoryQueryDto } from '../dto';

@Controller('users/me/login-history')
@UseGuards(JwtAuthGuard)
export class LoginHistoryController {
  constructor(private readonly loginHistoryService: LoginHistoryService) {}

  /**
   * Get login history for the current user
   * GET /api/v1/users/me/login-history
   */
  @Get()
  @Version('1')
  async getLoginHistory(
    @CurrentUser() user: User,
    @Query() query: LoginHistoryQueryDto
  ): Promise<LoginHistoryResponse> {
    const loginQuery: LoginHistoryQuery = {
      limit: query.limit,
      offset: query.offset,
      success: query.success,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    };

    const result = await this.loginHistoryService.getLoginHistory(user.id, loginQuery);

    return {
      data: result.data.map((record) => this.toLoginHistoryItem(record)),
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
    };
  }

  /**
   * Transform LoginHistory entity to response item
   */
  private toLoginHistoryItem(
    record: import('../../entities/login-history.entity').LoginHistory
  ): LoginHistoryItem {
    return {
      id: record.id,
      ipAddress: record.ipAddress,
      userAgent: record.userAgent,
      deviceFingerprint: record.deviceFingerprint,
      loginMethod: record.loginMethod,
      success: record.success,
      failureReason: record.failureReason,
      createdAt: record.createdAt.toISOString(),
    };
  }
}

/**
 * Login history item in response
 */
export interface LoginHistoryItem {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  deviceFingerprint: string | null;
  loginMethod: string | null;
  success: boolean;
  failureReason: string | null;
  createdAt: string;
}

/**
 * Login history response with pagination
 */
export interface LoginHistoryResponse {
  data: LoginHistoryItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}
