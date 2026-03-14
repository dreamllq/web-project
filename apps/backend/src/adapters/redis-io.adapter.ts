import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { Logger } from '@nestjs/common';
import { parseRedisUrl, getRedisUrl } from '../config/redis.config';

/**
 * Redis Socket.IO Adapter
 *
 * Enables Socket.IO to work with multiple instances by using Redis as a pub/sub backend.
 * This allows WebSocket events to be broadcast across all server instances.
 *
 * Usage:
 * - The adapter automatically connects to Redis using REDIS_URL environment variable
 * - Falls back to redis://localhost:6379 if REDIS_URL is not set
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);

  /**
   * Create the Socket.IO server with Redis adapter
   */
  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);

    const redisUrl = getRedisUrl();
    const redisOptions = parseRedisUrl(redisUrl);

    this.logger.log(`Connecting to Redis at ${redisOptions.host}:${redisOptions.port}`);

    // Create pub/sub clients for Redis adapter
    const pubClient = new Redis(redisOptions);
    const subClient = pubClient.duplicate();

    // Handle connection events
    pubClient.on('connect', () => {
      this.logger.log('Redis pub client connected');
    });

    pubClient.on('error', (err) => {
      this.logger.error('Redis pub client error:', err.message);
    });

    subClient.on('connect', () => {
      this.logger.log('Redis sub client connected');
    });

    subClient.on('error', (err) => {
      this.logger.error('Redis sub client error:', err.message);
    });

    // Create and set the Redis adapter
    const redisAdapter = createAdapter(pubClient, subClient);
    server.adapter(redisAdapter);

    this.logger.log('Redis Socket.IO adapter initialized');

    return server;
  }
}
