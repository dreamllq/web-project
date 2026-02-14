import { Test, TestingModule } from '@nestjs/testing';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { Notification, NotificationType } from '../entities/notification.entity';
import { User, UserStatus } from '../entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('NotificationController', () => {
  let controller: NotificationController;

  const mockUser: User = {
    id: 'user-uuid',
    username: 'testuser',
    email: 'test@example.com',
    phone: null,
    passwordHash: 'hashed',
    nickname: null,
    avatarUrl: null,
    status: UserStatus.ACTIVE,
    locale: 'zh-CN',
    lastLoginAt: null,
    lastLoginIp: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    socialAccounts: [],
    notifications: [],
    files: [],
    oauthTokens: [],
  };

  const mockNotification: Notification = {
    id: 'notification-uuid',
    userId: 'user-uuid',
    type: NotificationType.SYSTEM,
    title: 'Test Notification',
    content: 'This is a test notification',
    data: null,
    readAt: null,
    createdAt: new Date(),
    user: mockUser,
  };

  const mockNotificationService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    getUnreadCount: jest.fn(),
  };

  // Mock JwtAuthGuard to bypass authentication in tests
  const mockJwtAuthGuard = { canActivate: jest.fn().mockReturnValue(true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    controller = module.get<NotificationController>(NotificationController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a notification', async () => {
      const createDto = {
        userId: 'user-uuid',
        title: 'Test Notification',
        content: 'This is a test notification',
      };

      mockNotificationService.create.mockResolvedValue(mockNotification);

      const result = await controller.create(createDto);

      expect(result).toEqual(mockNotification);
      expect(mockNotificationService.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findAll', () => {
    it('should return paginated notifications for the current user', async () => {
      mockNotificationService.findAll.mockResolvedValue({
        data: [mockNotification],
        total: 1,
      });

      const result = await controller.findAll(mockUser, {});

      expect(result).toEqual({
        data: [mockNotification],
        total: 1,
        page: 1,
        limit: 20,
      });
      expect(mockNotificationService.findAll).toHaveBeenCalledWith('user-uuid', {});
    });

    it('should use custom pagination values', async () => {
      mockNotificationService.findAll.mockResolvedValue({
        data: [mockNotification],
        total: 50,
      });

      const result = await controller.findAll(mockUser, { page: 2, limit: 10 });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(mockNotificationService.findAll).toHaveBeenCalledWith('user-uuid', {
        page: 2,
        limit: 10,
      });
    });

    it('should pass query filters to service', async () => {
      mockNotificationService.findAll.mockResolvedValue({
        data: [mockNotification],
        total: 1,
      });

      const query = { unread: true, type: NotificationType.SYSTEM };

      await controller.findAll(mockUser, query);

      expect(mockNotificationService.findAll).toHaveBeenCalledWith('user-uuid', query);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread notification count', async () => {
      mockNotificationService.getUnreadCount.mockResolvedValue(5);

      const result = await controller.getUnreadCount(mockUser);

      expect(result).toEqual({ count: 5 });
      expect(mockNotificationService.getUnreadCount).toHaveBeenCalledWith('user-uuid');
    });
  });

  describe('findOne', () => {
    it('should return a notification by ID', async () => {
      mockNotificationService.findOne.mockResolvedValue(mockNotification);

      const result = await controller.findOne(mockUser, 'notification-uuid');

      expect(result).toEqual(mockNotification);
      expect(mockNotificationService.findOne).toHaveBeenCalledWith(
        'user-uuid',
        'notification-uuid',
      );
    });

    it('should propagate NotFoundException from service', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      mockNotificationService.findOne.mockRejectedValue(
        new NotFoundException('Not found'),
      );

      await expect(
        controller.findOne(mockUser, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      const readNotification = { ...mockNotification, readAt: new Date() };
      mockNotificationService.markAsRead.mockResolvedValue(readNotification);

      const result = await controller.markAsRead(mockUser, 'notification-uuid');

      expect(result).toEqual(readNotification);
      expect(mockNotificationService.markAsRead).toHaveBeenCalledWith(
        'user-uuid',
        'notification-uuid',
      );
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      mockNotificationService.markAllAsRead.mockResolvedValue(undefined);

      const result = await controller.markAllAsRead(mockUser);

      expect(result).toEqual({ success: true });
      expect(mockNotificationService.markAllAsRead).toHaveBeenCalledWith('user-uuid');
    });
  });
});
