/**
 * WebSocket Authentication DTO
 *
 * Used for validating JWT token in WebSocket handshake
 */

export class WsAuthDto {
  /**
   * JWT access token for authentication
   * Can be passed via query parameter or auth header
   */
  token?: string;
}

/**
 * WebSocket User information attached to socket after authentication
 */
export interface WsUser {
  id: string;
  username: string;
}

/**
 * Notification event payload
 */
export interface NotificationPayload {
  id: string;
  type: 'system' | 'security' | 'message';
  title: string;
  content: string;
  timestamp: Date;
  read?: boolean;
}

/**
 * System message event payload
 */
export interface SystemMessagePayload {
  message: string;
  type: 'info' | 'warning' | 'error';
  timestamp: Date;
}
