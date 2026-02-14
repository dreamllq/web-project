import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { Notification, NotificationType } from '../entities/notification.entity';
import { User, UserStatus } from '../entities/user.entity';

describe('NotificationService', () => {
  let service: NotificationService;

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

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a notification successfully', async () => {
      const createDto = {
        userId: 'user-uuid',
        title: 'Test Notification',
        content: 'This is a test notification',
      };

      mockRepository.create.mockReturnValue(mockNotification);
      mockRepository.save.mockResolvedValue(mockNotification);

      const result = await service.create(createDto);

      expect(result).toEqual(mockNotification);
      expect(mockRepository.create).toHaveBeenCalledWith({
        userId: createDto.userId,
        type: NotificationType.SYSTEM,
        title: createDto.title,
        content: createDto.content,
        data: null,
        readAt: null,
      });
    });

    it('should create a notification with custom type and data', async () => {
      const createDto = {
        userId: 'user-uuid',
        type: NotificationType.SECURITY,
        title: 'Security Alert',
        content: 'New login detected',
        data: { ip: '127.0.0.1' },
      };

      mockRepository.create.mockReturnValue(mockNotification);
      mockRepository.save.mockResolvedValue(mockNotification);

      await service.create(createDto);

      expect(mockRepository.create).toHaveBeenCalledWith({
        userId: createDto.userId,
        type: NotificationType.SECURITY,
        title: createDto.title,
        content: createDto.content,
        data: createDto.data,
        readAt: null,
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated notifications for a user', async () => {
      mockRepository.findAndCount.mockResolvedValue([[mockNotification], 1]);

      const result = await service.findAll('user-uuid', {});

      expect(result).toEqual({ data: [mockNotification], total: 1 });
      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId: 'user-uuid' },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
      });
    });

    it('should filter by type', async () => {
      mockRepository.findAndCount.mockResolvedValue([[mockNotification], 1]);

      await service.findAll('user-uuid', { type: NotificationType.SYSTEM });

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-uuid', type: NotificationType.SYSTEM },
        }),
      );
    });

    it('should filter by unread status', async () => {
      mockRepository.findAndCount.mockResolvedValue([[mockNotification], 1]);

      await service.findAll('user-uuid', { unread: true });

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-uuid',
            readAt: expect.anything(),
          }),
        }),
      );
    });

    it('should apply pagination correctly', async () => {
      mockRepository.findAndCount.mockResolvedValue([[mockNotification], 50]);

      const result = await service.findAll('user-uuid', { page: 2, limit: 10 });

      expect(result).toEqual({ data: [mockNotification], total: 50 });
      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId: 'user-uuid' },
        order: { createdAt: 'DESC' },
        skip: 10,
        take: 10,
      });
    });
  });

  describe('findOne', () => {
    it('should return a notification by ID for the user', async () => {
      mockRepository.findOne.mockResolvedValue(mockNotification);

      const result = await service.findOne('user-uuid', 'notification-uuid');

      expect(result).toEqual(mockNotification);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'notification-uuid', userId: 'user-uuid' },
      });
    });

    it('should throw NotFoundException if notification not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('user-uuid', 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      const unreadNotification = { ...mockNotification, readAt: null };
      mockRepository.findOne.mockResolvedValue(unreadNotification);
      mockRepository.save.mockResolvedValue({
        ...unreadNotification,
        readAt: new Date(),
      });

      const result = await service.markAsRead('user-uuid', 'notification-uuid');

      expect(result.readAt).not.toBeNull();
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should not update if already read', async () => {
      const readNotification = { ...mockNotification, readAt: new Date() };
      mockRepository.findOne.mockResolvedValue(readNotification);

      const result = await service.markAsRead('user-uuid', 'notification-uuid');

      expect(result).toEqual(readNotification);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if notification not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.markAsRead('user-uuid', 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read for a user', async () => {
      mockRepository.update.mockResolvedValue({ affected: 5 });

      await service.markAllAsRead('user-uuid');

      expect(mockRepository.update).toHaveBeenCalledWith(
        { userId: 'user-uuid', readAt: expect.anything() },
        { readAt: expect.any(Date) },
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread notification count', async () => {
      mockRepository.count.mockResolvedValue(5);

      const result = await service.getUnreadCount('user-uuid');

      expect(result).toBe(5);
      expect(mockRepository.count).toHaveBeenCalledWith({
        where: { userId: 'user-uuid', readAt: expect.anything() },
      });
    });
  });

  describe('remove', () => {
    it('should delete a notification', async () => {
      mockRepository.findOne.mockResolvedValue(mockNotification);
      mockRepository.remove.mockResolvedValue(mockNotification);

      await service.remove('user-uuid', 'notification-uuid');

      expect(mockRepository.remove).toHaveBeenCalledWith(mockNotification);
    });

    it('should throw NotFoundException if notification not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.remove('user-uuid', 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
