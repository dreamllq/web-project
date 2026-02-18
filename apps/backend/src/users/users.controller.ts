import { Controller, Get, Patch, Delete, Body, UseGuards, Version } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserStatus } from '../entities/user.entity';
import { UpdateProfileDto, ChangePasswordDto } from './dto';
import type { StorageUrlResponse } from '../common/types/storage-url.dto';
import type { MultiStorageConfig } from '../config/storage.config';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Get current user info
   * GET /api/v1/users/me
   */
  @Get('me')
  @Version('1')
  async getCurrentUser(@CurrentUser() user: User): Promise<UserProfileResponse> {
    // Return user without sensitive fields
    return this.toUserProfileResponse(user);
  }

  /**
   * Update user profile (nickname, locale)
   * PATCH /api/v1/users/me
   */
  @Patch('me')
  @Version('1')
  async updateProfile(
    @CurrentUser() user: User,
    @Body() updateProfileDto: UpdateProfileDto
  ): Promise<{ success: boolean; user: UserProfileResponse }> {
    const updatedUser = await this.usersService.updateProfile(user.id, updateProfileDto);
    return {
      success: true,
      user: this.toUserProfileResponse(updatedUser),
    };
  }

  /**
   * Change password
   * PATCH /api/v1/users/me/password
   */
  @Patch('me/password')
  @Version('1')
  async changePassword(
    @CurrentUser() user: User,
    @Body() changePasswordDto: ChangePasswordDto
  ): Promise<{ success: boolean; message: string }> {
    await this.usersService.changePassword(
      user.id,
      changePasswordDto.oldPassword,
      changePasswordDto.newPassword
    );
    return {
      success: true,
      message: 'Password changed successfully',
    };
  }

  /**
   * Soft delete account
   * DELETE /api/v1/users/me
   */
  @Delete('me')
  @Version('1')
  async softDeleteAccount(
    @CurrentUser() user: User
  ): Promise<{ success: boolean; message: string }> {
    await this.usersService.softDelete(user.id);
    return {
      success: true,
      message: 'Account deleted successfully',
    };
  }

  /**
   * Transform User entity to profile response (exclude sensitive fields)
   */
  private toUserProfileResponse(user: User): UserProfileResponse {
    const storageConfig = this.configService.get<MultiStorageConfig>('storage');
    const storageType = storageConfig?.provider ?? 'local';

    // Transform avatarUrl to StorageUrlResponse
    let avatar: StorageUrlResponse;
    if (!user.avatarUrl) {
      avatar = { type: storageType };
    } else if (storageType === 'local') {
      // Local storage: return direct URL
      avatar = { type: 'local', url: user.avatarUrl };
    } else {
      // S3/MinIO: return key (avatarUrl stores the key)
      avatar = { type: storageType, key: user.avatarUrl };
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      nickname: user.nickname,
      avatar,
      status: user.status,
      locale: user.locale,
      emailVerifiedAt: user.emailVerifiedAt,
      phoneVerifiedAt: user.phoneVerifiedAt,
      createdAt: user.createdAt,
    };
  }
}

/**
 * User profile response interface (no sensitive fields)
 */
export interface UserProfileResponse {
  id: string;
  username: string;
  email: string | null;
  phone: string | null;
  nickname: string | null;
  avatar: StorageUrlResponse;
  status: UserStatus;
  locale: string;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
  createdAt: Date;
}
