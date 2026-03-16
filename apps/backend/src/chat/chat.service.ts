import { Injectable, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MessageService, CreateMessageData, EditMessageData } from './services/message.service';
import { RoomService } from './services/room.service';
import { PresenceService, PresenceStatus } from './services/presence.service';
import { Message, MessageType } from '../entities/message.entity';
import { MESSAGE_QUEUE } from '../queue/queue.module';

/**
 * 队列任务数据接口
 */
export interface ChatJobData {
  /** 任务类型 */
  type: 'send_message' | 'edit_message' | 'recall_message' | 'mark_read';
  /** 消息ID */
  messageId?: string;
  /** 房间ID */
  roomId?: string;
  /** 发送者/操作者ID */
  userId?: string;
  /** 用户名 (用于广播时显示) */
  username?: string;
  /** 消息内容 */
  content?: string;
  /** 消息类型 */
  messageType?: MessageType;
  /** 附加元数据 */
  metadata?: Record<string, unknown>;
  /** 回复的消息ID */
  replyToId?: string;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 发送消息请求
 */
export interface SendMessageRequest {
  roomId: string;
  content: string;
  type?: MessageType;
  metadata?: Record<string, unknown>;
  replyToId?: string;
}

/**
 * 编辑消息请求
 */
export interface EditMessageRequest {
  content: string;
}

/**
 * 房间未读信息
 */
export interface RoomUnreadInfo {
  roomId: string;
  unreadCount: number;
  lastReadAt: Date;
}

/**
 * 聊天聚合服务
 *
 * 协调 MessageService, RoomService, PresenceService
 * 实现消息发送、编辑、撤回、已读回执等业务流程
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  /** 消息撤回时间限制: 5分钟 (毫秒) */
  private readonly RECALL_TIME_LIMIT_MS = 5 * 60 * 1000;

  constructor(
    private readonly messageService: MessageService,
    private readonly roomService: RoomService,
    private readonly presenceService: PresenceService,
    @InjectQueue(MESSAGE_QUEUE)
    private readonly messageQueue: Queue<ChatJobData>
  ) {}

  /**
   * 发送消息
   *
   * 流程:
   * 1. 验证用户是房间成员
   * 2. 创建消息记录
   * 3. 加入 Bull 队列异步处理 (广播 + 离线通知)
   * 4. 更新房间最后消息时间
   *
   * @param userId 发送者ID
   * @param request 消息请求
   * @param username 发送者用户名 (用于广播)
   */
  async sendMessage(
    userId: string,
    request: SendMessageRequest,
    username?: string
  ): Promise<Message> {
    // 1. 验证用户是房间成员
    const isMember = await this.roomService.isMember(request.roomId, userId);
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this room');
    }

    // 2. 创建消息
    const messageData: CreateMessageData = {
      roomId: request.roomId,
      senderId: userId,
      type: request.type ?? MessageType.TEXT,
      content: request.content,
      metadata: request.metadata,
      replyToId: request.replyToId,
    };
    const message = await this.messageService.create(messageData);

