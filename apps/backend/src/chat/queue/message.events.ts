import { OnQueueEvent } from '@nestjs/bullmq';
import { Logger, Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { ChatJobData } from '../chat.service';

/**
 * 队列事件类型
 */
export type QueueEventType = 'active' | 'completed' | 'failed';

/**
 * WebSocket 消息事件载荷
 */
export interface MessageEventPayload {
  /** 事件类型 */
  event: QueueEventType;
  /** 任务类型 */
  jobType: ChatJobData['type'];
  /** 消息ID */
  messageId?: string;
  /** 房间ID */
  roomId?: string;
  /** 用户ID */
  userId?: string;
  /** 时间戳 */
  timestamp: number;
  /** 错误信息 (仅 failed 事件) */
  error?: string;
  /** 任务ID */
  jobId?: number | string;
  /** 重试次数 */
  attemptsMade?: number;
}

/**
 * WebSocket Gateway 接口 (用于类型安全)
 */
interface IWebsocketGateway {
  pushSystemMessage(
    userId: string,
    message: { message: string; type: 'info' | 'warning' | 'error'; timestamp: Date }
  ): void;
  broadcastSystemMessage(message: {
    message: string;
    type: 'info' | 'warning' | 'error';
    timestamp: Date;
  }): void;
}

/**
 * 消息队列事件监听器
 *
 * 监听队列生命周期事件并通过 WebSocket 通知客户端
 *
 * 设计原则:
 * - 不阻塞队列处理 (事件处理应该是轻量级的)
 * - 使用 setter 注入避免循环依赖
 * - 类型安全的事件数据
 */
@Injectable()
export class MessageEvents {
  private readonly logger = new Logger(MessageEvents.name);

  /** WebSocket Gateway 实例 (通过 setter 注入) */
  private websocketGateway: IWebsocketGateway | null = null;

  constructor() {}

  /**
   * 设置 WebSocket Gateway 实例
   *
   * 由模块在初始化时调用，避免循环依赖
   */
  setWebsocketGateway(gateway: IWebsocketGateway): void {
    this.websocketGateway = gateway;
    this.logger.debug('WebSocket Gateway instance set');
  }

  /**
   * 任务开始处理时的回调
   *
   * 记录日志，不阻塞处理
   */
  @OnQueueEvent('active')
  onActive(job: Job<ChatJobData>): void {
    const { type, messageId, roomId, userId } = job.data;

    this.logger.debug(
      `Job active: id=${job.id}, type=${type}, messageId=${messageId}, roomId=${roomId}, userId=${userId}`
    );

    // 轻量级日志记录，不执行重操作
    // WebSocket 通知在 completed/failed 时发送
  }

  /**
   * 任务完成时的回调
   *
   * 通过 WebSocket 通知相关用户
   */
  @OnQueueEvent('completed')
  onCompleted(job: Job<ChatJobData>): void {
    const { type, messageId, roomId, userId, timestamp } = job.data;

    this.logger.debug(
      `Job completed: id=${job.id}, type=${type}, attemptsMade=${job.attemptsMade}`
    );

    // 构建事件载荷
    const payload: MessageEventPayload = {
      event: 'completed',
      jobType: type,
      messageId,
      roomId,
      userId,
      timestamp,
      jobId: job.id,
      attemptsMade: job.attemptsMade,
    };

    // 通过 WebSocket 通知 (如果有 roomId 则通知房间成员)
    this.notifyRoomMembers(roomId, payload);
  }

  /**
   * 任务失败时的回调
   *
   * 记录错误并通过 WebSocket 通知
   */
  @OnQueueEvent('failed')
  onFailed(job: Job<ChatJobData>, error: Error): void {
    const { type, messageId, roomId, userId, timestamp } = job.data;

    this.logger.error(
      `Job failed: id=${job.id}, type=${type}, attemptsMade=${job.attemptsMade}, error=${error.message}`
    );

    // 构建事件载荷
    const payload: MessageEventPayload = {
      event: 'failed',
      jobType: type,
      messageId,
      roomId,
      userId,
      timestamp,
      error: error.message,
      jobId: job.id,
      attemptsMade: job.attemptsMade,
    };

    // 如果达到最大重试次数，记录更详细的错误信息
    if (job.attemptsMade >= 3) {
      this.logger.error(
        `Job permanently failed after ${job.attemptsMade} attempts: ${JSON.stringify({
          type,
          messageId,
          roomId,
        })}`
      );
    }

    // 通过 WebSocket 通知
    this.notifyRoomMembers(roomId, payload);
  }

  /**
   * 通知房间成员
   *
   * 通过 WebSocket 向房间成员推送队列事件
   */
  private notifyRoomMembers(roomId: string | undefined, payload: MessageEventPayload): void {
    if (!this.websocketGateway) {
      this.logger.debug('WebSocket Gateway not available, skipping notification');
      return;
    }

    if (!roomId) {
      this.logger.debug('No roomId provided, skipping room notification');
      return;
    }

    try {
      // 广播队列事件到房间
      // 注意: 这里使用 system 消息类型
      // 实际实现可能需要扩展 WebSocket Gateway 支持房间广播
      this.websocketGateway.broadcastSystemMessage({
        message: `Queue event: ${payload.jobType} ${payload.event}`,
        type: payload.event === 'failed' ? 'error' : 'info',
        timestamp: new Date(),
      });

      this.logger.debug(
        `Notified room ${roomId} of queue event: ${payload.jobType} ${payload.event}`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to notify room members: ${errorMessage}`);
    }
  }
}
