import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ICustomCacheService } from './custom-cache.interface';

/**
 * Custom cache service wrapping cache-manager with type-safe methods
 * This service provides a consistent interface for caching operations
 */
@Injectable()
export class CustomCacheService implements ICustomCacheService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Get a value from cache
   * @param key The cache key
   * @returns The cached value or undefined
   */
  async get<T>(key: string): Promise<T | undefined> {
    return this.cacheManager.get<T>(key);
  }

  /**
   * Set a value in cache
   * @param key The cache key
   * @param value The value to cache
   * @param ttl Time to live in milliseconds (optional)
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.cacheManager.set(key, value, ttl);
  }

  /**
   * Delete a value from cache
   * @param key The cache key
   */
  async del(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }
}