    // 3. 加入 Bull 队列异步处理 (广播 + 离线通知)
    // 注意: 如果 Redis 不可用，队列操作会失败，但不影响消息已保存
    try {
      this.logger.debug(`Before Message job added to queue: messageId=${message.id}`);
      const jobData: ChatJobData = {
        type: 'send_message',
        messageId: message.id,
        roomId: request.roomId,
        userId,
        username,
        content: request.content,
        messageType: request.type ?? MessageType.TEXT,
        metadata: request.metadata,
        replyToId: request.replyToId,
        timestamp: Date.now(),
      };
      // 添加超时控制，避免 Redis 连接问题导致无限阻塞
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Queue add timeout')), 5000);
      });
      await Promise.race([this.messageQueue.add('send_message', jobData), timeoutPromise]);
      this.logger.debug(`Message job added to queue: messageId=${message.id}`);
    } catch (error) {
      // 队列不可用时，消息已保存，只是离线通知会延迟
      this.logger.warn(
        `Failed to add message to queue (Redis may be unavailable): ${error instanceof Error ? error.message : 'Unknown error'}. ` +
          `Message is saved but offline notifications may be delayed.`
      );
    }

    // 4. 更新房间最后消息时间
    await this.roomService.updateLastMessageAt(request.roomId);

    this.logger.debug(
      `Message sent: messageId=${message.id}, roomId=${request.roomId}, userId=${userId}`
    );

    return message;
  }

  /**
   * 编辑消息
   *
   * 流程:
   * 1. 验证用户是房间成员
   * 2. 调用 MessageService.edit() (内部验证所有权)
   * 3. 加入队列广播给其他用户
   * 4. 更新房间最后消息时间
   *
   * @param messageId 消息ID
   * @param userId 操作者ID
   * @param request 编辑请求
   * @param username 操作者用户名 (用于广播)
   */
  async editMessage(
    messageId: string,
    userId: string,
    request: EditMessageRequest,
    username?: string
  ): Promise<Message> {
    // 1. 获取消息以确定房间
    const existingMessage = await this.messageService.findById(messageId, false);
    if (!existingMessage) {
      throw new BadRequestException('Message not found');
    }

    // 2. 验证用户是房间成员
    const isMember = await this.roomService.isMember(existingMessage.roomId, userId);
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this room');
    }

    // 3. 调用 MessageService.edit() (内部验证所有权)
    const message = await this.messageService.edit(messageId, userId, {
      content: request.content,
    } as EditMessageData);

    // 4. 加入队列广播给房间成员
    const jobData: ChatJobData = {
      type: 'edit_message',
      messageId,
      roomId: message.roomId,
      userId,
      username,
      content: request.content,
      timestamp: Date.now(),
    };

    // 注意: 如果 Redis 不可用，队列操作会失败，但不影响消息已编辑
    try {
      await this.messageQueue.add('edit_message', jobData);
      this.logger.debug(`Message edit job added to queue: messageId=${messageId}`);
    } catch (error) {
      // 韟列不可用时，消息已编辑，只是广播会延迟
      this.logger.warn(
        `Failed to add edit job to queue (Redis may be unavailable): ${error instanceof Error ? error.message : 'Unknown error'}. ` +
          `Message is edited but broadcast to may be delayed.`
      );
    }

    // 5. 更新房间最后消息时间
    await this.roomService.updateLastMessageAt(message.roomId);

    this.logger.debug(`Message edited: ${message.id} by user ${userId}`);

    return message;
  }

  /**
   * 撤回消息 (软删除)
   *
   * 流程:
   * 1. 验证消息存在且未删除
   * 2. 验证是消息发送者
   * 3. 检查5分钟时间限制
   * 4. 调用 MessageService.softDelete()
   * 5. 加入队列广播给其他用户
   *
   * @param messageId 消息ID
   * @param userId 操作者ID
   * @param username 操作者用户名 (用于广播)
   */
  async recallMessage(messageId: string, userId: string, username?: string): Promise<Message> {
    // 获取消息检查时间限制
    const message = await this.messageService.findById(messageId, false);

    if (!message) {
      throw new BadRequestException('Message not found');
    }

    // 检查是否是发送者
    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only recall your own messages');
    }

    // 检查是否已删除
    if (message.deletedAt) {
      throw new BadRequestException('Message is already recalled');
    }

    // 检查5分钟时间限制
    const now = new Date();
    const messageCreatedAt = new Date(message.createdAt);
    const timeDiff = now.getTime() - messageCreatedAt.getTime();

    if (timeDiff > this.RECALL_TIME_LIMIT_MS) {
      throw new ForbiddenException('Message can only be recalled within 5 minutes of sending');
    }

    // 调用 MessageService 软删除
    const deletedMessage = await this.messageService.softDelete(messageId, userId);

    // 加入队列广播给房间成员
    const jobData: ChatJobData = {
      type: 'recall_message',
      messageId,
      roomId: deletedMessage.roomId,
      userId,
      username,
      timestamp: Date.now(),
    };

    try {
      await this.messageQueue.add('recall_message', jobData);
      this.logger.debug(`Recall job added to queue: messageId=${messageId}`);
    } catch (error) {
      this.logger.warn(
        `Failed to add recall job to queue: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
          `Message is recalled but broadcast may be delayed.`
      );
    }

    this.logger.debug(`Message recalled: messageId=${messageId}, userId=${userId}`);

    return deletedMessage;
  }

  /**
   * 标记房间消息已读 (per-room 模式)
   *
   * 更新用户在房间中的最后阅读时间戳
   * 后续未读数计算基于此时间戳
   *
   * @param roomId 房间ID
   * @param userId 用户ID
   * @param username 用户名 (用于广播)
   */
  async markAsRead(roomId: string, userId: string, username?: string): Promise<void> {
    // 验证用户是房间成员
    const isMember = await this.roomService.isMember(roomId, userId);
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this room');
    }

    // 更新成员的最后阅读时间
    await this.roomService.updateLastRead(roomId, userId);

    // 加入队列广播已读回执
    const jobData: ChatJobData = {
      type: 'mark_read',
      roomId,
      userId,
      username,
      timestamp: Date.now(),
    };

    try {
      await this.messageQueue.add('mark_read', jobData);
      this.logger.debug(`Mark read job added to queue: roomId=${roomId}`);
    } catch (error) {
      this.logger.warn(
        `Failed to add mark_read job to queue (Redis may be unavailable): ${error instanceof Error ? error.message : 'Unknown error'}. ` +
          `Read status is updated but broadcast may be delayed.`
      );
    }

    this.logger.debug(`Room marked as read: roomId=${roomId}, userId=${userId}`);
  }

  /**
   * 获取房间未读消息数
   *
   * 基于用户在房间中的最后阅读时间计算
   *
   * @param roomId 房间ID
   * @param userId 用户ID
   */
  async getUnreadCount(roomId: string, userId: string): Promise<number> {
    // 获取成员信息 (包含 lastReadAt)
    const memberInfo = await this.roomService.getMemberInfo(roomId, userId);

    if (!memberInfo) {
      return 0;
    }

    // 使用 MessageService 计算未读数
    return this.messageService.getUnreadCount(roomId, userId, memberInfo.lastReadAt);
  }

  /**
   * 获取用户所有房间的未读信息
   *
   * @param userId 用户ID
   */
  async getAllUnreadCounts(userId: string): Promise<RoomUnreadInfo[]> {
    const userRooms = await this.roomService.findByUser(userId);

    const results: RoomUnreadInfo[] = [];

    for (const roomData of userRooms) {
      const unreadCount = await this.messageService.getUnreadCount(
        roomData.room.id,
        userId,
        roomData.lastReadAt
      );

      results.push({
        roomId: roomData.room.id,
        unreadCount,
        lastReadAt: roomData.lastReadAt,
      });
    }

    return results;
  }

  /**
   * 获取房间成员的在线状态
   *
   * @param roomId 房间ID
   */
  async getRoomMembersOnlineStatus(roomId: string): Promise<PresenceStatus[]> {
    const members = await this.roomService.getMembers(roomId);
    const userIds = members.map((m) => m.userId);

    return this.presenceService.getOnlineUsers(userIds);
  }

  /**
   * 获取房间历史消息 (分页)
   *
   * @param roomId 房间ID
   * @param userId 用户ID (用于权限验证)
   * @param options 分页选项
   */
  async getRoomMessages(
    roomId: string,
    userId: string,
    options: { cursor?: string; limit?: number; order?: 'ASC' | 'DESC' } = {}
  ) {
    // 验证用户是房间成员
    const isMember = await this.roomService.isMember(roomId, userId);
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this room');
    }

    return this.messageService.findByRoom(roomId, options);
  }

  /**
   * 获取或创建私聊房间
   *
   * @param userId 当前用户ID
   * @param targetUserId 目标用户ID
   */
  async getOrCreatePrivateRoom(
    userId: string,
    targetUserId: string
  ): Promise<{ roomId: string; isHidden: boolean }> {
    if (userId === targetUserId) {
      throw new BadRequestException('Cannot create a private room with yourself');
    }

    const room = await this.roomService.getOrCreatePrivateRoom(userId, targetUserId);

    // Get current user's member info to return isHidden status
    const memberInfo = await this.roomService.getMemberInfo(room.id, userId);
    const isHidden = memberInfo?.isHidden ?? false;

    return { roomId: room.id, isHidden };
  }
}
