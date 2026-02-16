import { Module, Global } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { CustomCacheService } from './custom-cache.service';

/**
 * Global cache module providing CustomCacheService
 * Uses @Global() decorator to make the service available across all modules
 */
@Global()
@Module({
  imports: [CacheModule.register()],
  providers: [CustomCacheService],
  exports: [CustomCacheService],
})
export class CustomCacheModule {}
