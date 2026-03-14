import { Processor, Process, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { Job } from 'bull';
import { NotificationService } from '../../notification/notification.service';
import { NotificationType } from '../../entities/notification.entity';
import { MESSAGE_QUEUE } from '../../queue/queue.module';
import { ChatJobData } from '../chat.service';
import { PresenceService } from '../services/presence.service';
import { RoomService } from '../services/room.service';
import { ChatGateway } from '../chat.gateway';

/**
 * 服务端推送事件类型
 */
export interface ServerPushEvents {
  /** 新消息 - 广播给房间所有成员 */
  newMessage: {
    id: string;
    roomId: string;
    senderId: string;
    type: string;
    content: string | null;
    metadata: Record<string, unknown> | null;
    replyToId: string | null;
    createdAt: Date;
  };
  /** 消息已编辑 */
  messageEdited: {
    messageId: string;
    roomId: string;
    editorId: string;
    content: string;
    editedAt: Date;
  };
  /** 消息已撤回 */
  messageRecalled: {
    messageId: string;
    roomId: string;
    recalledBy: string;
    deletedAt: Date;
  };
  /** 消息已读 */
  messagesRead: {
    roomId: string;
    userId: string;
    username: string;
    readAt: Date;
  };
}

/**
 * 消息队列处理器
 *
 * 处理 `chat-message` 队列中的任务:
 * - send_message: 广播新消息 + 为离线用户创建通知
 * - edit_message: 广播消息编辑
 * - recall_message: 广播消息撤回
 * - mark_read: 广播已读回执
 *
 * 失败重试配置: 3次 (在 QueueModule 中配置)
 */
@Processor(MESSAGE_QUEUE)
export class MessageProcessor {
  private readonly logger = new Logger(MessageProcessor.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly presenceService: PresenceService,
    private readonly roomService: RoomService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway
  ) {}

  /**
   * 处理发送消息任务
   *
   * 1. 广播新消息给房间所有成员 (通过 WebSocket)
   * 2. 为离线成员创建推送通知
   */
  @Process('send_message')
  async handleSendMessage(job: Job<ChatJobData>): Promise<void> {
    const { messageId, roomId, userId, content, messageType, metadata, replyToId, timestamp } =
      job.data;

    this.logger.debug(
      `Processing send_message: messageId=${messageId}, roomId=${roomId}, senderId=${userId}`
    );

    // 验证必要字段
    if (!roomId || !userId || !messageId) {
      this.logger.warn('Missing required fields in send_message job');
      return;
    }

    // 1. 广播新消息给房间所有成员 (包括发送者，确保消息一致性)
    this.chatGateway.broadcastToRoom(roomId, 'newMessage', {
      id: messageId,
      roomId,
      senderId: userId,
      type: messageType ?? 'text',
      content: content ?? null,
      metadata: metadata ?? null,
      replyToId: replyToId ?? null,
      createdAt: timestamp ? new Date(timestamp) : new Date(),
    } as ServerPushEvents['newMessage']);

    this.logger.debug(`Broadcast newMessage to room ${roomId}`);

    // 2. 获取房间所有成员
    const members = await this.roomService.getMembers(roomId);
    const memberIds = members.map((m) => m.userId);

    // 排除发送者
    const recipientIds = memberIds.filter((id) => id !== userId);

    if (recipientIds.length === 0) {
      this.logger.debug('No recipients to notify');
      return;
    }

    // 3. 检查哪些用户离线
    const onlineStatuses = await this.presenceService.getOnlineUsers(recipientIds);
    const onlineUserIds = new Set(onlineStatuses.filter((s) => s.isOnline).map((s) => s.userId));

    // 4. 为离线用户创建通知
    const offlineUserIds = recipientIds.filter((id) => !onlineUserIds.has(id));

    if (offlineUserIds.length === 0) {
      this.logger.debug('All recipients are online, skipping push notifications');
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

    this.logger.debug(`Created push notifications for ${offlineUserIds.length} offline users`);
  }

  /**
   * 处理编辑消息任务
   *
   * 广播消息编辑事件给房间所有成员
   */
  @Process('edit_message')
  async handleEditMessage(job: Job<ChatJobData>): Promise<void> {
    const { messageId, roomId, userId, content, timestamp } = job.data;

    this.logger.debug(
      `Processing edit_message: messageId=${messageId}, roomId=${roomId}, editorId=${userId}`
    );

    if (!roomId || !messageId || !userId) {
      this.logger.warn('Missing required fields in edit_message job');
      return;
    }

    // 广播消息编辑事件
    this.chatGateway.broadcastToRoom(roomId, 'messageEdited', {
      messageId,
      roomId,
      editorId: userId,
      content: content ?? '',
      editedAt: timestamp ? new Date(timestamp) : new Date(),
    } as ServerPushEvents['messageEdited']);

    this.logger.debug(`Broadcast messageEdited to room ${roomId}`);
  }

  /**
   * 处理撤回消息任务
   *
   * 广播消息撤回事件给房间所有成员
   */
  @Process('recall_message')
  async handleRecallMessage(job: Job<ChatJobData>): Promise<void> {
    const { messageId, roomId, userId, timestamp } = job.data;

    this.logger.debug(
      `Processing recall_message: messageId=${messageId}, roomId=${roomId}, recallBy=${userId}`
    );

    if (!roomId || !messageId || !userId) {
      this.logger.warn('Missing required fields in recall_message job');
      return;
    }

    // 广播消息撤回事件
    this.chatGateway.broadcastToRoom(roomId, 'messageRecalled', {
      messageId,
      roomId,
      recalledBy: userId,
      deletedAt: timestamp ? new Date(timestamp) : new Date(),
    } as ServerPushEvents['messageRecalled']);

    this.logger.debug(`Broadcast messageRecalled to room ${roomId}`);
  }

  /**
   * 处理已读回执任务
   *
   * 广播已读事件给房间所有成员
   */
  @Process('mark_read')
  async handleMarkRead(job: Job<ChatJobData>): Promise<void> {
    const { roomId, userId, username, timestamp } = job.data;

    this.logger.debug(`Processing mark_read: roomId=${roomId}, userId=${userId}`);

    if (!roomId || !userId) {
      this.logger.warn('Missing required fields in mark_read job');
      return;
    }

    // 广播已读事件
    this.chatGateway.broadcastToRoom(roomId, 'messagesRead', {
      roomId,
      userId,
      username: username ?? 'Unknown',
      readAt: timestamp ? new Date(timestamp) : new Date(),
    } as ServerPushEvents['messagesRead']);

    this.logger.debug(`Broadcast messagesRead to room ${roomId}`);
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
