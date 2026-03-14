import { Processor, Process, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { NotificationService } from '../../notification/notification.service';
import { NotificationType } from '../../entities/notification.entity';
import { MESSAGE_QUEUE } from '../../queue/queue.module';
import { ChatJobData } from '../chat.service';
import { PresenceService } from '../services/presence.service';
import { RoomService } from '../services/room.service';

/**
 * 消息队列处理器
 *
 * 处理 `chat-message` 队列中的任务:
 * - send_message: 为离线用户创建通知
 * - edit_message: 通知消息编辑
 * - recall_message: 通知消息撤回
 * - mark_read: 处理已读回执
 *
 * 失败重试配置: 3次 (在 QueueModule 中配置)
 */
@Processor(MESSAGE_QUEUE)
export class MessageProcessor {
  private readonly logger = new Logger(MessageProcessor.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly presenceService: PresenceService,
    private readonly roomService: RoomService
  ) {}

  /**
   * 处理发送消息任务
   *
   * 为房间中离线的成员创建推送通知
   */
  @Process('send_message')
  async handleSendMessage(job: Job<ChatJobData>): Promise<void> {
    const { messageId, roomId, userId, content, messageType } = job.data;

    this.logger.debug(
      `Processing send_message: messageId=${messageId}, roomId=${roomId}, senderId=${userId}`
    );

    // 验证必要字段
    if (!roomId || !userId) {
      this.logger.warn('Missing required fields in send_message job');
      return;
    }

    // 获取房间所有成员
    const members = await this.roomService.getMembers(roomId);
    const memberIds = members.map((m) => m.userId);

    // 排除发送者
    const recipientIds = memberIds.filter((id) => id !== userId);

    if (recipientIds.length === 0) {
      this.logger.debug('No recipients to notify');
      return;
    }

    // 检查哪些用户离线
    const onlineStatuses = await this.presenceService.getOnlineUsers(recipientIds);
    const onlineUserIds = new Set(onlineStatuses.filter((s) => s.isOnline).map((s) => s.userId));

    // 为离线用户创建通知
    const offlineUserIds = recipientIds.filter((id) => !onlineUserIds.has(id));

    if (offlineUserIds.length === 0) {
      this.logger.debug('All recipients are online, skipping notifications');
      return;
    }

    // 批量创建通知
    const notificationPromises = offlineUserIds.map((recipientId) =>
      this.notificationService.create({
        userId: recipientId,
        type: NotificationType.MESSAGE,
        title: '新消息',
        content: this.truncateContent(content ?? ''),
        data: {
          messageId,
          roomId,
          senderId: userId,
          messageType,
        },
      })
    );

    await Promise.all(notificationPromises);

    this.logger.debug(`Created notifications for ${offlineUserIds.length} offline users`);
  }

  /**
   * 处理编辑消息任务
   *
   * 目前仅记录日志，实际通知通过 WebSocket 实时推送
   */
  @Process('edit_message')
  async handleEditMessage(job: Job<ChatJobData>): Promise<void> {
    const { messageId, roomId, userId } = job.data;

    this.logger.debug(
      `Processing edit_message: messageId=${messageId}, roomId=${roomId}, editorId=${userId}`
    );

    // 编辑消息的通知主要通过 WebSocket 实时推送
    // 这里只做日志记录，便于追踪
  }

  /**
   * 处理撤回消息任务
   *
   * 目前仅记录日志，实际通知通过 WebSocket 实时推送
   */
  @Process('recall_message')
  async handleRecallMessage(job: Job<ChatJobData>): Promise<void> {
    const { messageId, roomId, userId } = job.data;

    this.logger.debug(
      `Processing recall_message: messageId=${messageId}, roomId=${roomId}, recallBy=${userId}`
    );

    // 撤回消息的通知主要通过 WebSocket 实时推送
    // 这里只做日志记录，便于追踪
  }

  /**
   * 处理已读回执任务
   *
   * 目前仅记录日志，实际通知通过 WebSocket 实时推送
   */
  @Process('mark_read')
  async handleMarkRead(job: Job<ChatJobData>): Promise<void> {
    const { roomId, userId } = job.data;

    this.logger.debug(`Processing mark_read: roomId=${roomId}, userId=${userId}`);

    // 已读回执的通知主要通过 WebSocket 实时推送
    // 这里只做日志记录，便于追踪
  }

  /**
   * 任务完成时的回调
   */
  @OnQueueCompleted()
  onCompleted(job: Job<ChatJobData>): void {
    this.logger.debug(
      `Job completed: id=${job.id}, type=${job.data.type}, attemptsMade=${job.attemptsMade}`
    );
  }

  /**
   * 任务失败时的回调
   */
  @OnQueueFailed()
  onFailed(job: Job<ChatJobData>, error: Error): void {
    this.logger.error(
      `Job failed: id=${job.id}, type=${job.data.type}, attemptsMade=${job.attemptsMade}, error=${error.message}`
    );

    // 如果达到最大重试次数，记录更详细的错误信息
    if (job.attemptsMade >= 3) {
      this.logger.error(
        `Job permanently failed after ${job.attemptsMade} attempts: ${JSON.stringify(job.data)}`
      );
    }
  }

  /**
   * 截断消息内容用于通知显示
   */
  private truncateContent(content: string, maxLength = 100): string {
    if (content.length <= maxLength) {
      return content;
    }
    return `${content.substring(0, maxLength)}...`;
  }
}
