import { Controller, Get, Patch, Delete, Body, UseGuards, Version } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserStatus } from '../entities/user.entity';
import { UpdateProfileDto, ChangePasswordDto } from './dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
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
  avatarUrl: string | null;
  status: UserStatus;
  locale: string;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
  createdAt: Date;
}
