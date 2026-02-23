import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { CustomCacheService } from '../../custom-cache/custom-cache.service';

/**
 * Permission cache service for caching user permissions in Redis
 * Uses CustomCacheService to avoid creating additional Redis connections
 */
@Injectable()
export class PermissionCacheService {
  /** Cache TTL: 30 minutes in milliseconds */
  private readonly CACHE_TTL = 30 * 60 * 1000;

  /** Key prefix for user permissions */
  private readonly KEY_PREFIX = 'user:permissions:';

  constructor(
    @Inject(forwardRef(() => CustomCacheService))
    private readonly cacheService: CustomCacheService
  ) {}

  /**
   * Get cached permissions for a user
   * @param userId The user's unique identifier
   * @returns Array of permission strings or null if not cached
   */
  async getUserPermissions(userId: string): Promise<string[] | null> {
    const key = `${this.KEY_PREFIX}${userId}`;
    const result = await this.cacheService.get<string[]>(key);
    return result ?? null;
  }

  /**
   * Cache permissions for a user
   * @param userId The user's unique identifier
   * @param permissions Array of permission strings to cache
   */
  async setUserPermissions(userId: string, permissions: string[]): Promise<void> {
    const key = `${this.KEY_PREFIX}${userId}`;
    await this.cacheService.set(key, permissions, this.CACHE_TTL);
  }

  /**
   * Invalidate cached permissions for a user
   * Call this when user's permissions change
   * @param userId The user's unique identifier
   */
  async invalidateUser(userId: string): Promise<void> {
    const key = `${this.KEY_PREFIX}${userId}`;
    await this.cacheService.del(key);
  }
}
