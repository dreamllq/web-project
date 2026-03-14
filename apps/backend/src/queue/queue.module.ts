import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { getRedisUrl } from '../config/redis.config';

/**
 * Queue names constants
 */
export const MESSAGE_QUEUE = 'chat-message';

/**
 * Global Bull queue module
 * Uses @Global() decorator to make queues available across all modules
 * Queues are backed by Redis for persistence and reliability
 */
@Global()
@Module({
  imports: [
    BullModule.forRoot({
      redis: getRedisUrl(),
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
