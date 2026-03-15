import { Module, Global, Logger } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import {  getRedisUrl } from '../config/redis.config';
import Redis from "ioredis"
/**
 * Queue names constants
 */
export const MESSAGE_QUEUE = 'chat-message';

/**
 * Global BullMQ queue module
 * Uses @Global() decorator to make queues available across all modules
 * Queues are backed by Redis for persistence and reliability
 *
 * Note: If Redis is not available, the queue will fail gracefully.
 * Message broadcasting will still work via direct emit in ChatGateway.
 */
@Global()
@Module({
  imports: [
    BullModule.forRoot({
      connection: new Redis('rediss://default:Ad0vAAIncDI2OTJjYmY0ODQxYTY0ZjEwODYzNDdlMGYyM2Q0ZDg3MXAyNTY2MjM@wired-jaybird-56623.upstash.io:6379',{maxRetriesPerRequest: null}),
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
export class QueueModule {
  private readonly logger = new Logger(QueueModule.name);

  constructor() {
    const redisUrl = getRedisUrl();
    this.logger.log('QueueModule initialized with BullMQ');
    this.logger.log(`Redis URL: ${redisUrl || 'not configured'}`);
    this.logger.warn(
      'Note: If Redis is not running, queue jobs will fail. ' +
        'Message broadcasting will still work via direct emit in ChatGateway. ' +
        'Start Redis with: docker run -d --name redis -p 6379:6379 redis:alpine'
    );
  }
}
