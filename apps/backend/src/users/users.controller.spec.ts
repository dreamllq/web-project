import { Test, TestingModule } from '@nestjs/testing';
import { UsersController, UserProfileResponse } from './users.controller';
import { UsersService } from './users.service';
import { User, UserStatus } from '../entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
      ],
    }).compile();

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
});
