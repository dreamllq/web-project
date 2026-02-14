import { Injectable } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';
import { NotificationPayload, SystemMessagePayload } from './dto/ws-auth.dto';

@Injectable()
export class WebsocketService {
  constructor(private readonly gateway: WebsocketGateway) {}

  /**
   * Send notification to a specific user
   */
  async sendNotification(userId: string, data: Omit<NotificationPayload, 'timestamp'>): Promise<void> {
    const notification: NotificationPayload = {
      ...data,
      timestamp: new Date(),
    };
    this.gateway.pushNotification(userId, notification);
  }

  /**
   * Send system message to a specific user
   */
  async sendSystemMessage(
    userId: string,
    message: string,
    type: SystemMessagePayload['type'] = 'info',
  ): Promise<void> {
    const systemMessage: SystemMessagePayload = {
      message,
      type,
      timestamp: new Date(),
    };
    this.gateway.pushSystemMessage(userId, systemMessage);
  }

  /**
   * Broadcast system message to all connected users
   */
  async broadcastSystemMessage(
    message: string,
    type: SystemMessagePayload['type'] = 'info',
  ): Promise<void> {
    const systemMessage: SystemMessagePayload = {
      message,
      type,
      timestamp: new Date(),
    };
    this.gateway.broadcastSystemMessage(systemMessage);
  }

  /**
   * Check if a user is currently connected
   */
  isUserConnected(userId: string): boolean {
    return this.gateway.isUserConnected(userId);
  }

  /**
   * Get count of connected users
   */
  getConnectedUsersCount(): number {
    return this.gateway.getConnectedUsersCount();
  }

  /**
   * Get total count of connections
   */
  getTotalConnectionsCount(): number {
    return this.gateway.getTotalConnectionsCount();
  }

  /**
   * Disconnect all sockets for a user
   */
  disconnectUser(userId: string): void {
    this.gateway.disconnectUser(userId);
  }
}
