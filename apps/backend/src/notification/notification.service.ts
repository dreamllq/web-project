import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, IsNull, Not } from 'typeorm';
import { Notification, NotificationType } from '../entities/notification.entity';
import { CreateNotificationDto, QueryNotificationDto } from './dto';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  /**
   * Create a new notification for a user
   */
  async create(dto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationRepo.create({
      userId: dto.userId,
      type: dto.type ?? NotificationType.SYSTEM,
      title: dto.title,
      content: dto.content,
      data: dto.data ?? null,
      readAt: null,
    });

    return this.notificationRepo.save(notification);
  }

  /**
   * Find all notifications for a user with filtering and pagination
   */
  async findAll(
    userId: string,
    query: QueryNotificationDto,
  ): Promise<{ data: Notification[]; total: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<Notification> = { userId };

    if (query.type) {
      where.type = query.type;
    }

    // Filter by unread status
    if (query.unread === true) {
      where.readAt = IsNull();
    } else if (query.unread === false) {
      where.readAt = Not(IsNull());
    }

    const [data, total] = await this.notificationRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return { data, total };
  }

  /**
   * Find a single notification by ID for a specific user
   */
  async findOne(userId: string, id: string): Promise<Notification> {
    const notification = await this.notificationRepo.findOne({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException(`Notification with ID "${id}" not found`);
    }

    return notification;
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(userId: string, id: string): Promise<Notification> {
    const notification = await this.findOne(userId, id);

    // Verify ownership
    if (notification.userId !== userId) {
      throw new ForbiddenException('You do not have access to this notification');
    }

    // Only update if not already read
    if (!notification.readAt) {
      notification.readAt = new Date();
      return this.notificationRepo.save(notification);
    }

    return notification;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepo.update(
      { userId, readAt: IsNull() },
      { readAt: new Date() },
    );
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepo.count({
      where: { userId, readAt: IsNull() },
    });
  }

  /**
   * Delete a notification (optional utility method)
   */
  async remove(userId: string, id: string): Promise<void> {
    const notification = await this.findOne(userId, id);

    if (notification.userId !== userId) {
      throw new ForbiddenException('You do not have access to this notification');
    }

    await this.notificationRepo.remove(notification);
  }
}
