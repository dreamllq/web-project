import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { WsUser, NotificationPayload, SystemMessagePayload } from './dto/ws-auth.dto';

/**
 * User-specific room name prefix for Socket.IO rooms
 * Users automatically join 'user:{userId}' room on connection
 */
export const USER_ROOM_PREFIX = 'user:';

@Injectable()
@WebSocketGateway({
  path: '/ws',
  cors: { origin: '*' },
})
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebsocketGateway.name);
  private userSockets: Map<string, Socket[]> = new Map();

  constructor(private readonly authService: AuthService) {}

  /**
   * Get the user-specific room name for a user ID
   */
  static getUserRoom(userId: string): string {
    return `${USER_ROOM_PREFIX}${userId}`;
  }

  /**
   * Handle new WebSocket connection
   * Validates JWT token from handshake query or auth header
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      // Extract token from auth, query or auth header
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.query.token as string) ||
        this.extractTokenFromAuthHeader(client.handshake.headers.authorization);

      if (!token) {
        this.logger.warn(`Connection rejected: No token provided for client ${client.id}`);
        client.emit('error', { message: 'Authentication required' });
        client.disconnect(true);
        return;
      }

      // Validate token and get user
      const user = await this.authService.validateAccessToken(token);

      // Attach user to socket
      const wsUser: WsUser = {
        id: user.id,
        username: user.username,
      };
      (client.data as { user: WsUser }).user = wsUser;

      // Store socket in user map
      this.addSocketToUser(user.id, client);

      // 🔑 Auto-join user-specific room for global events (e.g., roomUpdated)
      const userRoom = WebsocketGateway.getUserRoom(user.id);
      client.join(userRoom);
      this.logger.log(`Client ${client.id} joined user room: ${userRoom}`);

      this.logger.log(`Client connected: ${client.id}, User: ${user.username} (${user.id})`);

      // Emit connection success event
      client.emit('connection', {
        message: 'Connected successfully',
        userId: user.id,
        timestamp: new Date(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Connection rejected: Invalid token for client ${client.id} - ${errorMessage}`
      );
      client.emit('error', { message: 'Invalid or expired token' });
      client.disconnect(true);
    }
  }

  /**
   * Handle WebSocket disconnection
   */
  handleDisconnect(client: Socket): void {
    const userData = client.data as { user?: WsUser };
    const user = userData.user;

    if (user) {
      this.removeSocketFromUser(user.id, client);
      this.logger.log(`Client disconnected: ${client.id}, User: ${user.username} (${user.id})`);
    } else {
      this.logger.log(`Client disconnected: ${client.id} (unauthenticated)`);
    }
  }

  /**
   * Push notification to specific user
   */
  pushNotification(userId: string, notification: NotificationPayload): void {
    const userRoom = WebsocketGateway.getUserRoom(userId);
    this.server.to(userRoom).emit('notification', notification);
    this.logger.debug(`Pushed notification to user ${userId} via room: ${notification.title}`);
  }

  /**
   * Send custom event to specific user via user room (recommended)
   * Uses Socket.IO room mechanism - more reliable than socket iteration
   */
  sendToUser(userId: string, event: string, data: unknown): void {
    const userRoom = WebsocketGateway.getUserRoom(userId);
    this.logger.log(`[sendToUser] Sending '${event}' to room ${userRoom}`);

    this.server.to(userRoom).emit(event, data);
    this.logger.log(`[sendToUser] ✅ Sent event '${event}' to user room ${userRoom}`);
  }

  /**
   * Send custom event to specific user via direct socket (fallback)
   * Use sendToUser() instead for better reliability
   */
  sendToUserDirect(userId: string, event: string, data: unknown): void {
    const sockets = this.userSockets.get(userId);
    this.logger.log(`[sendToUserDirect] Attempting to send '${event}' to user ${userId}`);

    if (sockets && sockets.length > 0) {
      this.logger.log(`[sendToUserDirect] Found ${sockets.length} socket(s) for user ${userId}`);
      sockets.forEach((socket) => {
        socket.emit(event, data);
      });
      this.logger.log(`[sendToUserDirect] ✅ Sent event '${event}' to user ${userId}`);
    } else {
      this.logger.warn(
        `[sendToUserDirect] ⚠️ No active sockets for user ${userId}, event '${event}' not delivered`
      );
    }
  }

  /**
   * Push system message to specific user
   */
  pushSystemMessage(userId: string, message: SystemMessagePayload): void {
    const userRoom = WebsocketGateway.getUserRoom(userId);
    this.server.to(userRoom).emit('system', message);
    this.logger.debug(`Pushed system message to user ${userId}: ${message.message}`);
  }

  /**
   * Broadcast system message to all connected clients
   */
  broadcastSystemMessage(message: SystemMessagePayload): void {
    this.server.emit('system', message);
    this.logger.debug(`Broadcast system message: ${message.message}`);
  }

  /**
   * Get count of connected users
   */
  getConnectedUsersCount(): number {
    return this.userSockets.size;
  }

  /**
   * Get count of total connections
   */
  getTotalConnectionsCount(): number {
    let count = 0;
    this.userSockets.forEach((sockets) => {
      count += sockets.length;
    });
    return count;
  }

  /**
   * Check if user has active connections
   */
  isUserConnected(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    return sockets !== undefined && sockets.length > 0;
  }

  /**
   * Disconnect all sockets for a user
   */
  disconnectUser(userId: string): void {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.forEach((socket) => {
        socket.disconnect(true);
      });
      this.userSockets.delete(userId);
      this.logger.log(`Disconnected all sockets for user ${userId}`);
    }
  }

  /**
   * Extract token from Authorization header
   */
  private extractTokenFromAuthHeader(authHeader: string | undefined): string | null {
    if (!authHeader) {
      return null;
    }
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      return parts[1];
    }
    return null;
  }

  /**
   * Add socket to user's socket list
   */
  private addSocketToUser(userId: string, socket: Socket): void {
    const existingSockets = this.userSockets.get(userId) || [];
    existingSockets.push(socket);
    this.userSockets.set(userId, existingSockets);
  }

  /**
   * Remove socket from user's socket list
   */
  private removeSocketFromUser(userId: string, socket: Socket): void {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      const index = sockets.indexOf(socket);
      if (index > -1) {
        sockets.splice(index, 1);
      }
      if (sockets.length === 0) {
        this.userSockets.delete(userId);
      } else {
        this.userSockets.set(userId, sockets);
      }
    }
  }
}
