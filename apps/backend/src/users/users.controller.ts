import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Version,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../policy/guards/permission.guard';
import { RequirePermission } from '../policy/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserStatus } from '../entities/user.entity';
import {
  UpdateProfileDto,
  ChangePasswordDto,
  AdminCreateUserDto,
  AdminUpdateUserDto,
  AdminUserQueryDto,
} from './dto';
import type { StorageUrlResponse } from '../common/types/storage-url.dto';
import type { MultiStorageConfig } from '../config/storage.config';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth('JWT-auth')
export class UsersController {
  /**
   * User Management Endpoints
   *
   * Authorization: Admin endpoints require ABAC policy evaluation.
   * Permissions are checked via @RequirePermission decorator.
   * See docs/api-authentication.md for details on ABAC authorization.
   */
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

  // ========== Admin User Management Endpoints ==========

  /**
   * Admin: List users with pagination and search
   * GET /api/v1/users
   */
  @Get()
  @Version('1')
  @RequirePermission('user', 'read')
  @ApiOperation({ summary: 'Admin: Get list of users with pagination and search' })
  @ApiResponse({ status: 200, description: 'List of users with pagination info' })
  @ApiQuery({
    name: 'keyword',
    required: false,
    description: 'Search keyword (username, email, nickname)',
  })
  @ApiQuery({ name: 'status', required: false, enum: UserStatus, description: 'Filter by status' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of results per page',
    example: 20,
  })
  @ApiQuery({ name: 'offset', required: false, description: 'Offset for pagination', example: 0 })
  async adminListUsers(@Query() query: AdminUserQueryDto): Promise<AdminUserListResponse> {
    const { keyword, status, limit = 20, offset = 0 } = query;
    const { data, total } = await this.usersService.findAll({
      keyword,
      status,
      limit,
      offset,
    });
    return {
      data: data.map((user: User) => this.toAdminUserResponse(user)),
      pagination: { total, limit, offset },
    };
  }

  /**
   * Admin: Get user by ID
   * GET /api/v1/users/:id
   */
  @Get(':id')
  @Version('1')
  @RequirePermission('user', 'read')
  @ApiOperation({ summary: 'Admin: Get user details by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User details' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async adminGetUser(@Param('id', ParseUUIDPipe) id: string): Promise<AdminUserResponse> {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toAdminUserResponse(user);
  }

  /**
   * Admin: Create new user
   * POST /api/v1/users
   */
  @Post()
  @Version('1')
  @RequirePermission('user', 'create')
  @ApiOperation({ summary: 'Admin: Create a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 409, description: 'Username, email, or phone already exists' })
  async adminCreateUser(@Body() dto: AdminCreateUserDto): Promise<AdminUserResponse> {
    const user = await this.usersService.adminCreate(dto);
    return this.toAdminUserResponse(user);
  }

  /**
   * Admin: Update user
   * PATCH /api/v1/users/:id
   */
  @Patch(':id')
  @Version('1')
  @RequirePermission('user', 'update')
  @ApiOperation({ summary: 'Admin: Update user details' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async adminUpdateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateUserDto
  ): Promise<AdminUserResponse> {
    const user = await this.usersService.adminUpdate(id, dto);
    return this.toAdminUserResponse(user);
  }

  /**
   * Admin: Soft delete user
   * DELETE /api/v1/users/:id
   */
  @Delete(':id')
  @Version('1')
  @RequirePermission('user', 'delete')
  @ApiOperation({ summary: 'Admin: Soft delete user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async adminDeleteUser(
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<{ success: boolean; message: string }> {
    await this.usersService.softDelete(id);
    return {
      success: true,
      message: 'User deleted successfully',
    };
  }

  /**
   * Admin: Update user status
   * PATCH /api/v1/users/:id/status
   */
  @Patch(':id/status')
  @Version('1')
  @RequirePermission('user', 'update')
  @ApiOperation({ summary: 'Admin: Update user status (enable/disable/ban)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User status updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async adminUpdateUserStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status: UserStatus }
  ): Promise<AdminUserResponse> {
    const user = await this.usersService.adminUpdateStatus(id, body.status);
    return this.toAdminUserResponse(user);
  }

  // ========== Private Helper Methods ==========

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

  /**
   * Transform User entity to admin response (more fields than profile)
   */
  private toAdminUserResponse(user: User): AdminUserResponse {
    const storageConfig = this.configService.get<MultiStorageConfig>('storage');
    const storageType = storageConfig?.provider ?? 'local';

    // Transform avatarUrl to StorageUrlResponse
    let avatar: StorageUrlResponse;
    if (!user.avatarUrl) {
      avatar = { type: storageType };
    } else if (storageType === 'local') {
      avatar = { type: 'local', url: user.avatarUrl };
    } else {
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
      lastLoginAt: user.lastLoginAt,
      lastLoginIp: user.lastLoginIp,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
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

/**
 * Admin user response interface (more fields than profile)
 */
export interface AdminUserResponse {
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
  lastLoginAt: Date | null;
  lastLoginIp: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Admin user list response with pagination
 */
export interface AdminUserListResponse {
  data: AdminUserResponse[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}
