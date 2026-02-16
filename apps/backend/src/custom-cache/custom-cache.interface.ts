/**
 * Interface for CustomCacheService
 * Provides type-safe caching methods wrapping cache-manager
 */
export interface ICustomCacheService {
  /**
   * Get a value from cache
   * @param key The cache key
   * @returns The cached value or undefined
   */
  get<T>(key: string): Promise<T | undefined>;

  /**
   * Set a value in cache
   * @param key The cache key
   * @param value The value to cache
   * @param ttl Time to live in milliseconds (optional)
   */
  set<T>(key: string, value: T, ttl?: number): Promise<void>;

  /**
   * Delete a value from cache
   * @param key The cache key
   */
  del(key: string): Promise<void>;
}
