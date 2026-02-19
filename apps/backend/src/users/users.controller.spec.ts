import { Test, TestingModule } from '@nestjs/testing';
import {
  UsersController,
  UserProfileResponse,
  AdminUserResponse,
  AdminUserListResponse,
} from './users.controller';
import { UsersService } from './users.service';
import { User, UserStatus } from '../entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import {
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
  ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../policy/guards/permission.guard';
import { Reflector } from '@nestjs/core';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUser: User = {
    id: 'user-uuid-123',
    username: 'testuser',
    email: 'test@example.com',
    phone: '+1234567890',
    passwordHash: 'hashedpassword',
    nickname: 'Test User',
    avatarUrl: 'http://example.com/avatar.jpg',
    status: UserStatus.ACTIVE,
    locale: 'zh-CN',
    lastLoginAt: new Date(),
    lastLoginIp: '192.168.1.1',
    emailVerifiedAt: new Date(),
    phoneVerifiedAt: null,
    mfaEnabled: false,
    mfaSecret: null,
    recoveryCodes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    socialAccounts: [],
    notifications: [],
    files: [],
    oauthTokens: [],
    verificationTokens: [],
    roles: [],
  };

  const mockUsersService = {
    findById: jest.fn(),
    updateProfile: jest.fn(),
    changePassword: jest.fn(),
    softDelete: jest.fn(),
    // Admin endpoints
    findAll: jest.fn(),
    adminCreate: jest.fn(),
    adminUpdate: jest.fn(),
    updateStatus: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue({
      provider: 'local',
      s3: {
        endpoint: '',
        region: 'us-east-1',
        bucket: 'test-bucket',
        accessKeyId: 'test',
        secretAccessKey: 'test',
        forcePathStyle: false,
      },
      minio: {
        endpoint: '',
        accessKey: '',
        secretKey: '',
        bucket: '',
        useSSL: false,
      },
      local: {
        uploadDir: './uploads',
        baseUrl: 'http://localhost:3000/uploads',
      },
      accessKeyId: '',
      secretAccessKey: '',
      region: 'us-east-1',
      bucket: '',
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = mockUser;
          return true;
        },
      })
      .overrideGuard(PermissionGuard)
      .useValue({
        canActivate: () => true,
      })
      .compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCurrentUser', () => {
    it('should return user profile without sensitive fields', async () => {
      const result = await controller.getCurrentUser(mockUser);

      expect(result).toEqual({
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        phone: mockUser.phone,
        nickname: mockUser.nickname,
        avatar: {
          type: 'local',
          url: mockUser.avatarUrl,
        },
        status: mockUser.status,
        locale: mockUser.locale,
        emailVerifiedAt: mockUser.emailVerifiedAt,
        phoneVerifiedAt: mockUser.phoneVerifiedAt,
        createdAt: mockUser.createdAt,
      });

      // Ensure passwordHash is not included
      expect((result as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
    });
  });

  describe('updateProfile', () => {
    const updateDto: UpdateProfileDto = {
      nickname: 'New Nickname',
      locale: 'en-US',
    };

    it('should update user profile and return updated user', async () => {
      const updatedUser = { ...mockUser, nickname: 'New Nickname', locale: 'en-US' };
      mockUsersService.updateProfile.mockResolvedValue(updatedUser);

      const result = await controller.updateProfile(mockUser, updateDto);

      expect(result).toEqual({
        success: true,
        user: expect.objectContaining({
          id: mockUser.id,
          nickname: 'New Nickname',
          locale: 'en-US',
        }),
      });
      expect(service.updateProfile).toHaveBeenCalledWith(mockUser.id, updateDto);
    });

    it('should update only nickname', async () => {
      const dto: UpdateProfileDto = { nickname: 'Only Nickname' };
      const updatedUser = { ...mockUser, nickname: 'Only Nickname' };
      mockUsersService.updateProfile.mockResolvedValue(updatedUser);

      const result = await controller.updateProfile(mockUser, dto);

      expect(result.success).toBe(true);
      expect(result.user.nickname).toBe('Only Nickname');
      expect(service.updateProfile).toHaveBeenCalledWith(mockUser.id, dto);
    });

    it('should update only locale', async () => {
      const dto: UpdateProfileDto = { locale: 'ja-JP' };
      const updatedUser = { ...mockUser, locale: 'ja-JP' };
      mockUsersService.updateProfile.mockResolvedValue(updatedUser);

      const result = await controller.updateProfile(mockUser, dto);

      expect(result.success).toBe(true);
      expect(result.user.locale).toBe('ja-JP');
      expect(service.updateProfile).toHaveBeenCalledWith(mockUser.id, dto);
    });

    it('should throw BadRequestException if user not found', async () => {
      mockUsersService.updateProfile.mockRejectedValue(new BadRequestException('User not found'));

      await expect(controller.updateProfile(mockUser, updateDto)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('changePassword', () => {
    const changePasswordDto: ChangePasswordDto = {
      oldPassword: 'OldPassword123',
      newPassword: 'NewPassword123',
    };

    it('should change password successfully', async () => {
      mockUsersService.changePassword.mockResolvedValue(undefined);

      const result = await controller.changePassword(mockUser, changePasswordDto);

      expect(result).toEqual({
        success: true,
        message: 'Password changed successfully',
      });
      expect(service.changePassword).toHaveBeenCalledWith(
        mockUser.id,
        changePasswordDto.oldPassword,
        changePasswordDto.newPassword
      );
    });

    it('should throw UnauthorizedException if old password is incorrect', async () => {
      mockUsersService.changePassword.mockRejectedValue(
        new UnauthorizedException('Invalid old password')
      );

      await expect(controller.changePassword(mockUser, changePasswordDto)).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should throw BadRequestException if user not found', async () => {
      mockUsersService.changePassword.mockRejectedValue(new BadRequestException('User not found'));

      await expect(controller.changePassword(mockUser, changePasswordDto)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('softDeleteAccount', () => {
    it('should soft delete account successfully', async () => {
      mockUsersService.softDelete.mockResolvedValue(undefined);

      const result = await controller.softDeleteAccount(mockUser);

      expect(result).toEqual({
        success: true,
        message: 'Account deleted successfully',
      });
      expect(service.softDelete).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw BadRequestException if user not found', async () => {
      mockUsersService.softDelete.mockRejectedValue(new BadRequestException('User not found'));

      await expect(controller.softDeleteAccount(mockUser)).rejects.toThrow(BadRequestException);
    });
  });

  describe('toUserProfileResponse', () => {
    it('should exclude passwordHash from response', async () => {
      const result = await controller.getCurrentUser(mockUser);

      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should include all expected fields', async () => {
      const result = await controller.getCurrentUser(mockUser);

      const expectedFields: (keyof UserProfileResponse)[] = [
        'id',
        'username',
        'email',
        'phone',
        'nickname',
        'avatar',
        'status',
        'locale',
        'emailVerifiedAt',
        'phoneVerifiedAt',
        'createdAt',
      ];

      expectedFields.forEach((field) => {
        expect(result).toHaveProperty(field);
      });
    });

    it('should handle null values correctly', async () => {
      const userWithNulls: User = {
        ...mockUser,
        email: null,
        phone: null,
        nickname: null,
        avatarUrl: null,
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
      };

      const result = await controller.getCurrentUser(userWithNulls);

      expect(result.email).toBeNull();
      expect(result.phone).toBeNull();
      expect(result.nickname).toBeNull();
      expect(result.avatar).toEqual({ type: 'local' });
      expect(result.emailVerifiedAt).toBeNull();
      expect(result.phoneVerifiedAt).toBeNull();
    });
  });

  // ==================== Admin User Management Tests ====================

  describe('adminListUsers', () => {
    it('should return paginated list of users', async () => {
      const query: AdminUserQueryDto = { limit: 20, offset: 0 };
      const mockResult = {
        data: [mockUser],
        total: 1,
      };
      mockUsersService.findAll.mockResolvedValue(mockResult);

      const result = await controller.adminListUsers(query);

      expect(result).toEqual<AdminUserListResponse>({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: mockUser.id,
            username: mockUser.username,
          }),
        ]),
        pagination: { total: 1, limit: 20, offset: 0 },
      });
      expect(service.findAll).toHaveBeenCalledWith({
        keyword: undefined,
        status: undefined,
        limit: 20,
        offset: 0,
      });
    });

    it('should filter users by keyword', async () => {
      const query: AdminUserQueryDto = { keyword: 'test', limit: 20, offset: 0 };
      const mockResult = {
        data: [mockUser],
        total: 1,
      };
      mockUsersService.findAll.mockResolvedValue(mockResult);

      const result = await controller.adminListUsers(query);

      expect(service.findAll).toHaveBeenCalledWith({
        keyword: 'test',
        status: undefined,
        limit: 20,
        offset: 0,
      });
      expect(result.data).toHaveLength(1);
    });

    it('should filter users by status', async () => {
      const query: AdminUserQueryDto = {
        status: UserStatus.ACTIVE,
        limit: 20,
        offset: 0,
      };
      const mockResult = {
        data: [mockUser],
        total: 1,
      };
      mockUsersService.findAll.mockResolvedValue(mockResult);

      const result = await controller.adminListUsers(query);

      expect(service.findAll).toHaveBeenCalledWith({
        keyword: undefined,
        status: UserStatus.ACTIVE,
        limit: 20,
        offset: 0,
      });
      expect(result.data[0].status).toBe(UserStatus.ACTIVE);
    });

    it('should apply pagination with custom limit and offset', async () => {
      const query: AdminUserQueryDto = { limit: 10, offset: 20 };
      mockUsersService.findAll.mockResolvedValue({ data: [], total: 100 });

      await controller.adminListUsers(query);

      expect(service.findAll).toHaveBeenCalledWith({
        keyword: undefined,
        status: undefined,
        limit: 10,
        offset: 20,
      });
    });

    it('should return empty array when no users found', async () => {
      const query: AdminUserQueryDto = { keyword: 'nonexistent', limit: 20, offset: 0 };
      mockUsersService.findAll.mockResolvedValue({ data: [], total: 0 });

      const result = await controller.adminListUsers(query);

      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe('adminGetUser', () => {
    it('should return user by ID', async () => {
      mockUsersService.findById.mockResolvedValue(mockUser);

      const result = await controller.adminGetUser(mockUser.id);

      expect(result).toEqual<AdminUserResponse>(
        expect.objectContaining({
          id: mockUser.id,
          username: mockUser.username,
          email: mockUser.email,
          status: mockUser.status,
        })
      );
      expect(service.findById).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUsersService.findById.mockResolvedValue(null);

      await expect(controller.adminGetUser('non-existent-uuid')).rejects.toThrow(NotFoundException);
    });

    it('should include admin-visible fields in response', async () => {
      mockUsersService.findById.mockResolvedValue(mockUser);

      const result = await controller.adminGetUser(mockUser.id);

      expect(result).toHaveProperty('lastLoginAt');
      expect(result).toHaveProperty('lastLoginIp');
      expect(result).toHaveProperty('updatedAt');
      expect(result).toHaveProperty('deletedAt');
    });
  });

  describe('adminCreateUser', () => {
    const createDto: AdminCreateUserDto = {
      username: 'newuser',
      password: 'SecurePass123',
      email: 'newuser@example.com',
      nickname: 'New User',
      status: UserStatus.ACTIVE,
    };

    it('should create user with valid data', async () => {
      const newUser = { ...mockUser, id: 'new-uuid', ...createDto };
      mockUsersService.adminCreate.mockResolvedValue(newUser);

      const result = await controller.adminCreateUser(createDto);

      expect(result).toEqual<AdminUserResponse>(
        expect.objectContaining({
          username: 'newuser',
          email: 'newuser@example.com',
          nickname: 'New User',
          status: UserStatus.ACTIVE,
        })
      );
      expect(service.adminCreate).toHaveBeenCalledWith(createDto);
    });

    it('should throw ConflictException for duplicate username', async () => {
      mockUsersService.adminCreate.mockRejectedValue(
        new ConflictException('Username already exists')
      );

      await expect(controller.adminCreateUser(createDto)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException for duplicate email', async () => {
      mockUsersService.adminCreate.mockRejectedValue(new ConflictException('Email already exists'));

      await expect(
        controller.adminCreateUser({ ...createDto, email: 'existing@example.com' })
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException for duplicate phone', async () => {
      mockUsersService.adminCreate.mockRejectedValue(new ConflictException('Phone already exists'));

      await expect(
        controller.adminCreateUser({ ...createDto, phone: '+1234567890' })
      ).rejects.toThrow(ConflictException);
    });

    it('should create user with minimal required fields', async () => {
      const minimalDto: AdminCreateUserDto = {
        username: 'minimaluser',
        password: 'SecurePass123',
      };
      const newUser = { ...mockUser, id: 'minimal-uuid', username: 'minimaluser' };
      mockUsersService.adminCreate.mockResolvedValue(newUser);

      const result = await controller.adminCreateUser(minimalDto);

      expect(result.username).toBe('minimaluser');
      expect(service.adminCreate).toHaveBeenCalledWith(minimalDto);
    });
  });

  describe('adminUpdateUser', () => {
    const updateDto: AdminUpdateUserDto = {
      nickname: 'Updated Name',
      status: UserStatus.ACTIVE,
    };

    it('should update user with valid data', async () => {
      const updatedUser = { ...mockUser, ...updateDto };
      mockUsersService.adminUpdate.mockResolvedValue(updatedUser);

      const result = await controller.adminUpdateUser(mockUser.id, updateDto);

      expect(result.nickname).toBe('Updated Name');
      expect(result.status).toBe(UserStatus.ACTIVE);
      expect(service.adminUpdate).toHaveBeenCalledWith(mockUser.id, updateDto);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUsersService.adminUpdate.mockRejectedValue(new NotFoundException('User not found'));

      await expect(controller.adminUpdateUser('non-existent-uuid', updateDto)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ConflictException for duplicate email', async () => {
      mockUsersService.adminUpdate.mockRejectedValue(new ConflictException('Email already exists'));

      await expect(
        controller.adminUpdateUser(mockUser.id, { email: 'existing@example.com' })
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException for duplicate phone', async () => {
      mockUsersService.adminUpdate.mockRejectedValue(new ConflictException('Phone already exists'));

      await expect(
        controller.adminUpdateUser(mockUser.id, { phone: '+9999999999' })
      ).rejects.toThrow(ConflictException);
    });

    it('should update only provided fields', async () => {
      const partialDto: AdminUpdateUserDto = { nickname: 'Only Nickname' };
      const updatedUser = { ...mockUser, nickname: 'Only Nickname' };
      mockUsersService.adminUpdate.mockResolvedValue(updatedUser);

      const result = await controller.adminUpdateUser(mockUser.id, partialDto);

      expect(result.nickname).toBe('Only Nickname');
      expect(result.email).toBe(mockUser.email); // unchanged
    });
  });

  describe('adminDeleteUser', () => {
    it('should soft delete user successfully', async () => {
      mockUsersService.softDelete.mockResolvedValue(undefined);

      const result = await controller.adminDeleteUser(mockUser.id);

      expect(result).toEqual({
        success: true,
        message: 'User deleted successfully',
      });
      expect(service.softDelete).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw BadRequestException when user not found', async () => {
      mockUsersService.softDelete.mockRejectedValue(new BadRequestException('User not found'));

      await expect(controller.adminDeleteUser('non-existent-uuid')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('adminUpdateUserStatus', () => {
    it('should update user status to ACTIVE', async () => {
      mockUsersService.updateStatus.mockResolvedValue(undefined);
      const updatedUser = { ...mockUser, status: UserStatus.ACTIVE };
      mockUsersService.findById.mockResolvedValue(updatedUser);

      const result = await controller.adminUpdateUserStatus(mockUser.id, {
        status: UserStatus.ACTIVE,
      });

      expect(result.status).toBe(UserStatus.ACTIVE);
      expect(service.updateStatus).toHaveBeenCalledWith(mockUser.id, UserStatus.ACTIVE);
    });

    it('should update user status to DISABLED', async () => {
      mockUsersService.updateStatus.mockResolvedValue(undefined);
      const updatedUser = { ...mockUser, status: UserStatus.DISABLED };
      mockUsersService.findById.mockResolvedValue(updatedUser);

      const result = await controller.adminUpdateUserStatus(mockUser.id, {
        status: UserStatus.DISABLED,
      });

      expect(result.status).toBe(UserStatus.DISABLED);
    });

    it('should update user status to PENDING', async () => {
      mockUsersService.updateStatus.mockResolvedValue(undefined);
      const updatedUser = { ...mockUser, status: UserStatus.PENDING };
      mockUsersService.findById.mockResolvedValue(updatedUser);

      const result = await controller.adminUpdateUserStatus(mockUser.id, {
        status: UserStatus.PENDING,
      });

      expect(result.status).toBe(UserStatus.PENDING);
    });

    it('should throw NotFoundException when user not found after update', async () => {
      mockUsersService.updateStatus.mockResolvedValue(undefined);
      mockUsersService.findById.mockResolvedValue(null);

      await expect(
        controller.adminUpdateUserStatus(mockUser.id, { status: UserStatus.ACTIVE })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('toAdminUserResponse', () => {
    it('should transform user entity to admin response with all fields', async () => {
      mockUsersService.findById.mockResolvedValue(mockUser);

      const result = await controller.adminGetUser(mockUser.id);

      // Verify all expected fields are present
      const expectedFields = [
        'id',
        'username',
        'email',
        'phone',
        'nickname',
        'avatar',
        'status',
        'locale',
        'lastLoginAt',
        'lastLoginIp',
        'emailVerifiedAt',
        'phoneVerifiedAt',
        'createdAt',
        'updatedAt',
        'deletedAt',
      ];

      expectedFields.forEach((field) => {
        expect(result).toHaveProperty(field);
      });

      // Verify sensitive fields are not included
      expect((result as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
      expect((result as unknown as Record<string, unknown>).mfaSecret).toBeUndefined();
    });

    it('should handle null values in admin response', async () => {
      const userWithNulls: User = {
        ...mockUser,
        email: null,
        phone: null,
        nickname: null,
        avatarUrl: null,
        lastLoginAt: null,
        lastLoginIp: null,
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
        deletedAt: null,
      };
      mockUsersService.findById.mockResolvedValue(userWithNulls);

      const result = await controller.adminGetUser(mockUser.id);

      expect(result.email).toBeNull();
      expect(result.phone).toBeNull();
      expect(result.nickname).toBeNull();
      expect(result.lastLoginAt).toBeNull();
      expect(result.lastLoginIp).toBeNull();
      expect(result.deletedAt).toBeNull();
    });
  });
});
