import { Module, Global } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';
import { CustomCacheService } from './custom-cache.service';
import { getRedisUrl } from '../config/redis.config';

/**
 * Global cache module providing CustomCacheService
 * Uses @Global() decorator to make the service available across all modules
 * Cache is stored in Redis for persistence across application restarts
 */
@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = getRedisUrl();
        const store = await redisStore({
          url: redisUrl,
        });
        return {
          store,
          ttl: configService.get<number>('CACHE_TTL', 300000), // Default: 5 minutes
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [CustomCacheService],
  exports: [CustomCacheService],
})
export class CustomCacheModule {}
