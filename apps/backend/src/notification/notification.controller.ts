import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { CreateNotificationDto, QueryNotificationDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { Notification } from '../entities/notification.entity';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Create a new notification (typically called by system/admin)
   * POST /api/notifications
   */
  @Post()
  async create(@Body() dto: CreateNotificationDto): Promise<Notification> {
    return this.notificationService.create(dto);
  }

  /**
   * List all notifications for the current user
   * GET /api/notifications
   */
  @Get()
  async findAll(
    @CurrentUser() user: User,
    @Query() query: QueryNotificationDto,
  ): Promise<{ data: Notification[]; total: number; page: number; limit: number }> {
    const { data, total } = await this.notificationService.findAll(user.id, query);
    return {
      data,
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    };
  }

  /**
   * Get unread notification count for the current user
   * GET /api/notifications/unread-count
   */
  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: User): Promise<{ count: number }> {
    const count = await this.notificationService.getUnreadCount(user.id);
    return { count };
  }

  /**
   * Get a specific notification by ID
   * GET /api/notifications/:id
   */
  @Get(':id')
  async findOne(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ): Promise<Notification> {
    return this.notificationService.findOne(user.id, id);
  }

  /**
   * Mark a notification as read
   * PUT /api/notifications/:id/read
   */
  @Put(':id/read')
  async markAsRead(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ): Promise<Notification> {
    return this.notificationService.markAsRead(user.id, id);
  }

  /**
   * Mark all notifications as read for the current user
   * PUT /api/notifications/read-all
   */
  @Put('read-all')
  async markAllAsRead(@CurrentUser() user: User): Promise<{ success: boolean }> {
    await this.notificationService.markAllAsRead(user.id);
    return { success: true };
  }
}
