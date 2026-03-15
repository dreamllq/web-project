import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { ChatService, SendMessageRequest, EditMessageRequest } from './chat.service';
import { PresenceService } from './services/presence.service';
import { MessageType } from '../entities/message.entity';

/**
 * WebSocket 用户数据
 */
interface WsUser {
  id: string;
  username: string;
}

/**
 * 加入房间请求
 */
interface JoinRoomPayload {
  roomId: string;
}

/**
 * 离开房间请求
 */
interface LeaveRoomPayload {
  roomId: string;
}

/**
 * 发送消息请求
 */
interface SendMessagePayload {
  roomId: string;
  content: string;
  type?: MessageType;
  metadata?: Record<string, unknown>;
  replyToId?: string;
}

/**
 * 编辑消息请求
 */
interface EditMessagePayload {
  messageId: string;
  content: string;
}

/**
 * 输入状态请求
 */
interface TypingPayload {
  roomId: string;
  isTyping: boolean;
}

/**
 * 标记已读请求
 */
interface MarkReadPayload {
  roomId: string;
}

/**
 * 聊天 WebSocket 网关
 *
 * 处理实时聊天功能：
 * - 房间加入/离开
 * - 消息发送/编辑/撤回
 * - 输入状态
 * - 已读回执
 * - 在线状态管理
 */
