import { Injectable, Logger } from '@nestjs/common';
import { CustomCacheService } from '../../custom-cache/custom-cache.service';

/**
 * 用户在线状态数据
 */
export interface PresenceData {
  /** 在线状态: 'online' | 'offline' */
  status: 'online' | 'offline';
  /** 最近活跃时间 (ISO 8601) */
  lastActiveAt: string;
}

/**
 * 用户在线状态响应
 */
export interface PresenceStatus {
  userId: string;
  isOnline: boolean;
  lastActiveAt: string | null;
}

/** 在线状态缓存键前缀 */
const PRESENCE_KEY_PREFIX = 'presence:';

/** TTL: 60秒 (毫秒) */
const PRESENCE_TTL_MS = 60 * 1000;

/**
 * 在线状态管理服务
 *
 * 管理用户的在线/离线状态，使用 Redis 缓存实现
 * - 用户上线/离线
 * - 心跳保持活跃
 * - 批量获取在线状态
 */
@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);

  constructor(private readonly cacheService: CustomCacheService) {}

  /**
   * 生成在线状态缓存键
   */
  private getPresenceKey(userId: string): string {
    return `${PRESENCE_KEY_PREFIX}${userId}`;
  }

  /**
   * 设置用户在线
   * @param userId 用户ID
   */
  async setOnline(userId: string): Promise<void> {
    const key = this.getPresenceKey(userId);
    const data: PresenceData = {
      status: 'online',
      lastActiveAt: new Date().toISOString(),
    };

    await this.cacheService.set(key, data, PRESENCE_TTL_MS);
    this.logger.debug(`User ${userId} is now online`);
  }

  /**
   * 设置用户离线
   * @param userId 用户ID
   */
  async setOffline(userId: string): Promise<void> {
    const key = this.getPresenceKey(userId);
    await this.cacheService.del(key);
    this.logger.debug(`User ${userId} is now offline`);
  }

  /**
   * 心跳 - 刷新用户在线状态 TTL
   * @param userId 用户ID
   */
  async heartbeat(userId: string): Promise<void> {
    const key = this.getPresenceKey(userId);
    const existing = await this.cacheService.get<PresenceData>(key);

    if (existing) {
      // 刷新 lastActiveAt 并重置 TTL
      const data: PresenceData = {
        status: 'online',
        lastActiveAt: new Date().toISOString(),
      };
      await this.cacheService.set(key, data, PRESENCE_TTL_MS);
      this.logger.debug(`Heartbeat received for user ${userId}`);
    } else {
      // 如果不存在，设置为在线
      await this.setOnline(userId);
    }
  }

  /**
   * 获取单个用户的在线状态
   * @param userId 用户ID
   * @returns 用户在线状态
   */
  async getOnlineStatus(userId: string): Promise<PresenceStatus> {
    const key = this.getPresenceKey(userId);
    const data = await this.cacheService.get<PresenceData>(key);

    return {
      userId,
      isOnline: data?.status === 'online',
      lastActiveAt: data?.lastActiveAt ?? null,
    };
  }

  /**
   * 批量获取用户在线状态
   * @param userIds 用户ID列表
   * @returns 用户在线状态列表
   */
  async getOnlineUsers(userIds: string[]): Promise<PresenceStatus[]> {
    const results = await Promise.all(userIds.map((userId) => this.getOnlineStatus(userId)));
    return results;
  }

  /**
   * 检查用户是否在线
   * @param userId 用户ID
   * @returns 是否在线
   */
  async isUserOnline(userId: string): Promise<boolean> {
    const status = await this.getOnlineStatus(userId);
    return status.isOnline;
  }

  /**
   * 获取用户的最近活跃时间
   * @param userId 用户ID
   * @returns 最近活跃时间或 null
   */
  async getLastActiveAt(userId: string): Promise<string | null> {
    const key = this.getPresenceKey(userId);
    const data = await this.cacheService.get<PresenceData>(key);
    return data?.lastActiveAt ?? null;
  }
}