@Injectable()
@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: '*' },
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private isServerReady = false;

  constructor(
    private readonly authService: AuthService,
    private readonly chatService: ChatService,
    private readonly presenceService: PresenceService
  ) {}

  /**
   * WebSocket 服务器初始化完成
   */
  afterInit(): void {
    this.isServerReady = true;
    this.logger.log('ChatGateway initialized, WebSocket server ready');
  }

  /**
   * 处理新 WebSocket 连接
   * 验证 JWT token 并附加用户信息到 socket
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      // 从 auth、query 或 auth header 提取 token
      // 调试: 打印所有可能的 token 来源
      const authToken = client.handshake.auth?.token as string | undefined;
      const queryToken = client.handshake.query.token as string | undefined;
      const headerToken = this.extractTokenFromAuthHeader(client.handshake.headers.authorization);

      this.logger.debug(
        `Token sources for client ${client.id}: auth=${!!authToken}, query=${!!queryToken}, header=${!!headerToken}`
      );

      const token = authToken || queryToken || headerToken;

      if (!token) {
        this.logger.warn(`Connection rejected: No token provided for client ${client.id}`);
        client.emit('error', { message: 'Authentication required' });
        client.disconnect(true);
        return;
      }

      // 验证 token 获取用户
      const user = await this.authService.validateAccessToken(token);

      // 附加用户信息到 socket
      const wsUser: WsUser = {
        id: user.id,
        username: user.username,
      };
      (client.data as { user: WsUser }).user = wsUser;

      // 设置用户在线状态
      await this.presenceService.setOnline(user.id);

      this.logger.log(`Client connected: ${client.id}, User: ${user.username} (${user.id})`);

      // 发送连接成功事件
      client.emit('connection', {
        message: 'Connected to chat',
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Connection rejected: Invalid token for client ${client.id} - ${errorMessage}`
      );
      client.emit('error', { message: 'Invalid or expired token' });
      client.disconnect(true);
    }
  }

  /**
   * 处理 WebSocket 断开连接
   */
  async handleDisconnect(client: Socket): Promise<void> {
    const userData = client.data as { user?: WsUser };
    const user = userData.user;

    if (user) {
      // 设置用户离线状态
      await this.presenceService.setOffline(user.id);
      this.logger.log(`Client disconnected: ${client.id}, User: ${user.username} (${user.id})`);
    } else {
      this.logger.log(`Client disconnected: ${client.id} (unauthenticated)`);
    }
  }

  /**
   * 加入聊天房间
   * 客户端将加入 Socket.IO room，接收该房间的消息
   */
  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinRoomPayload
  ): Promise<{ success: boolean; roomId: string }> {
    const user = this.getUserFromSocket(client);
    if (!user) {
      throw new Error('Unauthorized');
    }

    const { roomId } = payload;

    // 验证用户是房间成员 (ChatService 内部会验证)
    try {
      // 加入 Socket.IO room
      client.join(`room:${roomId}`);

      // 通知房间其他成员
      client.to(`room:${roomId}`).emit('userJoined', {
        userId: user.id,
        username: user.username,
        roomId,
        timestamp: new Date().toISOString(),
      });

      this.logger.debug(`User ${user.username} joined room ${roomId}`);

      return { success: true, roomId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to join room: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 离开聊天房间
   */
  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LeaveRoomPayload
  ): Promise<{ success: boolean; roomId: string }> {
    const user = this.getUserFromSocket(client);
    if (!user) {
      throw new Error('Unauthorized');
    }

    const { roomId } = payload;

    // 离开 Socket.IO room
    client.leave(`room:${roomId}`);

    // 通知房间其他成员
    client.to(`room:${roomId}`).emit('userLeft', {
      userId: user.id,
      username: user.username,
      roomId,
      timestamp: new Date().toISOString(),
    });

    this.logger.debug(`User ${user.username} left room ${roomId}`);

    return { success: true, roomId };
  }

  /**
   * 发送消息
   * 消息通过 ChatService 处理，加入 Bull 队列异步分发和广播
   * 同时直接广播以确保实时性（队列作为 fallback）
   */
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessagePayload
  ): Promise<{ success: boolean; messageId: string }> {
    const user = this.getUserFromSocket(client);
    if (!user) {
      throw new Error('Unauthorized');
    }

    const request: SendMessageRequest = {
      roomId: payload.roomId,
      content: payload.content,
      type: payload.type ?? MessageType.TEXT,
      metadata: payload.metadata,
      replyToId: payload.replyToId,
    };

    // 通过 ChatService 发送消息 (内部会加入队列广播)
    const message = await this.chatService.sendMessage(user.id, request, user.username);

    // 立即广播消息（不依赖队列）确保实时性
    this.broadcastToRoom(payload.roomId, 'newMessage', {
      id: message.id,
      roomId: payload.roomId,
      senderId: user.id,
      type: message.type,
      content: message.content,
      metadata: message.metadata,
      replyToId: message.replyToId,
      createdAt: message.createdAt,
    });

    this.logger.debug(`Message sent: ${message.id} by user ${user.username}`);

    return { success: true, messageId: message.id };
  }

  /**
   * 编辑消息
   */
  @SubscribeMessage('editMessage')
  async handleEditMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: EditMessagePayload
  ): Promise<{ success: boolean; messageId: string }> {
    const user = this.getUserFromSocket(client);
    if (!user) {
      throw new Error('Unauthorized');
    }

    const request: EditMessageRequest = {
      content: payload.content,
    };

    // 通过 ChatService 编辑消息 (内部会加入队列广播)
    const message = await this.chatService.editMessage(
      payload.messageId,
      user.id,
      request,
      user.username
    );

    this.logger.debug(`Message edited: ${message.id} by user ${user.username}`);

    return { success: true, messageId: message.id };
  }

  /**
   * 输入状态
   * 直接广播给房间其他成员，不经过队列
   */
  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TypingPayload
  ): Promise<void> {
    const user = this.getUserFromSocket(client);
    if (!user) {
      return;
    }

    const { roomId, isTyping } = payload;

    // 直接广播给房间其他成员
    client.to(`room:${roomId}`).emit('userTyping', {
      userId: user.id,
      username: user.username,
      roomId,
      isTyping,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 标记房间消息已读
   */
  @SubscribeMessage('markRead')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: MarkReadPayload
  ): Promise<{ success: boolean; roomId: string }> {
    const user = this.getUserFromSocket(client);
    if (!user) {
      throw new Error('Unauthorized');
    }

    const { roomId } = payload;

    // 通过 ChatService 标记已读 (内部会加入队列广播)
    await this.chatService.markAsRead(roomId, user.id, user.username);

    this.logger.debug(`Room ${roomId} marked as read by user ${user.username}`);

    return { success: true, roomId };
  }

  /**
   * 广播消息到指定房间
   * 供外部服务调用 (如 MessageProcessor)
   */
  broadcastToRoom(roomId: string, event: string, data: unknown): void {
    if (!this.isServerReady || !this.server) {
      this.logger.warn(`Cannot broadcast to room ${roomId}: WebSocket server not ready`);
      return;
    }

    const roomName = `room:${roomId}`;
    this.logger.debug(`Broadcast to room ${roomId}: event=${event}`);
    this.server.to(roomName).emit(event, data);
  }

  /**
   * 发送消息给指定用户
   * 供外部服务调用
   */
  sendToUser(userId: string, event: string, data: unknown): void {
    this.server.emit(event, data);
    this.logger.debug(`Send to user ${userId}: event=${event}`);
  }

  /**
   * 从 socket 获取用户信息
   */
  private getUserFromSocket(client: Socket): WsUser | null {
    const userData = client.data as { user?: WsUser };
    return userData.user ?? null;
  }

  /**
   * 从 Authorization header 提取 token
   */
  private extractTokenFromAuthHeader(authHeader: string | undefined): string | null {
    if (!authHeader) {
      return null;
    }
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      return parts[1];
    }
    return null;
  }
}
